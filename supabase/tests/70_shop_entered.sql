\set ON_ERROR_STOP on

-- ===========================================================================
-- Shop-entered bookings (handoff 11; migration 20261027000000_shop_entered_bookings.sql):
-- the owner books a customer who has no account (phone / LINE / walk-in).
-- Same fixture ids as 10_booking_invariants.sql:
--   11111111...  Nong Barber's owner (business aaaaaaaa...0001, service cccccccc...0001)
--   22222222...  Rival Cuts' owner    (business bbbbbbbb...0002, service cccccccc...0002)
--   33333333...  Ann (customer)
-- Own booking ids (ffffffff-...), and everything inserted here is deleted at
-- the end so later files and the 3x seed bucket see an unchanged table.
-- ===========================================================================

reset role;

-- A rolling future date, 10:00-11:00 Bangkok.
create temp table fut70 as
select (case when extract(dow from current_date + 45) = 0 then current_date + 46
             else current_date + 45 end) as d;
grant select on fut70 to authenticated;

-- ---------------------------------------------------------------------------
-- 1. The owner can enter a booking with no customer account; the database
--    stamps it as shop-entered.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, customer_phone)
select 'ffffffff-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       null,
       (d::timestamp + time '10:00') at time zone 'Asia/Bangkok',
       (d::timestamp + time '11:00') at time zone 'Asia/Bangkok',
       'confirmed', 'Cut', 300, 'Walk-in Wanchai', '0890000001'
from fut70;
reset role;

select test_assert(
  (select source::text from public.bookings where id = 'ffffffff-0000-0000-0000-000000000001') = 'shop'
  and (select customer_id from public.bookings where id = 'ffffffff-0000-0000-0000-000000000001') is null,
  'the owner can enter a booking for a customer with no account; it is stamped source = shop');

-- ---------------------------------------------------------------------------
-- 2. A shop-entered booking cannot overlap another live booking.
-- ---------------------------------------------------------------------------
set role authenticated;
select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    select 'ffffffff-0000-0000-0000-000000000002',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '10:30') at time zone 'Asia/Bangkok',
           (d::timestamp + time '11:30') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Walk-in Clash'
    from fut70
  $q$),
  'a shop-entered booking cannot overlap an existing shop-entered booking');
reset role;

-- A customer's own booking in that slot blocks a shop-entered one too.
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
select 'ffffffff-0000-0000-0000-000000000003',
       'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       '33333333-3333-3333-3333-333333333333',
       (d::timestamp + time '14:00') at time zone 'Asia/Bangkok',
       (d::timestamp + time '15:00') at time zone 'Asia/Bangkok',
       'confirmed', 'Cut', 300, 'Ann Customer'
from fut70;

set role authenticated;
select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    select 'ffffffff-0000-0000-0000-000000000004',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '14:30') at time zone 'Asia/Bangkok',
           (d::timestamp + time '15:30') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Walk-in Clash 2'
    from fut70
  $q$),
  'a shop-entered booking cannot overlap a customer''s booking');

-- Back-to-back (starts exactly when the other ends) is fine.
select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    select 'ffffffff-0000-0000-0000-000000000005',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '11:00') at time zone 'Asia/Bangkok',
           (d::timestamp + time '12:00') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Walk-in Back-to-back'
    from fut70
  $q$),
  'a shop-entered booking may start exactly when another ends');

-- ---------------------------------------------------------------------------
-- 3. Who may enter one.
-- ---------------------------------------------------------------------------
select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    select 'ffffffff-0000-0000-0000-000000000006',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '16:00') at time zone 'Asia/Bangkok',
           (d::timestamp + time '17:00') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Intruder'
    from fut70
  $q$),
  'a rival owner cannot enter a booking at another shop');

select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    select 'ffffffff-0000-0000-0000-000000000007',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '16:00') at time zone 'Asia/Bangkok',
           (d::timestamp + time '17:00') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Customer pretending'
    from fut70
  $q$),
  'a customer cannot create a booking with no customer behind it');
reset role;

-- The database rule underneath: no customer means it must be a shop booking.
select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (id, business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name, source)
    select 'ffffffff-0000-0000-0000-000000000008',
           'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
           null,
           (d::timestamp + time '16:00') at time zone 'Asia/Bangkok',
           (d::timestamp + time '17:00') at time zone 'Asia/Bangkok',
           'confirmed', 'Cut', 300, 'Orphan', 'customer'
    from fut70
  $q$),
  'a booking with no customer and source = customer is refused');

-- ---------------------------------------------------------------------------
-- Clean up.
-- ---------------------------------------------------------------------------
delete from public.bookings where id::text like 'ffffffff-0000-0000-0000-0000000%';
select test_assert(
  (select count(*) from public.bookings where id::text like 'ffffffff-%') = 0,
  'shop-entered fixtures cleaned up');
