-- ============================================================================
-- Bookly — row level security
-- ============================================================================
-- Threat model:
--   * a customer may read published businesses and their own bookings, nothing
--     else. They can never enumerate another customer.
--   * a business owner may read and write only rows belonging to a business
--     they own, including the bookings made against it.
--   * anonymous visitors may browse published businesses so the marketing /
--     discovery pages work before sign-in.
-- ============================================================================

alter table public.profiles               enable row level security;
alter table public.businesses             enable row level security;
alter table public.business_hours         enable row level security;
alter table public.business_breaks        enable row level security;
alter table public.services               enable row level security;
alter table public.staff                  enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.bookings               enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- A profile is private to its owner. Business owners never need to read the
-- profiles table: the customer's name and phone are denormalised onto each
-- booking row at creation time, so a shop sees its own customers and no more.
create policy "profiles: read own"
  on public.profiles for select
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Inserts normally come from the `handle_new_user` trigger (SECURITY DEFINER),
-- but allow a self-insert so a profile can be repaired if the trigger was added
-- after a user already existed.
create policy "profiles: insert self"
  on public.profiles for insert
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create policy "businesses: read published or own"
  on public.businesses for select
  using (is_published or owner_id = (select auth.uid()));

create policy "businesses: owner inserts own"
  on public.businesses for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "businesses: owner updates own"
  on public.businesses for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "businesses: owner deletes own"
  on public.businesses for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Child tables of a business.
--
-- Read: visible whenever the parent business is visible, because the customer
-- booking screen needs hours, breaks, services and overrides to render slots.
-- Write: owner only.
-- ---------------------------------------------------------------------------
create policy "business_hours: read visible"
  on public.business_hours for select
  using (public.business_is_visible(business_id));

create policy "business_hours: owner writes"
  on public.business_hours for all
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "business_breaks: read visible"
  on public.business_breaks for select
  using (public.business_is_visible(business_id));

create policy "business_breaks: owner writes"
  on public.business_breaks for all
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "services: read visible"
  on public.services for select
  using (public.business_is_visible(business_id));

create policy "services: owner writes"
  on public.services for all
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "staff: read visible"
  on public.staff for select
  using (public.business_is_visible(business_id));

create policy "staff: owner writes"
  on public.staff for all
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "availability_overrides: read visible"
  on public.availability_overrides for select
  using (public.business_is_visible(business_id));

create policy "availability_overrides: owner writes"
  on public.availability_overrides for all
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create policy "bookings: read own or as owner"
  on public.bookings for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or public.owns_business(business_id)
  );

-- A customer may only create a booking for themselves.
create policy "bookings: customer creates own"
  on public.bookings for insert
  to authenticated
  with check (customer_id = (select auth.uid()));

-- A customer may update their own booking (cancelling, editing notes).
-- They cannot move it to another customer.
create policy "bookings: customer updates own"
  on public.bookings for update
  to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

-- The owner may update any booking against their business (confirm, cancel,
-- no-show, reschedule).
create policy "bookings: owner updates own business"
  on public.bookings for update
  to authenticated
  using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- Deliberately no DELETE policy: bookings are cancelled, never destroyed, so
-- the business keeps an audit trail.

-- ---------------------------------------------------------------------------
-- A customer must not be able to flip their own booking to `confirmed` when the
-- business requires manual confirmation, nor reopen a cancelled booking.
-- Column-level rules are not expressible in RLS, so enforce with a trigger.
-- ---------------------------------------------------------------------------
create or replace function public.guard_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  -- Owners and service-role callers may make any transition.
  if actor is null or public.owns_business(new.business_id) then
    return new;
  end if;

  if new.status is distinct from old.status then
    -- The customer's only permitted transition is cancelling a live booking.
    if not (old.status in ('pending', 'confirmed') and new.status = 'cancelled') then
      raise exception 'Customers may only cancel a pending or confirmed booking';
    end if;
  end if;

  -- A customer may not silently move their own appointment.
  if new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.price is distinct from old.price
     or new.service_id is distinct from old.service_id then
    raise exception 'Customers may not reschedule or reprice a booking; cancel and rebook';
  end if;

  return new;
end;
$$;

create trigger bookings_guard_status_change
  before update on public.bookings
  for each row execute function public.guard_booking_status_change();
