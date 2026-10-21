-- ============================================================================
-- TatNat — multi-staff availability (roadmap.md §1 row 4, stretch B)
-- ============================================================================
-- The `staff` table and `bookings.staff_id` (with the per-staff exclusion
-- constraint) already exist as of the init migration — this migration adds
-- the one thing that was still missing: a way to say which services a given
-- staff member performs, and a way for the availability engine to compute
-- busy time for one staff member rather than the whole business.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- staff_services — which services a staff member can perform.
-- ---------------------------------------------------------------------------
-- A staff member with zero rows here is treated as able to perform every
-- active service at their business (same "unrestricted by default" shape as
-- `staff.works_weekdays` defaulting to all seven days) — this keeps every
-- staff member usable the moment they're added, with assigning specific
-- services an optional narrowing step for the owner, not a required one.
create table public.staff_services (
  staff_id    uuid not null references public.staff (id) on delete cascade,
  service_id  uuid not null references public.services (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (staff_id, service_id)
);

create index staff_services_service_id_idx on public.staff_services (service_id);

comment on table public.staff_services is
  'Narrows which services a staff member performs. No rows for a staff member '
  'means "performs every active service at this business" (default-open, not '
  'default-closed).';

alter table public.staff_services enable row level security;

create policy "staff_services: read visible"
  on public.staff_services for select
  using (
    exists (
      select 1 from public.staff s
      where s.id = staff_services.staff_id
        and public.business_is_visible(s.business_id)
    )
  );

create policy "staff_services: owner writes"
  on public.staff_services for all
  to authenticated
  using (
    exists (
      select 1 from public.staff s
      where s.id = staff_services.staff_id
        and public.owns_business(s.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      where s.id = staff_services.staff_id
        and public.owns_business(s.business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- bookings.staff_id — index for the per-staff availability query below.
-- ---------------------------------------------------------------------------
create index bookings_staff_starts_idx on public.bookings (staff_id, starts_at);

-- ---------------------------------------------------------------------------
-- busy_intervals — now staff-aware.
-- ---------------------------------------------------------------------------
-- Adds `target_staff`, appended last with a default of null so every existing
-- call site (which calls this by named arguments) keeps its old, business-wide
-- behaviour unless it opts in. When provided, only that staff member's own
-- bookings count as busy — this is what makes "choose your barber" and "any
-- available" possible: the engine runs once per candidate staff member with a
-- different `target_staff`, and a slot is free for that barber exactly when
-- their own calendar has nothing in the way.
drop function if exists public.busy_intervals(uuid, timestamptz, timestamptz, uuid);

create or replace function public.busy_intervals(
  target_business  uuid,
  from_ts          timestamptz,
  to_ts            timestamptz,
  exclude_booking  uuid default null,
  target_staff     uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.business_id = target_business
    and b.status in ('pending', 'confirmed')
    and b.starts_at >= from_ts
    and b.starts_at <  to_ts
    and (exclude_booking is null or b.id <> exclude_booking)
    and (target_staff is null or b.staff_id = target_staff)
    -- Only for a business whose availability is public anyway, or the owner's
    -- own. Otherwise an unpublished shop's schedule would be readable.
    and exists (
      select 1
      from public.businesses bus
      where bus.id = target_business
        and (bus.is_published or bus.owner_id = (select auth.uid()))
    )
  order by b.starts_at;
$$;

comment on function public.busy_intervals is
  'Anonymised busy ranges for the slot engine. Returns start/end only so that '
  'RLS on `bookings` is not weakened: no customer, service or price leaks. '
  'Pass `target_staff` to get one staff member''s own busy time instead of '
  'the whole business''s.';

revoke all on function public.busy_intervals(uuid, timestamptz, timestamptz, uuid, uuid)
  from public;

grant execute on function public.busy_intervals(uuid, timestamptz, timestamptz, uuid, uuid)
  to authenticated, anon;
