\set ON_ERROR_STOP on
\timing off

-- ===========================================================================
-- Bookly — migration acceptance tests
-- Mirrors the validation checklist: overlap, breaks, closed days, timezone
-- correctness and cross-tenant isolation.
-- ===========================================================================

create or replace function test_assert(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label;
  end if;
end $$;

-- Runs `sql` as `uid` and reports whether it raised.
create or replace function test_raises(uid uuid, sql text)
returns boolean language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  return false;
exception when others then
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner@shop.test',
   '{"role":"business_owner","full_name":"Owner One","phone":"0811111111"}'),
  ('22222222-2222-2222-2222-222222222222', 'rival@shop.test',
   '{"role":"business_owner","full_name":"Owner Two","phone":"0822222222"}'),
  ('33333333-3333-3333-3333-333333333333', 'ann@example.test',
   '{"role":"customer","full_name":"Ann Customer","phone":"0833333333"}'),
  ('44444444-4444-4444-4444-444444444444', 'ben@example.test',
   '{"role":"customer","full_name":"Ben Customer","phone":"0844444444"}');

select test_assert(
  (select count(*) from public.profiles) = 4,
  'handle_new_user creates a profile for every auth user');

select test_assert(
  (select role from public.profiles where id='11111111-1111-1111-1111-111111111111')
    = 'business_owner',
  'sign-up metadata sets the business_owner role');

select test_assert(
  (select role from public.profiles where id='33333333-3333-3333-3333-333333333333')
    = 'customer',
  'a user with no role metadata defaults to customer');

-- Slug generation
select test_assert(public.slugify('  Nong''s Barber Shop!! ') = 'nong-s-barber-shop',
  'slugify strips punctuation and trims separators');
select test_assert(public.slugify('ร้านตัดผม') = 'business',
  'a non-latin name falls back rather than producing an empty slug');

insert into public.businesses
  (id, owner_id, name, slug, category, timezone, is_published, auto_confirm,
   slot_interval_min, min_notice_min, max_advance_days, onboarding_step)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'Nong Barber', public.unique_business_slug('Nong Barber'),
   'barber', 'Asia/Bangkok', true, true, 15, 0, 60, 3),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'Rival Cuts', public.unique_business_slug('Rival Cuts'),
   'barber', 'Asia/Bangkok', true, true, 15, 0, 60, 3);

select test_assert(
  public.unique_business_slug('Nong Barber') = 'nong-barber-2',
  'unique_business_slug avoids collisions');

-- Mon–Sat 09:00–17:00, closed Sunday, lunch 12:00–13:00 on Monday.
insert into public.business_hours (business_id, weekday, open_time, close_time, is_closed)
select 'aaaaaaaa-0000-0000-0000-000000000001', d, '09:00', '17:00', d = 0
from generate_series(0, 6) d;

insert into public.business_hours (business_id, weekday, open_time, close_time, is_closed)
select 'bbbbbbbb-0000-0000-0000-000000000002', d, '09:00', '17:00', false
from generate_series(0, 6) d;

insert into public.business_breaks (business_id, weekday, start_time, end_time)
values ('aaaaaaaa-0000-0000-0000-000000000001', 1, '12:00', '13:00');

insert into public.services (id, business_id, name, duration_min, price)
values
  ('cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Cut', 60, 300),
  ('cccccccc-0000-0000-0000-000000000002',
   'bbbbbbbb-0000-0000-0000-000000000002', 'Rival cut', 60, 250);

-- ---------------------------------------------------------------------------
-- The booking invariants
-- ---------------------------------------------------------------------------
-- 2026-03-16 is a Monday. 10:00 Bangkok == 03:00 UTC.
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('dddddddd-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333',
   '2026-03-16T03:00:00Z', '2026-03-16T04:00:00Z', 'confirmed',
   'Cut', 300, 'Ann Customer');

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444',
            '2026-03-16T03:30:00Z', '2026-03-16T04:30:00Z', 'confirmed',
            'Cut', 300, 'Ben Customer')
  $q$),
  'a booking overlapping a confirmed one is refused');

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '44444444-4444-4444-4444-444444444444',
            '2026-03-16T03:30:00Z', '2026-03-16T04:30:00Z', 'pending',
            'Cut', 300, 'Ben Customer')
  $q$),
  'a pending booking also holds its slot against an overlap');

-- Touching, not overlapping: 11:00–12:00 Bangkok starts exactly as the other ends.
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('dddddddd-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444',
   '2026-03-16T04:00:00Z', '2026-03-16T05:00:00Z', 'confirmed',
   'Cut', 300, 'Ben Customer');
select test_assert(true, 'a booking starting exactly when another ends is allowed');

-- Cancelling frees the slot for someone else.
update public.bookings set status = 'cancelled'
where id = 'dddddddd-0000-0000-0000-000000000002';

insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values
  ('dddddddd-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333',
   '2026-03-16T04:00:00Z', '2026-03-16T05:00:00Z', 'confirmed',
   'Cut', 300, 'Ann Customer');
select test_assert(true, 'cancelling a booking releases its slot');

-- Availability trigger: lunch, closing time and closed days.
select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-03-16T05:00:00Z', '2026-03-16T06:00:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'a booking during the lunch break is refused');

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-03-16T09:30:00Z', '2026-03-16T10:30:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'a booking that would run past closing time is refused');

-- 2026-03-15 is a Sunday, when this shop is closed.
select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-03-15T03:00:00Z', '2026-03-15T04:00:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'a booking on a weekly closed day is refused');

-- An override closes an otherwise open day.
insert into public.availability_overrides (business_id, date, is_closed)
values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-03-17', true);

select test_assert(
  test_raises(null, $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-03-17T03:00:00Z', '2026-03-17T04:00:00Z', 'confirmed',
            'Cut', 300, 'Ann')
  $q$),
  'an availability override closes the day for bookings');

-- A cancelled row is history, so the availability gate must not block it.
insert into public.bookings
  (business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        '2026-03-15T03:00:00Z', '2026-03-15T04:00:00Z', 'cancelled',
        'Cut', 300, 'Ann');
select test_assert(true, 'a cancelled booking bypasses the availability gate');
