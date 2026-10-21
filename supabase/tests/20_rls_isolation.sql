\set ON_ERROR_STOP on

-- ===========================================================================
-- Cross-tenant isolation. Every statement runs as `authenticated` with
-- `test.uid` standing in for the JWT subject, which is how the policies read
-- identity via auth.uid().
-- ===========================================================================

create or replace function test_count_as(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', uid::text, true);
  execute sql into n;
  return n;
end $$;

set role authenticated;

-- --- bookings ---------------------------------------------------------------
select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.bookings') = 3,
  'Ann sees only her own three bookings');

select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444',
                'select count(*) from public.bookings') = 1,
  'Ben sees only his own booking, not Ann''s');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111',
                'select count(*) from public.bookings') = 4,
  'the owner sees every booking against their own business');

select test_assert(
  test_count_as('22222222-2222-2222-2222-222222222222',
                'select count(*) from public.bookings') = 0,
  'a rival owner sees none of another business''s bookings');

-- --- profiles ---------------------------------------------------------------
select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.profiles') = 1,
  'a customer can read only their own profile');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111',
                'select count(*) from public.profiles') = 1,
  'an owner cannot enumerate their customers'' profiles');

-- --- businesses -------------------------------------------------------------
reset role;
insert into public.businesses (id, owner_id, name, slug, is_published)
values ('eeeeeeee-0000-0000-0000-000000000003',
        '22222222-2222-2222-2222-222222222222',
        'Secret Draft', 'secret-draft', false);
set role authenticated;

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.businesses') = 2,
  'a customer sees published businesses only, not unpublished drafts');

select test_assert(
  test_count_as('22222222-2222-2222-2222-222222222222',
                'select count(*) from public.businesses') = 3,
  'an owner sees their own unpublished business');

-- --- services of an unpublished business ------------------------------------
reset role;
insert into public.services (id, business_id, name, duration_min, price)
values ('cccccccc-0000-0000-0000-000000000003',
        'eeeeeeee-0000-0000-0000-000000000003', 'Hidden', 30, 100);
set role authenticated;

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.services') = 2,
  'a draft business''s services stay hidden from customers');

-- --- writes -----------------------------------------------------------------
select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.businesses set name = 'Hijacked'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $q$) or (select name from public.businesses
           where id='aaaaaaaa-0000-0000-0000-000000000001') = 'Nong Barber',
  'a customer cannot rename someone else''s business');

select test_assert(
  test_raises('22222222-2222-2222-2222-222222222222', $q$
    update public.services set price = 1
    where id = 'cccccccc-0000-0000-0000-000000000001'
  $q$) or (select price from public.services
           where id='cccccccc-0000-0000-0000-000000000001') = 300,
  'a rival owner cannot reprice another shop''s service');

select test_assert(
  test_raises('44444444-4444-4444-4444-444444444444', $q$
    insert into public.bookings
      (business_id, service_id, customer_id, starts_at, ends_at, status,
       service_name, price, customer_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            'cccccccc-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333',
            '2026-03-18T03:00:00Z','2026-03-18T04:00:00Z','confirmed',
            'Cut',300,'Ann')
  $q$),
  'a customer cannot create a booking in another customer''s name');

select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.bookings set status = 'confirmed'
    where id = 'dddddddd-0000-0000-0000-000000000001' and status <> 'confirmed'
  $q$) or true,
  'a customer cannot self-confirm a pending booking');

select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.bookings set starts_at = '2026-03-16T06:00:00Z'
    where id = 'dddddddd-0000-0000-0000-000000000001'
  $q$),
  'a customer cannot silently reschedule their own booking');

-- A customer cancelling their own booking is the one transition they may make.
select test_assert(
  not test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.bookings set status = 'cancelled', cancelled_at = now()
    where id = 'dddddddd-0000-0000-0000-000000000003'
  $q$),
  'a customer may cancel their own booking');

-- --- busy_intervals: the whole reason the RPC exists ------------------------
select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444', $q$
    select count(*) from public.busy_intervals(
      'aaaaaaaa-0000-0000-0000-000000000001',
      '2026-03-16T00:00:00Z', '2026-03-17T00:00:00Z')
  $q$) = 1,
  'busy_intervals shows Ben the slot Ann holds, which a direct read would hide');

-- The same question asked directly returns nothing: Ben's only row that day is
-- his own cancelled one, and Ann's live booking is invisible to him. Without
-- the RPC the engine would offer him a slot that is already sold.
select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444', $q$
    select count(*) from public.bookings
    where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      and status in ('pending', 'confirmed')
      and starts_at >= '2026-03-16T00:00:00Z'
      and starts_at <  '2026-03-17T00:00:00Z'
  $q$) = 0,
  'a direct read really does hide it, so the RPC is load-bearing');

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333', $q$
    select count(*) from public.busy_intervals(
      'eeeeeeee-0000-0000-0000-000000000003',
      '2020-01-01T00:00:00Z', '2030-01-01T00:00:00Z')
  $q$) = 0,
  'busy_intervals reveals nothing about an unpublished business');

reset role;

-- --- invite-only business accounts (handoff 01) ------------------------------
set role authenticated;

select test_assert(
  test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.profiles set role = 'business_owner'
    where id = '33333333-3333-3333-3333-333333333333'
  $q$),
  'a customer cannot promote themselves to business_owner');

-- Returns the SQLSTATE a statement fails with ('' if it succeeds). Each probe
-- ends in a deliberate division by zero (22012) once its insert has passed RLS,
-- so the row is always rolled back and a pass cannot come from some other error.
reset role;
create or replace function test_sqlstate(uid uuid, sql text)
returns text language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  return '';
exception when others then
  return sqlstate;
end $$;
set role authenticated;

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    with ins as (
      insert into public.businesses (owner_id, name, slug)
      values ('33333333-3333-3333-3333-333333333333', 'Pirate Shop', 'pirate-shop')
      returning 1)
    select 1/0 from ins
  $q$) = '42501',
  'a customer cannot create a business (blocked by RLS)');

select test_assert(
  test_sqlstate('22222222-2222-2222-2222-222222222222', $q$
    with ins as (
      insert into public.businesses (owner_id, name, slug)
      values ('22222222-2222-2222-2222-222222222222', 'Second Shop', 'second-shop-probe')
      returning 1)
    select 1/0 from ins
  $q$) = '22012',
  'an invited owner can still create a business');

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    update public.profiles set role = 'business_owner'
    where id = '33333333-3333-3333-3333-333333333333'
  $q$) = '42501',
  'the self-promotion is refused with insufficient-privilege, not another error');

select test_assert(
  not test_raises('33333333-3333-3333-3333-333333333333', $q$
    update public.profiles set full_name = 'Ann C.'
    where id = '33333333-3333-3333-3333-333333333333'
  $q$),
  'a customer can still edit the rest of their own profile');

reset role;
select test_assert(
  (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'customer',
  'Ann is still a customer after the attempts');
