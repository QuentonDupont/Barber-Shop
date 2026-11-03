\set ON_ERROR_STOP on

-- ===========================================================================
-- Billing core (tatnat-accounts-billing handoff 05; migration
-- 20261103000000_billing_core.sql): RLS on billing rows, the barber limit,
-- lapsed = Free (never "off"), downgrade, invoice numbers and amounts.
-- Same fixtures as 10_booking_invariants.sql:
--   11111111...  Nong Barber's owner (business aaaaaaaa...0001)
--   22222222...  Rival Cuts' owner    (business bbbbbbbb...0002; no staff anywhere else)
--   33333333...  Ann (customer)       44444444...  Ben (customer)
-- Own ids: dddddddd-... (invoices), 8888....-... (staff); invoice year 2099.
-- Everything inserted here is removed at the end.
-- ===========================================================================

reset role;

create or replace function test_count_as80(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql into n;
  return n;
end $$;

-- The error text a statement raises as `uid`, or null if it succeeds.
create or replace function test_error_as80(uid uuid, sql text)
returns text language plpgsql security invoker as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

grant execute on function test_count_as80(uuid, text), test_error_as80(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------
select test_assert(
  (select count(*) from public.subscriptions
   where business_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
     and plan_id = 'free' and status = 'active' and provider = 'mock') = 2,
  'every business gets a Free subscription automatically');

select test_assert(
  (select count(*) from public.businesses b
   where not exists (select 1 from public.subscriptions s where s.business_id = b.id)) = 0,
  'no business is without a subscription row');

select test_assert(
  (select string_agg(id || ':' || price_satang || ':' || max_staff, ',' order by sort) from public.plans)
    = 'free:0:2,pro:49000:5,studio:99000:15',
  'plans carry the approved prices and barber limits (decision 25)');

select test_assert(
  (select vat_enabled from public.billing_settings) = false
  and (select vat_rate_bp from public.billing_settings) = 700,
  'VAT handling is off by default (7% ready for registration)');

select test_assert(
  test_error_as80(null, $q$update public.subscriptions set provider = 'omise'
                            where business_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$) is not null,
  'a non-mock provider is refused by the database');

select test_assert(
  test_error_as80(null, $q$update public.subscriptions set status = 'past_due'
                            where business_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$) is not null,
  'past_due without a grace end is refused');

select test_assert(
  test_error_as80(null, $q$update public.subscriptions set founding = true
                            where business_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$) is not null,
  'a founding offer on the Free plan is refused');

-- ---------------------------------------------------------------------------
-- Invoice fixtures (superuser, as the billing job would). Year 2099.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  select * into r from public.allocate_invoice_number(2099);
  insert into public.invoices
    (id, business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, total_satang, payment_ref)
  values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
          2099, r.seq, r.number, 'receipt', '2099-01-03', '2099-01-03', '2099-02-02',
          49000, 49000, 'mock_ch_1');
  insert into public.invoice_lines (invoice_id, position, description_th, description_en, quantity, unit_satang, amount_satang)
  values ('dddddddd-0000-0000-0000-000000000001', 1, 'แพ็กเกจ โปร รายเดือน', 'Pro plan, monthly', 1, 49000, 49000);

  select * into r from public.allocate_invoice_number(2099);
  insert into public.invoices
    (id, business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, total_satang, payment_ref)
  values ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
          2099, r.seq, r.number, 'receipt', '2099-01-04', '2099-01-04', '2099-02-03',
          99000, 99000, 'mock_ch_2');
  insert into public.invoice_lines (invoice_id, position, description_th, description_en, quantity, unit_satang, amount_satang)
  values ('dddddddd-0000-0000-0000-000000000002', 1, 'แพ็กเกจ สตูดิโอ รายเดือน', 'Studio plan, monthly', 1, 99000, 99000);
end $$;

select test_assert(
  (select string_agg(number, ',' order by seq) from public.invoices where year = 2099)
    = 'TN-2099-000001,TN-2099-000002',
  'invoice numbers are sequential from 1 with the agreed format');

select test_assert(
  (select (select count(*) from public.allocate_invoice_number(2100))) = 1
  and (select last_seq from public.invoice_counters where year = 2100) = 1,
  'a new year restarts at 1');

select test_assert(
  test_error_as80(null, $q$insert into public.invoices
    (business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, vat_satang, total_satang, payment_ref)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2099, 90, 'TN-2099-000090', 'receipt',
            '2099-01-05', '2099-01-05', '2099-02-04', 45000, 0, 49000, 'x')$q$) is not null,
  'an invoice whose parts do not add up is refused');

select test_assert(
  test_error_as80(null, $q$insert into public.invoices
    (business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, vat_satang, vat_applied, total_satang, payment_ref)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2099, 91, 'TN-2099-000091', 'receipt',
            '2099-01-05', '2099-01-05', '2099-02-04', 45794, 3206, false, 49000, 'x')$q$) is not null,
  'VAT amounts are refused while VAT is not applied');

select test_assert(
  test_error_as80(null, $q$insert into public.invoices
    (business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, total_satang, payment_ref)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2099, 3, 'TN-2099-WRONG', 'receipt',
            '2099-01-05', '2099-01-05', '2099-02-04', 49000, 49000, 'x')$q$) is not null,
  'a number that does not match year and sequence is refused');

select test_assert(
  test_error_as80(null, $q$insert into public.invoices
    (business_id, year, seq, number, kind, issue_date, period_start, period_end,
     subtotal_satang, total_satang, payment_ref)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2099, 1, 'TN-2099-000001', 'receipt',
            '2099-01-05', '2099-01-05', '2099-02-04', 49000, 49000, 'x')$q$) is not null,
  'a duplicate invoice number is refused');

-- ---------------------------------------------------------------------------
-- RLS: an owner sees only their own business's billing
-- ---------------------------------------------------------------------------
set role authenticated;

select test_assert(
  test_count_as80('11111111-1111-1111-1111-111111111111',
        $q$select count(*) from public.subscriptions
           where business_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')$q$) = 1
  and test_count_as80('11111111-1111-1111-1111-111111111111',
        $q$select count(*) from public.subscriptions where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 1,
  'owner A sees exactly their own subscription');

select test_assert(
  test_count_as80('11111111-1111-1111-1111-111111111111', 'select count(*) from public.invoices') = 1
  and test_count_as80('11111111-1111-1111-1111-111111111111',
        $q$select count(*) from public.invoices where id = 'dddddddd-0000-0000-0000-000000000002'$q$) = 0,
  'owner A sees their own invoice and not owner B''s');

select test_assert(
  test_count_as80('11111111-1111-1111-1111-111111111111', 'select count(*) from public.invoice_lines') = 1,
  'owner A sees only their own invoice lines');

select test_assert(
  test_count_as80('22222222-2222-2222-2222-222222222222', 'select count(*) from public.invoices') = 1
  and test_count_as80('22222222-2222-2222-2222-222222222222',
        $q$select count(*) from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'$q$) = 0
  and test_count_as80('22222222-2222-2222-2222-222222222222', 'select count(*) from public.invoice_lines') = 1,
  'owner B sees only their own invoices and lines');

select test_assert(
  test_count_as80('33333333-3333-3333-3333-333333333333', 'select count(*) from public.subscriptions') = 0
  and test_count_as80('33333333-3333-3333-3333-333333333333', 'select count(*) from public.invoices') = 0
  and test_count_as80('33333333-3333-3333-3333-333333333333', 'select count(*) from public.invoice_lines') = 0,
  'a customer sees no subscription, invoice or line');

select test_assert(
  test_error_as80('11111111-1111-1111-1111-111111111111', 'select count(*) from public.billing_settings') is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111', 'select count(*) from public.billing_events') is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111', 'select count(*) from public.invoice_counters') is not null,
  'settings, the job log and the counters are not readable by browser roles');

select test_assert(
  test_count_as80('33333333-3333-3333-3333-333333333333', 'select count(*) from public.plans') = 3,
  'the price list is readable by a signed-in user');

-- Writes are service-role only.
select test_assert(
  test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$update public.subscriptions set plan_id = 'studio' where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$insert into public.subscriptions (business_id, plan_id, status)
       values ('aaaaaaaa-0000-0000-0000-000000000001', 'studio', 'active')$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$delete from public.subscriptions where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) is not null,
  'an owner cannot upgrade themselves: no insert, update or delete on subscriptions');

select test_assert(
  test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$update public.invoices set total_satang = 1 where id = 'dddddddd-0000-0000-0000-000000000001'$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$delete from public.invoices where id = 'dddddddd-0000-0000-0000-000000000001'$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$insert into public.invoices (business_id, year, seq, number, kind, issue_date, period_start, period_end,
         subtotal_satang, total_satang, payment_ref)
       values ('aaaaaaaa-0000-0000-0000-000000000001', 2099, 50, 'TN-2099-000050', 'receipt',
               '2099-01-05', '2099-01-05', '2099-02-04', 1, 1, 'x')$q$) is not null,
  'an owner cannot create, change or delete invoices');

select test_assert(
  test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$update public.plans set max_staff = 99 where id = 'free'$q$) is not null,
  'nobody in the browser can edit the price list');

select test_assert(
  test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$select public.allocate_invoice_number(2099)$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$select public.apply_free_limits('aaaaaaaa-0000-0000-0000-000000000001')$q$) is not null
  and test_error_as80('11111111-1111-1111-1111-111111111111',
    $q$select public.effective_plan_id('aaaaaaaa-0000-0000-0000-000000000001')$q$) is not null,
  'invoice numbering, downgrade and the raw plan lookup are service-role only');

-- The owner's own view of the plan in force.
reset role;
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select test_assert(
  public.my_effective_plan('aaaaaaaa-0000-0000-0000-000000000001') = 'free'
  and public.my_effective_plan('bbbbbbbb-0000-0000-0000-000000000002') is null,
  'an owner can read the plan in force for their own business and nobody else''s');
select set_config('test.uid', '', false);
reset role;

-- ---------------------------------------------------------------------------
-- The plan in force: unpaid or lapsed is Free, never "off"
-- ---------------------------------------------------------------------------
select test_assert(public.effective_plan_id(gen_random_uuid()) = 'free',
  'no subscription row resolves to Free');

update public.subscriptions set plan_id = 'pro', status = 'trialing', founding = true
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(public.effective_plan_id('bbbbbbbb-0000-0000-0000-000000000002') = 'pro',
  'trialing resolves to the plan');

update public.subscriptions set status = 'active', founding = false
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(public.effective_plan_id('bbbbbbbb-0000-0000-0000-000000000002') = 'pro',
  'active resolves to the plan');

update public.subscriptions set status = 'grace', grace_until = now() + interval '3 days'
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(public.effective_plan_id('bbbbbbbb-0000-0000-0000-000000000002') = 'pro',
  'paid extras keep working inside the grace period');

update public.subscriptions set grace_until = now() - interval '1 minute'
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(public.effective_plan_id('bbbbbbbb-0000-0000-0000-000000000002') = 'free',
  'a grace period that has ended resolves to Free even if the job has not run yet');

update public.subscriptions set status = 'downgraded', plan_id = 'free', previous_plan_id = 'pro', grace_until = null
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(public.effective_plan_id('bbbbbbbb-0000-0000-0000-000000000002') = 'free',
  'downgraded resolves to Free');

-- ---------------------------------------------------------------------------
-- The barber limit (Rival Cuts has no staff elsewhere in the suite)
-- ---------------------------------------------------------------------------
select test_assert(
  (select count(*) from public.staff where business_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'fixture: Rival Cuts starts with no barbers');

insert into public.staff (id, business_id, name, created_at) values
  ('88888888-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B1', now() - interval '5 days'),
  ('88888888-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'B2', now() - interval '4 days');

select test_assert(
  (select count(*) from public.staff where business_id = 'bbbbbbbb-0000-0000-0000-000000000002' and is_active) = 2,
  'Free allows two active barbers');

select test_assert(
  test_error_as80(null, $q$insert into public.staff (business_id, name)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'B3')$q$) like 'staff_limit_exceeded%',
  'a third active barber is rejected on Free (privileged path)');

set role authenticated;
select test_assert(
  test_error_as80('22222222-2222-2222-2222-222222222222', $q$insert into public.staff (business_id, name)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'B3')$q$) like 'staff_limit_exceeded%',
  'a third active barber is rejected for the owner, with the upgrade message');
select test_assert(
  test_error_as80('22222222-2222-2222-2222-222222222222',
     $q$update public.staff set name = 'B1 renamed' where id = '88888888-0000-0000-0000-000000000001'$q$) is null,
  'renaming an existing barber is never blocked');
reset role;

insert into public.staff (id, business_id, name, is_active, created_at)
values ('88888888-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'B3 off', false, now() - interval '3 days');
select test_assert(
  test_error_as80(null, $q$update public.staff set is_active = true
     where id = '88888888-0000-0000-0000-000000000003'$q$) like 'staff_limit_exceeded%',
  'switching a third barber back on is rejected on Free');

-- Upgrade: five allowed, a sixth is not.
update public.subscriptions set plan_id = 'pro', status = 'active', previous_plan_id = null
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(
  test_error_as80(null, $q$update public.staff set is_active = true
     where id = '88888888-0000-0000-0000-000000000003'$q$) is null,
  'the same barber can be switched on once the shop is on Pro');
insert into public.staff (id, business_id, name, created_at) values
  ('88888888-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'B4', now() - interval '2 days'),
  ('88888888-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'B5', now() - interval '1 day');
select test_assert(
  test_error_as80(null, $q$insert into public.staff (business_id, name)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'B6')$q$) like 'staff_limit_exceeded%',
  'a sixth active barber is rejected on Pro');

-- Studio takes more.
update public.subscriptions set plan_id = 'studio' where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(
  test_error_as80(null, $q$insert into public.staff (id, business_id, name)
     values ('88888888-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000002', 'B6')$q$) is null,
  'Studio allows more than five');

-- ---------------------------------------------------------------------------
-- Downgrade: nothing deleted, nothing unpublished, extras hidden
-- ---------------------------------------------------------------------------
select is_published as was_published from public.businesses
  where id = 'bbbbbbbb-0000-0000-0000-000000000002' \gset

update public.subscriptions
   set plan_id = 'free', previous_plan_id = 'studio', status = 'downgraded'
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select test_assert(
  public.apply_free_limits('bbbbbbbb-0000-0000-0000-000000000002') = 4,
  'downgrading six active barbers deactivates four');
select test_assert(
  (select string_agg(name, ',' order by name) from public.staff
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002' and is_active) = 'B1 renamed,B2',
  'by default the two oldest barbers stay active');
select test_assert(
  (select count(*) from public.staff where business_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 6,
  'no barber record is deleted by a downgrade');
select test_assert(
  (select is_published from public.businesses where id = 'bbbbbbbb-0000-0000-0000-000000000002') = :'was_published',
  'a downgrade never changes whether the shop is published');

-- Back up to Studio with everyone active, then downgrade with the owner's pick.
update public.subscriptions set plan_id = 'studio', status = 'active', previous_plan_id = null
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.staff set is_active = true where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.subscriptions set plan_id = 'free', previous_plan_id = 'studio', status = 'downgraded'
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select test_assert(
  public.apply_free_limits('bbbbbbbb-0000-0000-0000-000000000002',
    array['88888888-0000-0000-0000-000000000006', '88888888-0000-0000-0000-000000000005']::uuid[]) = 4
  and (select string_agg(name, ',' order by name) from public.staff
       where business_id = 'bbbbbbbb-0000-0000-0000-000000000002' and is_active) = 'B5,B6',
  'the owner''s choice of who stays is honoured');
select test_assert(
  public.apply_free_limits('bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'running the downgrade again changes nothing');

-- ---------------------------------------------------------------------------
-- A lapsed shop still takes bookings from customers (plan never touches them)
-- ---------------------------------------------------------------------------
update public.subscriptions set plan_id = 'free', status = 'downgraded', previous_plan_id = 'pro'
 where business_id = 'aaaaaaaa-0000-0000-0000-000000000001';

create temp table fut80 as
select (case when extract(dow from current_date + 21) = 0 then current_date + 22
             else current_date + 21 end) as d;
grant select on fut80 to authenticated;

select is_published as nong_published from public.businesses
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' \gset

set role authenticated;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name)
select 'dddddddd-0000-0000-0000-0000000000b1',
       'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
       '33333333-3333-3333-3333-333333333333',
       (d::timestamp + time '10:00') at time zone 'Asia/Bangkok',
       (d::timestamp + time '11:00') at time zone 'Asia/Bangkok',
       'confirmed', 'Cut', 300, 'Ann Customer'
from fut80;
select set_config('test.uid', '', false);
reset role;

select test_assert(
  (select count(*) from public.bookings where id = 'dddddddd-0000-0000-0000-0000000000b1') = 1,
  'a customer can still book a shop whose subscription was downgraded');
select test_assert(
  (select is_published from public.businesses where id = 'aaaaaaaa-0000-0000-0000-000000000001') = :'nong_published',
  'the downgraded shop is exactly as published as before');

-- ---------------------------------------------------------------------------
-- Clean up so later files see an unchanged database.
-- ---------------------------------------------------------------------------
delete from public.bookings where id = 'dddddddd-0000-0000-0000-0000000000b1';
delete from public.staff where id::text like '88888888-0000-0000-0000-%';
delete from public.invoices where id::text like 'dddddddd-0000-0000-0000-00000000000%';
delete from public.invoice_counters where year in (2099, 2100);
update public.subscriptions
   set plan_id = 'free', status = 'active', previous_plan_id = null, founding = false,
       grace_until = null
 where business_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select test_assert(
  (select count(*) from public.invoices) = 0
  and (select count(*) from public.staff where business_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'billing fixtures cleaned up');
