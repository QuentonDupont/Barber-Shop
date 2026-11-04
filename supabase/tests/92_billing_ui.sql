\set ON_ERROR_STOP on

-- ===========================================================================
-- Billing screens support (tatnat-accounts-billing handoff 07; migration
-- 20261104000002_billing_ui.sql): N2 founding cap without a settings row, A6
-- invoice lines vs subtotal, N1 one refund per invoice, payment_methods RLS.
-- Same fixtures as 10_booking_invariants.sql:
--   11111111...  Nong Barber's owner (business aaaaaaaa...0001)
--   22222222...  Rival Cuts' owner    (business bbbbbbbb...0002)
--   33333333...  Ann (customer)
-- Own ids: dddddddd-0000-0000-0000-0000000001xx (invoices, year 2098).
-- Everything inserted here is removed at the end.
-- ===========================================================================

reset role;

create or replace function test_count_as92(uid uuid, sql text)
returns bigint language plpgsql security invoker as $$
declare n bigint;
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql into n;
  return n;
end $$;

create or replace function test_error_as92(uid uuid, sql text)
returns text language plpgsql security invoker as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), true);
  execute sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- Run an invoice insert and its lines insert, then force the commit-time check.
create or replace function test_invoice_error92(inv_sql text, lines_sql text)
returns text language plpgsql as $$
begin
  execute inv_sql;
  execute lines_sql;
  set constraints all immediate;
  return null;
exception when others then
  return sqlerrm;
end $$;

grant execute on function test_count_as92(uuid, text), test_error_as92(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- N2: with the settings row gone the cap is 0: nobody gets the founding offer.
-- ---------------------------------------------------------------------------
delete from public.billing_settings;

select test_assert(
  test_error_as92(null, $q$update public.subscriptions set plan_id = 'pro', status = 'trialing', founding = true
     where business_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$) like 'founding_cap_reached%',
  'N2: with no settings row the founding cohort is closed (cap treated as 0)');

insert into public.billing_settings default values;

select test_assert(
  (select founding_cap from public.billing_settings) = 20
  and (select founding_granted_at is null from public.subscriptions where business_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'N2: the settings row is back at the default and nobody was granted by mistake');

-- ---------------------------------------------------------------------------
-- A6: lines add up to the subtotal
-- ---------------------------------------------------------------------------
select test_assert(
  test_invoice_error92(
    $q$insert into public.invoices
         (id, business_id, year, seq, number, kind, issue_date, period_start, period_end,
          subtotal_satang, total_satang, payment_ref)
       values ('dddddddd-0000-0000-0000-000000000101', 'aaaaaaaa-0000-0000-0000-000000000001',
               2098, 1, 'TN-2098-000001', 'receipt', '2098-01-03', '2098-01-03', '2098-02-02',
               49000, 49000, 'mock_ch_a6')$q$,
    $q$insert into public.invoice_lines
         (invoice_id, position, description_th, description_en, quantity, unit_satang, amount_satang)
       values ('dddddddd-0000-0000-0000-000000000101', 1, 'ก', 'a', 1, 40000, 40000)$q$)
  like 'invoice_lines_mismatch%',
  'A6: lines that do not add up to the subtotal are refused at commit');

select test_assert(
  (select count(*) from public.invoices where id = 'dddddddd-0000-0000-0000-000000000101') = 0
  and (select count(*) from public.invoice_lines where invoice_id = 'dddddddd-0000-0000-0000-000000000101') = 0,
  'A6: the refused invoice left nothing behind');

select test_assert(
  test_invoice_error92(
    $q$insert into public.invoices
         (id, business_id, year, seq, number, kind, issue_date, period_start, period_end,
          subtotal_satang, total_satang, payment_ref)
       values ('dddddddd-0000-0000-0000-000000000102', 'aaaaaaaa-0000-0000-0000-000000000001',
               2098, 2, 'TN-2098-000002', 'receipt', '2098-01-03', '2098-01-03', '2098-02-02',
               49000, 49000, 'mock_ch_a6b')$q$,
    $q$insert into public.invoice_lines
         (invoice_id, position, description_th, description_en, quantity, unit_satang, amount_satang)
       values ('dddddddd-0000-0000-0000-000000000102', 1, 'ก', 'a', 1, 30000, 30000),
              ('dddddddd-0000-0000-0000-000000000102', 2, 'ข', 'b', 1, 19000, 19000)$q$) is null,
  'A6: two lines that add up to the subtotal are accepted');

select test_assert(
  test_error_as92(null, $q$insert into public.invoice_lines
       (invoice_id, position, description_th, description_en, quantity, unit_satang, amount_satang)
     values ('dddddddd-0000-0000-0000-000000000102', 3, 'ค', 'c', 2, 100, 150)$q$) is not null,
  'A6: a line whose amount is not quantity x unit price is refused');

-- ---------------------------------------------------------------------------
-- N1: one refund per invoice
-- ---------------------------------------------------------------------------
select test_assert(
  test_error_as92(null, $q$update public.invoices set refunded_at = now() where id = 'dddddddd-0000-0000-0000-000000000102'$q$) is not null,
  'N1: a refund time without a refund reference is refused');

select test_assert(
  test_error_as92(null, $q$update public.invoices set refunded_at = now(), refund_ref = 'mock_re_9'
                           where id = 'dddddddd-0000-0000-0000-000000000102'$q$) is null,
  'N1: the first refund is recorded');

select test_assert(
  test_error_as92(null, $q$update public.invoices set refunded_at = now(), refund_ref = 'mock_re_10'
                           where id = 'dddddddd-0000-0000-0000-000000000102'$q$) like 'already_refunded%',
  'N1: a second refund of the same invoice is refused');

select test_assert(
  test_error_as92(null, $q$update public.invoices set refund_ref = null, refunded_at = null
                           where id = 'dddddddd-0000-0000-0000-000000000102'$q$) like 'already_refunded%',
  'N1: a refund cannot be wiped and redone');

-- ---------------------------------------------------------------------------
-- payment_methods: demo card, owner read only
-- ---------------------------------------------------------------------------
select test_assert(
  test_error_as92(null, $q$insert into public.payment_methods (business_id, brand, last4, exp_month, exp_year, provider_ref)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Visa', '4242', 12, 2030, 'pm_live_123')$q$) is not null,
  'a payment method that is not a mock reference is refused');

select test_assert(
  test_error_as92(null, $q$insert into public.payment_methods (business_id, brand, last4, exp_month, exp_year, provider_ref)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Visa', '4242424242424242', 12, 2030, 'mock_pm_1')$q$) is not null,
  'a full card number cannot be stored (last four digits only)');

insert into public.payment_methods (business_id, brand, last4, exp_month, exp_year, provider_ref)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Visa', '4242', 12, 2030, 'mock_pm_1');

set role authenticated;

select test_assert(
  test_count_as92('11111111-1111-1111-1111-111111111111', 'select count(*) from public.payment_methods') = 1,
  'owner A sees their own demo card');

select test_assert(
  test_count_as92('22222222-2222-2222-2222-222222222222', 'select count(*) from public.payment_methods') = 0,
  'owner B (another shop) sees no card');

select test_assert(
  test_count_as92('33333333-3333-3333-3333-333333333333', 'select count(*) from public.payment_methods') = 0,
  'a customer sees no payment method');

select test_assert(
  test_error_as92('11111111-1111-1111-1111-111111111111',
    $q$update public.payment_methods set last4 = '0000'$q$) is not null
  or (select last4 from public.payment_methods where business_id = 'aaaaaaaa-0000-0000-0000-000000000001') = '4242',
  'owner A cannot change the card from the browser');

select test_assert(
  test_error_as92('11111111-1111-1111-1111-111111111111',
    $q$insert into public.payment_methods (business_id, brand, last4, exp_month, exp_year, provider_ref)
       values ('bbbbbbbb-0000-0000-0000-000000000002', 'Visa', '1111', 1, 2030, 'mock_pm_2')$q$) is not null,
  'owner A cannot add a card to another shop (or any card from the browser)');

reset role;
set role anon;

select test_assert(
  test_error_as92(null, 'select count(*) from public.payment_methods') is not null,
  'anon has no access to payment methods');

reset role;

-- ---------------------------------------------------------------------------
-- Clean up so later files see an unchanged database.
-- ---------------------------------------------------------------------------
delete from public.payment_methods where provider_ref like 'mock\_pm\_%';
delete from public.invoices where id::text like 'dddddddd-0000-0000-0000-0000000001%';
update public.subscriptions set founding_granted_at = null
 where business_id = 'bbbbbbbb-0000-0000-0000-000000000002' and not founding;

select test_assert(
  (select count(*) from public.invoices) = 0
  and (select count(*) from public.payment_methods) = 0
  and (select founding_cap from public.billing_settings) = 20,
  'billing UI fixtures cleaned up');
