\set ON_ERROR_STOP on

-- ===========================================================================
-- customer_notes isolation (roadmap.md §1 row 5; migration
-- 20261020120000_stretch_a_notes_and_policy.sql). Same pattern and fixture IDs
-- as 20_rls_isolation.sql: every assertion runs as `authenticated` with
-- `test.uid` standing in for the JWT subject, against the owners/customers
-- 10_booking_invariants.sql already seeded —
--   aaaaaaaa-0000-0000-0000-000000000001  Nong Barber, owned by 11111111...
--   bbbbbbbb-0000-0000-0000-000000000002  Rival Cuts,  owned by 22222222...
--   33333333...  Ann (customer)   44444444...  Ben (customer)
-- Covers test list items 10 and 11 (QA report #2 §6: flagged as reviewed by
-- eye only, not run against real Postgres — this is that run).
-- ===========================================================================

reset role;

-- Nong Barber's owner has a standing note on Ann, inserted directly (as the
-- unrestricted role) so this setup step isn't itself gated by the policy
-- under test.
insert into public.customer_notes (business_id, customer_id, note)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        'Usual: skin fade, prefers quiet');

set role authenticated;

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111',
                'select count(*) from public.customer_notes') = 1,
  'the owner sees their own note on the customer (positive control)');

select test_assert(
  test_count_as('22222222-2222-2222-2222-222222222222',
                'select count(*) from public.customer_notes') = 0,
  'an owner of another business cannot read it');

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.customer_notes') = 0,
  'the customer the note is about cannot read it — never shown to the customer');

select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444',
                'select count(*) from public.customer_notes') = 0,
  'an unrelated customer cannot read it either');

-- --- write-side: a rival owner cannot plant a note against another business -

select test_assert(
  test_sqlstate('22222222-2222-2222-2222-222222222222', $q$
    with ins as (
      insert into public.customer_notes (business_id, customer_id, note)
      values ('aaaaaaaa-0000-0000-0000-000000000001',
              '44444444-4444-4444-4444-444444444444',
              'a rival owner writing on another business''s customer')
      returning 0 as z)
    select 1/z from ins
  $q$) = '42501',
  'a rival owner cannot insert a note against another business (blocked by RLS)');

reset role;
select test_assert(
  (select count(*) from public.customer_notes) = 1,
  'still exactly the one seeded note — no probe above left a row behind');
