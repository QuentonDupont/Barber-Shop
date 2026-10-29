-- ============================================================================
-- TatNat — busy intervals for availability
-- ============================================================================
-- The slot engine needs to know which stretches of a business's day are already
-- taken. It cannot read that from `bookings` directly: RLS deliberately hides
-- other customers' rows, so a customer computing availability would see an
-- almost empty day and be offered slots that are already sold. The exclusion
-- constraint would still refuse the insert, but only after the customer has
-- picked a time and been told "sorry, gone" — repeatedly.
--
-- This function is the narrow hole in that wall: SECURITY DEFINER, and it
-- returns nothing but anonymous start/end pairs. No customer, no service, no
-- price, no booking id. Knowing that a shop is busy from 14:00 to 15:00 is
-- exactly what a booking page shows anyway.
-- ============================================================================

create or replace function public.busy_intervals(
  target_business  uuid,
  from_ts          timestamptz,
  to_ts            timestamptz,
  exclude_booking  uuid default null
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
  'RLS on `bookings` is not weakened: no customer, service or price leaks.';

revoke all on function public.busy_intervals(uuid, timestamptz, timestamptz, uuid)
  from public;

grant execute on function public.busy_intervals(uuid, timestamptz, timestamptz, uuid)
  to authenticated, anon;
