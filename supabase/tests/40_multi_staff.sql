\set ON_ERROR_STOP on

-- ===========================================================================
-- Multi-staff (roadmap.md §1 row 4, stretch B): staff/staff_services RLS,
-- and the no-double-booking-per-barber invariant.
-- Reuses the fixtures from 00_supabase_shim.sql / 10_booking_invariants.sql:
--   business aaaaaaaa...0001 owned by 11111111..., business bbbbbbbb...0002
--   owned by 22222222..., service cccccccc...0001 at the first business.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Fixtures: two barbers at Nong Barber (aaaaaaaa...0001).
-- ---------------------------------------------------------------------------
insert into public.staff (id, business_id, name, works_weekdays, is_active)
values
  ('ffffffff-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Nong', '{0,1,2,3,4,5,6}', true),
  ('ffffffff-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Somchai', '{0,1,2,3,4,5,6}', true),
  ('ffffffff-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Retired Dao', '{0,1,2,3,4,5,6}', false);

-- ---------------------------------------------------------------------------
-- staff: RLS
-- ---------------------------------------------------------------------------
set role authenticated;

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                $q$select count(*) from public.staff
                   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 3,
  'a customer can read staff of a published business (including inactive — '
  'the owner-side list hides inactive, not RLS)');

select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    update public.staff set name = 'Hijacked'
    where id = 'ffffffff-0000-0000-0000-000000000001'
  $q$),
  'a rival owner cannot rename another business''s staff member');

select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    insert into public.staff (business_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Planted')
  $q$),
  'a rival owner cannot add staff to another business');

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.staff set name = 'Nong (renamed)'
    where id = 'ffffffff-0000-0000-0000-000000000001'
  $q$),
  'the owning business can rename its own staff member');

-- ---------------------------------------------------------------------------
-- staff_services: RLS, and the "no rows = performs everything" default
-- ---------------------------------------------------------------------------
reset role;
-- Nong is narrowed to the one seeded service; Somchai is left unrestricted
-- (no rows at all) to exercise the default-open path.
insert into public.staff_services (staff_id, service_id)
values ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');
set role authenticated;

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.staff_services') = 1,
  'a customer can read the service links of a published business''s staff');

select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    insert into public.staff_services (staff_id, service_id)
    values ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002')
  $q$),
  'a rival owner cannot link another business''s staff to a service');

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    delete from public.staff_services
    where staff_id = 'ffffffff-0000-0000-0000-000000000001'
  $q$),
  'the owning business can edit its own staff member''s service links');

-- put the link back for a clean slate for the owner to re-add (next test
-- block does not depend on it, but keeps this file's state legible).
insert into public.staff_services (staff_id, service_id)
values ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- No double-booking *per barber* — the exclusion constraint already carries
-- `staff_id` (coalesced to the nil uuid) from the init migration; these tests
-- confirm that holds for the multi-staff shape specifically, not just that it
-- doesn't crash.
-- ---------------------------------------------------------------------------
reset role;

-- 2026-04-10 is a Friday, deliberately distinct from the dates
-- 10/20/25/30_*.sql use, so this file's counts never depend on what another
-- test file left behind in the shared `bookings` table.
-- Nong is booked 10:00–11:00 Bangkok (03:00–04:00 UTC).
insert into public.bookings
  (id, business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('dddddddd-0000-0000-0000-000000000010',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', 'ffffffff-0000-0000-0000-000000000001',
   '2026-04-10T03:00:00Z', '2026-04-10T04:00:00Z', 'confirmed', 'Cut', 300, 'Ann Customer');

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444', 'ffffffff-0000-0000-0000-000000000001',
            '2026-04-10T03:30:00Z', '2026-04-10T04:30:00Z', 'confirmed', 'Cut', 300, 'Ben')
  $q$),
  'double-booking the SAME barber at an overlapping time is refused');

select test_assert(true, (
  -- Somchai, a *different* barber at the same shop, same exact time as Nong's
  -- booking above — this must succeed. Multi-staff's whole point is that two
  -- barbers at one shop are independent calendars.
  select case when (
    with inserted as (
      insert into public.bookings
        (business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
         service_name, price, customer_name)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
              '44444444-4444-4444-4444-444444444444', 'ffffffff-0000-0000-0000-000000000002',
              '2026-04-10T03:00:00Z', '2026-04-10T04:00:00Z', 'confirmed', 'Cut', 300, 'Ben')
      returning id
    )
    select count(*) from inserted
  ) = 1 then 'a different barber, same business, same exact time slot is allowed'
  else 'FAIL: a different barber at the same time was wrongly refused' end
));

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333', 'ffffffff-0000-0000-0000-000000000002',
            '2026-04-10T03:30:00Z', '2026-04-10T04:30:00Z', 'pending', 'Cut', 300, 'Ann')
  $q$),
  'a pending booking for the second barber also holds that barber''s slot');

-- Unassigned ("any available" never resolved / legacy no-staff path) bookings
-- still coalesce to the nil uuid and conflict with each other, same as before
-- this feature existed.
insert into public.bookings
  (id, business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('dddddddd-0000-0000-0000-000000000011',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', null,
   '2026-04-10T07:00:00Z', '2026-04-10T08:00:00Z', 'confirmed', 'Cut', 300, 'Ann Customer');

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, staff_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444', null,
            '2026-04-10T07:30:00Z', '2026-04-10T08:30:00Z', 'confirmed', 'Cut', 300, 'Ben')
  $q$),
  'two unassigned bookings at the same business still cannot overlap');

-- ---------------------------------------------------------------------------
-- busy_intervals is staff-aware
-- ---------------------------------------------------------------------------
reset role;

select test_assert(
  (select count(*) from public.busy_intervals(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    '2026-04-10T00:00:00Z'::timestamptz, '2026-04-11T00:00:00Z'::timestamptz,
    null, 'ffffffff-0000-0000-0000-000000000001'::uuid
  )) = 1,
  'busy_intervals filtered to one staff member returns only that staff''s own bookings');

select test_assert(
  (select count(*) from public.busy_intervals(
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    '2026-04-10T00:00:00Z'::timestamptz, '2026-04-11T00:00:00Z'::timestamptz
  )) = 3,
  'busy_intervals with no target_staff stays business-wide (back-compat) — '
  'Nong''s, Somchai''s and the one unassigned booking, not the two refused '
  'overlap attempts');
