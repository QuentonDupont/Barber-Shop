\set ON_ERROR_STOP on

-- ===========================================================================
-- PDPA consent_records / deletion_requests isolation and retention
-- (roadmap.md §1 row 7; migration 20261021120000_pdpa_consent_and_deletion.sql;
-- handoff 07, test items 10, 16-18, 20-21). Same fixture IDs as
-- 10_booking_invariants.sql / 20_rls_isolation.sql / 25_customer_notes_isolation.sql:
--   11111111...  Nong Barber's owner     22222222...  Rival Cuts' owner
--   33333333...  Ann (customer)          44444444...  Ben (customer)
-- ===========================================================================

reset role;

-- Ann and Ben each have one existing consent row, inserted directly as the
-- unrestricted role so this setup isn't itself gated by the policy under test.
insert into public.consent_records (user_id, policy_version, consented_at)
values
  ('33333333-3333-3333-3333-333333333333', '2026-10-21-draft-1', now()),
  ('44444444-4444-4444-4444-444444444444', '2026-10-21-draft-1', now());

set role authenticated;

-- --- consent_records: select isolation --------------------------------

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.consent_records') = 1,
  'Ann sees exactly her own consent row');

select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444',
                'select count(*) from public.consent_records') = 1,
  'Ben sees exactly his own consent row, not Ann''s');

select test_assert(
  test_count_as('11111111-1111-1111-1111-111111111111',
                'select count(*) from public.consent_records') = 0,
  'a business owner sees no one''s consent records');

-- --- consent_records: write isolation -----------------------------------

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    with ins as (
      insert into public.consent_records (user_id, policy_version)
      values ('33333333-3333-3333-3333-333333333333', '2026-10-21-draft-1')
      returning 1)
    select 1/0 from ins
  $q$) = '22012',
  'Ann can record her own consent');

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    with ins as (
      insert into public.consent_records (user_id, policy_version)
      values ('44444444-4444-4444-4444-444444444444', '2026-10-21-draft-1')
      returning 1)
    select 1/0 from ins
  $q$) = '42501',
  'Ann cannot record consent on Ben''s behalf (blocked by RLS)');

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    update public.consent_records set withdrawn_at = now()
    where user_id = '33333333-3333-3333-3333-333333333333'
  $q$) = '',
  'Ann can withdraw her own consent (update succeeds)');

-- Note: an UPDATE's USING clause only *filters which rows are targeted* —
-- unlike INSERT's WITH CHECK, a row excluded by USING is just not selected,
-- not a 42501 error (that error class is reserved for a selected row whose
-- *new values* fail WITH CHECK). So "Ann targets Ben's row" is expected to
-- succeed with zero rows touched, not raise — checked by re-reading the row
-- below, not by sqlstate.
select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    update public.consent_records set withdrawn_at = now()
    where user_id = '44444444-4444-4444-4444-444444444444'
  $q$) = '',
  'Ann''s attempt to update Ben''s row is a well-formed no-op (not an error)');

reset role;
select test_assert(
  (select withdrawn_at from public.consent_records
    where user_id = '44444444-4444-4444-4444-444444444444') is null,
  'Ben''s consent row was not actually touched by Ann''s attempt — RLS filtered it out');

-- Clean up the real withdrawal the positive-control update above committed,
-- so later sections of this file start from a known state.
update public.consent_records set withdrawn_at = null
  where user_id = '33333333-3333-3333-3333-333333333333';
set role authenticated;

-- --- deletion_requests: isolation and no self-service update -----------

select test_assert(
  test_sqlstate('44444444-4444-4444-4444-444444444444', $q$
    with ins as (
      insert into public.deletion_requests (user_id)
      values ('44444444-4444-4444-4444-444444444444')
      returning 1)
    select 1/0 from ins
  $q$) = '22012',
  'Ben can file his own deletion request');

select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444',
                'select count(*) from public.deletion_requests') = 0,
  'the probe insert above rolled back (division-by-zero) — Ben has no committed request yet');

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    with ins as (
      insert into public.deletion_requests (user_id)
      values ('44444444-4444-4444-4444-444444444444')
      returning 1)
    select 1/0 from ins
  $q$) = '42501',
  'Ann cannot file a deletion request on Ben''s behalf (blocked by RLS)');

-- Seed one real (committed) deletion request for Ben, far enough in the past
-- to already be past the default 30-day grace window, so the retention
-- function below has something to process.
reset role;
insert into public.deletion_requests (user_id, requested_at)
values ('44444444-4444-4444-4444-444444444444', now() - interval '45 days');
set role authenticated;

select test_assert(
  test_count_as('44444444-4444-4444-4444-444444444444',
                'select count(*) from public.deletion_requests') = 1,
  'Ben sees exactly his own (real) deletion request');

select test_assert(
  test_count_as('33333333-3333-3333-3333-333333333333',
                'select count(*) from public.deletion_requests') = 0,
  'Ann cannot see Ben''s deletion request');

-- Same USING-vs-WITH CHECK distinction as above: deletion_requests has no
-- UPDATE policy at all, so every row is excluded by the (absent) USING
-- clause — the statement succeeds as a no-op, it doesn't raise. The real
-- guarantee is checked afterward: status must still be 'pending'.
select test_assert(
  test_sqlstate('44444444-4444-4444-4444-444444444444', $q$
    update public.deletion_requests set status = 'completed'
    where user_id = '44444444-4444-4444-4444-444444444444'
  $q$) = '',
  'Ben''s self-update attempt is a well-formed no-op (not an error)');

reset role;
select test_assert(
  (select status from public.deletion_requests
    where user_id = '44444444-4444-4444-4444-444444444444') = 'pending',
  'Ben cannot actually self-complete his own deletion request — no update policy exists, by design');
set role authenticated;

-- --- retention functions: locked to service_role ------------------------

select test_assert(
  test_sqlstate('44444444-4444-4444-4444-444444444444',
    'select * from public.pdpa_process_deletion_requests()') = '42501',
  'an ordinary authenticated user cannot run the deletion-processing job');

reset role;

-- --- retention functions: functional run, as service_role ---------------

select test_assert(
  (select count(*) from public.pdpa_accounts_past_retention(30)) = 1,
  'exactly Ben''s 45-day-old request is past the 30-day grace window');

set role service_role;
select public.pdpa_process_deletion_requests(30);
reset role;

select test_assert(
  (select status from public.deletion_requests
    where user_id = '44444444-4444-4444-4444-444444444444') = 'completed',
  'Ben''s deletion request is marked completed after processing');

select test_assert(
  (select full_name from public.profiles
    where id = '44444444-4444-4444-4444-444444444444') = '',
  'Ben''s profile is anonymized (full_name cleared)');

select test_assert(
  (select phone is null and email is null and avatar_url is null
    from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'),
  'Ben''s profile is anonymized (phone/email/avatar cleared)');

select test_assert(
  (select full_name from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') <> '',
  'Ann''s profile is untouched by processing Ben''s request');

select test_assert(
  (select count(*) from public.pdpa_accounts_past_retention(30)) = 0,
  'nothing left to process — the job is idempotent, not re-processing a completed request');
