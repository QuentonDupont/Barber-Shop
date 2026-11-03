\set ON_ERROR_STOP on

-- ===========================================================================
-- business_legal isolation (tatnat-accounts-billing test O5; migration
-- 20261104000001_business_legal.sql). Same fixtures as 25_customer_notes:
--   aaaaaaaa-...01 Nong Barber, owner 11111111...   bbbbbbbb-...02 Rival Cuts, owner 22222222...
--   33333333... Ann (customer)   44444444... Ben (customer)
-- ===========================================================================

reset role;

-- Seed as the unrestricted role so setup is not itself gated by the policy.
insert into public.business_legal (business_id, legal_name, tax_id, branch_code, tax_address, vat_registered)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nong Barber Co., Ltd.', '1234567890121', '00000',
        '1 Test Road, Bangkok', true);

set role authenticated;

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111',
                'select count(*) from public.business_legal') = 1,
  'the owner reads their own legal row (positive control)');
select test_assert(
  test_count_as('22222222-2222-2222-2222-222222222222',
                'select count(*) from public.business_legal') = 0,
  'a rival owner sees nothing');
select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.business_legal') = 0,
  'a customer sees nothing');
-- --- writes -----------------------------------------------------------------
select test_assert(
  test_sqlstate('22222222-2222-2222-2222-222222222222', $q$
    with ins as (
      insert into public.business_legal (business_id, legal_name)
      values ('aaaaaaaa-0000-0000-0000-000000000001', 'rival overwrite')
      returning 0 as z)
    select 1/z from ins
  $q$) in ('42501', '23505'),
  'a rival owner cannot insert a legal row for another business');

select test_assert(
  test_count_as('22222222-2222-2222-2222-222222222222', $q$
    with u as (update public.business_legal set legal_name = 'hijack' returning 1)
    select count(*) from u
  $q$) = 0,
  'a rival owner cannot update another business''s legal row');

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333', $q$
    with u as (update public.business_legal set legal_name = 'hijack' returning 1)
    select count(*) from u
  $q$) = 0,
  'a customer cannot update a legal row');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111', $q$
    with u as (update public.business_legal set legal_name = 'Nong Barber Ltd.' returning 1)
    select count(*) from u
  $q$) = 1,
  'the owner can update their own row');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111', $q$
    with d as (delete from public.business_legal returning 1) select count(*) from d
  $q$) = 0,
  'nobody can delete the row directly (no delete policy)');

-- --- anon has no table access at all ----------------------------------------
reset role;
set role anon;
select test_assert(
  test_sqlstate(null, 'select count(*) from public.business_legal') = '42501',
  'anon is refused outright (no privilege on business_legal)');

-- --- the tax id is not reachable through any public read --------------------
reset role;
select test_assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'businesses'
                 and column_name in ('tax_id', 'legal_name', 'tax_address', 'branch_code', 'vat_registered')),
  'no tax column exists on the public businesses table');
select test_assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and column_name = 'tax_id'
                 and table_name <> 'business_legal'),
  'tax_id exists in no table or view other than business_legal');

-- --- format constraints ------------------------------------------------------
select test_assert(
  test_sqlstate(null, $q$update public.business_legal set tax_id = '123' where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = '23514',
  'a short tax id is refused');
select test_assert(
  test_sqlstate(null, $q$update public.business_legal set tax_id = '1234567890122' where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = '23514',
  'a 13-digit tax id with a wrong check digit is refused');
select test_assert(
  test_sqlstate(null, $q$update public.business_legal set tax_id = '12345678901ab' where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = '23514',
  'a non-numeric tax id is refused');
select test_assert(
  test_sqlstate(null, $q$update public.business_legal set branch_code = '12' where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = '23514',
  'a branch code that is not 5 digits is refused');
select test_assert(
  test_sqlstate(null, $q$update public.business_legal set tax_id = null, legal_name = null where business_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) is distinct from '23514',
  'every field is optional: tax id and legal name may be empty');

-- --- clean up ----------------------------------------------------------------
delete from public.business_legal;
select test_assert((select count(*) from public.business_legal) = 0, 'business_legal fixtures cleaned up');
