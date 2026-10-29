\set ON_ERROR_STOP on

-- ===========================================================================
-- Rescheduling and one-off days.
-- Runs after 20_rls_isolation.sql, which cancelled booking -003 and left
-- -001 (Ann, Mon 16 Mar 10:00–11:00 BKK) live on Nong Barber.
-- ===========================================================================

-- --- busy_intervals: the reschedule path excludes the booking being moved ---
set role authenticated;

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111', $q$
    select count(*) from public.busy_intervals(
      'aaaaaaaa-0000-0000-0000-000000000001',
      '2026-03-16T00:00:00Z', '2026-03-17T00:00:00Z',
      'dddddddd-0000-0000-0000-000000000001')
  $q$) = 0,
  'busy_intervals leaves out the booking being rescheduled');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111', $q$
    select count(*) from public.busy_intervals(
      'aaaaaaaa-0000-0000-0000-000000000001',
      '2026-03-16T00:00:00Z', '2026-03-17T00:00:00Z')
  $q$) = 1,
  'busy_intervals still counts it when nothing is excluded');

-- --- owner reschedule goes through the availability trigger -----------------
select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings
    set starts_at = '2026-03-16T05:00:00Z', ends_at = '2026-03-16T06:00:00Z'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'an owner cannot move a booking into the lunch break');

select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings
    set starts_at = '2026-03-16T09:30:00Z', ends_at = '2026-03-16T10:30:00Z'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'an owner cannot move a booking past closing time');

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings
    set starts_at = '2026-03-16T07:00:00Z', ends_at = '2026-03-16T08:00:00Z'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'an owner can move a booking to a free time inside opening hours');

-- --- availability_overrides: who may write them -----------------------------
select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    insert into public.availability_overrides (business_id, date, is_closed, note)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-01', true, 'hijack')
  $q$) or not exists (
    select 1 from public.availability_overrides
    where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and date = '2026-04-01'),
  'a customer cannot add a closure to a business');

select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    insert into public.availability_overrides (business_id, date, is_closed, note)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-02', true, 'rival')
  $q$) or not exists (
    select 1 from public.availability_overrides
    where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and date = '2026-04-02'),
  'a rival owner cannot add a closure to another business');

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    insert into public.availability_overrides (business_id, date, is_closed, note)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-13', true, 'Songkran')
  $q$),
  'the owner can close a day');

-- Same date again with custom hours: the upsert path the action uses.
select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    insert into public.availability_overrides (business_id, date, is_closed, open_time, close_time)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-13', false, '12:00', '16:00')
    on conflict (business_id, date) do update
      set is_closed = excluded.is_closed,
          open_time = excluded.open_time,
          close_time = excluded.close_time
  $q$),
  'saving the same date again replaces the override');

reset role;

select test_assert(
  (select open_time from public.availability_overrides
   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and date = '2026-04-13') = '12:00',
  'the replaced override carries the custom hours');

select test_assert(
  test_raises(null, $q$
    insert into public.availability_overrides (business_id, date, is_closed, open_time, close_time)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-14', false, '16:00', '12:00')
  $q$),
  'custom hours that close before they open are refused by the schema');

-- A custom-hours override narrows the day for bookings.
select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-04-13T03:00:00Z', '2026-04-13T04:00:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'a booking before a custom late opening is refused');

select test_assert(
  not test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-04-13T06:00:00Z', '2026-04-13T07:00:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'a booking inside the custom hours is accepted');

-- --- the seed -----------------------------------------------------------------
select test_assert(
  (select count(*) from public.profiles where email like '%@tatnat.local') = 2,
  'the seed created the two demo logins with profiles');

select test_assert(
  (select role from public.profiles where email = 'owner@tatnat.local') = 'business_owner',
  'the seeded owner has the business_owner role');

select test_assert(
  (select count(*) from public.businesses b
   join public.profiles p on p.id = b.owner_id
   where p.email = 'owner@tatnat.local' and b.is_published) = 2,
  'the seeded owner has two published businesses');

select test_assert(
  (select count(*) from public.services s
   join public.businesses b on b.id = s.business_id
   join public.profiles p on p.id = b.owner_id
   where p.email = 'owner@tatnat.local') = 7,
  'the seed created seven services');
