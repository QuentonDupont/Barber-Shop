\set ON_ERROR_STOP on

-- ===========================================================================
-- Beta operations must-haves (handoff 10; migration 20261026000000_beta_ops.sql):
--   booking source flag, no-show guard, health_check(), weekly metrics views.
-- Same fixture ids as 10_booking_invariants.sql:
--   11111111...  Nong Barber's owner (business aaaaaaaa...0001, service cccccccc...0001)
--   22222222...  Rival Cuts' owner    (business bbbbbbbb...0002, service cccccccc...0002)
--   33333333...  Ann (customer)       44444444...  Ben (customer)
-- Own booking ids (eeeeeeee-...), own dates (Feb/Mar 2026 and a rolling future
-- date), and everything inserted here is deleted at the end, so the seed-
-- dependent 3x bucket and the other files see an unchanged table.
-- ===========================================================================

reset role;

create or replace function test_count_as60(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql into n;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Booking source
-- ---------------------------------------------------------------------------
select test_assert(
  (select count(*) from public.bookings where source is null) = 0
  and (select count(*) from public.bookings where source = 'shop') = 0,
  'every pre-existing booking defaults to source = customer');

-- A rolling future date (non-Sunday; Nong Barber is closed Sundays), 10:00 Bangkok = 03:00Z.
create temp table fut as
select (case when extract(dow from current_date + 30) = 0 then current_date + 31
             else current_date + 30 end) as d;
grant select on fut to authenticated;

-- Ann (customer) inserts, claiming source = 'shop'. Must be stored as customer.
set role authenticated;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, source)
select 'eeeeeeee-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       '33333333-3333-3333-3333-333333333333',
       (d::timestamp + time '10:00') at time zone 'Asia/Bangkok',
       (d::timestamp + time '11:00') at time zone 'Asia/Bangkok',
       'confirmed', 'Cut', 300, 'Ann Customer', 'shop'
from fut;
select set_config('test.uid', '', false);
reset role;

select test_assert(
  (select source::text from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000001') = 'customer',
  'a customer cannot spoof source = shop on insert (stored as customer)');

-- Privileged insert (no signed-in user): explicit value is kept.
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, source)
select 'eeeeeeee-0000-0000-0000-000000000002',
       'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       '44444444-4444-4444-4444-444444444444',
       (d::timestamp + time '14:00') at time zone 'Asia/Bangkok',
       (d::timestamp + time '15:00') at time zone 'Asia/Bangkok',
       'confirmed', 'Cut', 300, 'Ben Customer', 'shop'
from fut;
select test_assert(
  (select source::text from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000002') = 'shop',
  'a privileged insert with source = shop keeps it (future shop-entry / import path)');

set role authenticated;
select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set source = 'customer'
    where id = 'eeeeeeee-0000-0000-0000-000000000002'
  $q$),
  'the owner cannot change a booking''s source');
select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.bookings set source = 'shop'
    where id = 'eeeeeeee-0000-0000-0000-000000000001'
  $q$),
  'a customer cannot change their booking''s source');

-- ---------------------------------------------------------------------------
-- 2. No-show guard
-- ---------------------------------------------------------------------------
-- Started bookings (past Tuesdays, 10:00 Bangkok; Nong Barber is open Tue 09-17).
reset role;
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('eeeeeeee-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   '2026-03-24T03:00:00Z', '2026-03-24T04:00:00Z', 'confirmed', 'Cut', 300, 'Ann Customer'),
  ('eeeeeeee-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   '2026-03-24T05:00:00Z', '2026-03-24T06:00:00Z', 'cancelled', 'Cut', 300, 'Ann Customer'),
  ('eeeeeeee-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
   '2026-03-24T07:00:00Z', '2026-03-24T08:00:00Z', 'completed', 'Cut', 300, 'Ann Customer');

set role authenticated;

select test_raises('22222222-2222-2222-2222-222222222222', $q$
  update public.bookings set status = 'no_show'
  where id = 'eeeeeeee-0000-0000-0000-000000000010'
$q$) as rival_attempt_ignored;
reset role;
select test_assert(
  (select status::text from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000010') = 'confirmed',
  'a rival owner cannot mark another shop''s booking no-show');
set role authenticated;

select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.bookings set status = 'no_show'
    where id = 'eeeeeeee-0000-0000-0000-000000000010'
  $q$),
  'a customer still cannot mark their own booking no-show');

select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set status = 'no_show'
    where id = 'eeeeeeee-0000-0000-0000-000000000001'
  $q$),
  'the owner cannot mark a FUTURE booking no-show');

select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set status = 'no_show'
    where id = 'eeeeeeee-0000-0000-0000-000000000011'
  $q$),
  'the owner cannot mark a cancelled booking no-show');

select test_assert(
  test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set status = 'no_show'
    where id = 'eeeeeeee-0000-0000-0000-000000000012'
  $q$),
  'the owner cannot mark a completed booking no-show');

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set status = 'no_show'
    where id = 'eeeeeeee-0000-0000-0000-000000000010'
  $q$),
  'the owner can mark a started confirmed booking no-show');

reset role;
select test_assert(
  (select status::text from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000010') = 'no_show',
  'the no-show actually stuck');
set role authenticated;

select test_assert(
  not test_raises('11111111-1111-1111-1111-111111111111', $q$
    update public.bookings set status = 'confirmed'
    where id = 'eeeeeeee-0000-0000-0000-000000000010'
  $q$),
  'the owner can undo a no-show back to confirmed');
reset role;
select test_assert(
  (select status::text from public.bookings where id = 'eeeeeeee-0000-0000-0000-000000000010') = 'confirmed',
  'the undo actually stuck');

-- ---------------------------------------------------------------------------
-- 3. health_check()
-- ---------------------------------------------------------------------------
set role anon;
select test_assert(
  (public.health_check() ->> 'ok')::boolean,
  'health_check() is callable by anon and reports ok');
select test_assert(
  (select array_agg(k order by k) from jsonb_object_keys(public.health_check()) k)
    = array['checked_at', 'ok'],
  'health_check() exposes nothing but ok and a timestamp');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Weekly metrics. Week of Monday 2026-02-02 (Bangkok), two shops.
--    Nong Barber:  customer x3 (completed, no_show, confirmed), customer
--                  cancelled x1, shop x2 (completed, confirmed)
--                  -> total 5, customer 3, shop 2, completed 2, no_show 1,
--                     cancelled 1, rate 1/3, active.
--    Rival Cuts:   customer x2, shop x5 (all one Tuesday, 09:00-16:00)
--                  -> total 7, customer 2, shop 5, NOT active.
-- ---------------------------------------------------------------------------
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, source)
values
  ('eeeeeeee-0000-0000-0000-000000000020','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','2026-02-03T03:00:00Z','2026-02-03T04:00:00Z','completed','Cut',300,'Ann','customer'),
  ('eeeeeeee-0000-0000-0000-000000000021','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','2026-02-04T03:00:00Z','2026-02-04T04:00:00Z','no_show','Cut',300,'Ann','customer'),
  ('eeeeeeee-0000-0000-0000-000000000022','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','2026-02-05T03:00:00Z','2026-02-05T04:00:00Z','confirmed','Cut',300,'Ben','customer'),
  ('eeeeeeee-0000-0000-0000-000000000023','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','2026-02-06T03:00:00Z','2026-02-06T04:00:00Z','cancelled','Cut',300,'Ben','customer'),
  ('eeeeeeee-0000-0000-0000-000000000024','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','2026-02-07T03:00:00Z','2026-02-07T04:00:00Z','completed','Cut',300,'Walk-in','shop'),
  ('eeeeeeee-0000-0000-0000-000000000025','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','2026-02-07T04:00:00Z','2026-02-07T05:00:00Z','confirmed','Cut',300,'Walk-in','shop');

insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, source)
select ('eeeeeeee-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
       'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002',
       '33333333-3333-3333-3333-333333333333',
       ('2026-02-03T02:00:00Z'::timestamptz + make_interval(hours => n)),
       ('2026-02-03T03:00:00Z'::timestamptz + make_interval(hours => n)),
       'confirmed', 'Rival cut', 250, 'X',
       case when n < 2 then 'customer' else 'shop' end::public.booking_source
from generate_series(0, 6) n;

select test_assert(
  (select count(*) from public.beta_weekly_shop_metrics where week_start = '2026-02-02') = 2,
  'one metrics row per shop per week (privileged role sees both shops)');

select test_assert(
  (select (bookings_total, customer_booked, shop_entered, completed, no_shows, cancelled)::text
   from public.beta_weekly_shop_metrics
   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and week_start = '2026-02-02')
  = '(5,3,2,2,1,1)',
  'Nong Barber''s week counts match the hand count');

select test_assert(
  (select no_show_rate from public.beta_weekly_shop_metrics
   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and week_start = '2026-02-02') = 0.333,
  'no-show rate = no_shows / (completed + no_shows)');

select test_assert(
  (select is_weekly_active from public.beta_weekly_shop_metrics
   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and week_start = '2026-02-02'),
  '3 customer-made bookings make a shop weekly-active');

select test_assert(
  (select (bookings_total, customer_booked, shop_entered, is_weekly_active)::text
   from public.beta_weekly_shop_metrics
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002' and week_start = '2026-02-02')
  = '(7,2,5,f)',
  '2 customer + 5 shop-entered bookings is NOT weekly-active');

select test_assert(
  (select (shops_with_bookings, active_shops, bookings_total, customer_booked, shop_entered, no_shows)::text
   from public.beta_weekly_totals where week_start = '2026-02-02')
  = '(2,1,12,5,7,1)',
  'weekly totals: 2 shops with bookings, 1 active, 12 bookings (5 customer, 7 shop), 1 no-show');

select test_assert(
  (select onboarded_shops from public.beta_weekly_totals where week_start = '2026-02-02') >= 0,
  'weekly totals report onboarded_shops');

-- Row-level security carries through the views (security_invoker).
set role authenticated;
select test_assert(
  test_count_as60('11111111-1111-1111-1111-111111111111',
    $q$select count(*) from public.beta_weekly_shop_metrics where week_start = '2026-02-02'$q$) = 1,
  'an owner sees only their own shop in the weekly metrics');
select test_assert(
  test_count_as60('22222222-2222-2222-2222-222222222222',
    $q$select count(*) from public.beta_weekly_shop_metrics
       where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 0,
  'a rival owner cannot see another shop''s weekly metrics');
select test_assert(
  test_count_as60('33333333-3333-3333-3333-333333333333',
    $q$select count(*) from public.beta_weekly_shop_metrics$q$) = 0,
  'a customer sees no weekly metrics');
reset role;

set role anon;
select test_assert(
  test_raises(null, $q$select count(*) from public.beta_weekly_shop_metrics$q$),
  'anon has no access to the weekly metrics view');
select test_assert(
  test_raises(null, $q$select count(*) from public.beta_weekly_totals$q$),
  'anon has no access to the weekly totals view');
reset role;

-- ---------------------------------------------------------------------------
-- Clean up so other files (and the 3x seed bucket) see an unchanged table.
-- ---------------------------------------------------------------------------
delete from public.bookings where id::text like 'eeeeeeee-0000-0000-0000-0000000%';
select test_assert(
  (select count(*) from public.bookings where id::text like 'eeeeeeee-%') = 0,
  'beta-ops fixtures cleaned up');
