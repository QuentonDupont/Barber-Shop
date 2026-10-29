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

-- A booking of Ben's, owned by Nong Barber, so the financial-retention fix
-- (20261022000000_pdpa_financial_retention.sql) has a real row to anonymize
-- without touching — never deleting — the booking itself. `status =
-- 'completed'` deliberately sits outside the no-overlap exclusion
-- constraint's `where (status in ('pending', 'confirmed'))` clause, so this
-- fixture can't collide with any other test file's bookings regardless of
-- timing. Own id, not reused from 10_booking_invariants.sql, so this file
-- stays self-contained if that fixture ever changes. `notes` is a real
-- freeform value (QA report #8 §4: a customer can write anything there —
-- an allergy, a callback number, a name — so it is personal data too, not
-- a financial fact worth keeping).
insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, customer_phone, notes)
values
  ('eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444',
   '2026-01-10T03:00:00Z', '2026-01-10T04:00:00Z', 'completed',
   'Cut', 300, 'Ben Customer', '0899999999', 'Allergic to lavender oil, call ahead');

-- Nong Barber's owner has a note *about* Ben (stretch A's customer_notes —
-- a business's private record about a customer, not the customer's own
-- booking data). Ann already has one of her own, seeded by
-- 25_customer_notes_isolation.sql earlier in this same run — reused below
-- as the negative control for the delete-on-deletion-request fix (decision
-- #21, QA report #8 §1), rather than inserting a second row for the same
-- (business, customer) pair, which `customer_notes`'s own unique
-- constraint would reject.
insert into public.customer_notes (business_id, customer_id, note)
values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '44444444-4444-4444-4444-444444444444',
   'Ben: prefers a #2 fade, chatty, allergic to lavender oil');

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
      returning 0 as z)
    select 1/z from ins
  $q$) = '22012',
  'Ann can record her own consent');

select test_assert(
  test_sqlstate('33333333-3333-3333-3333-333333333333', $q$
    with ins as (
      insert into public.consent_records (user_id, policy_version)
      values ('44444444-4444-4444-4444-444444444444', '2026-10-21-draft-1')
      returning 0 as z)
    select 1/z from ins
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
      returning 0 as z)
    select 1/z from ins
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
      returning 0 as z)
    select 1/z from ins
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

-- Within-grace negative control (QA report #7 §6): Ann files a request too,
-- only 5 days ago — well inside the 30-day grace window. Without this
-- second, recent, pending row, the "exactly 1" assertion below can't
-- distinguish "the function correctly filters by grace period" from "the
-- function returns every pending row regardless of age," since there would
-- be nothing else pending in the table to wrongly include.
insert into public.deletion_requests (user_id, requested_at)
values ('33333333-3333-3333-3333-333333333333', now() - interval '5 days');

-- --- retention functions: functional run, as service_role ---------------

select test_assert(
  (select count(*) from public.pdpa_accounts_past_retention(30)) = 1,
  'exactly one request is past the 30-day grace window, with two pending');

select test_assert(
  (select deletion_request_id from public.pdpa_accounts_past_retention(30)) in
    (select id from public.deletion_requests
      where user_id = '44444444-4444-4444-4444-444444444444' and status = 'pending'),
  'the one past-grace request is specifically Ben''s 45-day-old one, not Ann''s 5-day-old one');

select test_assert(
  not exists (
    select 1 from public.pdpa_accounts_past_retention(30)
    where user_id = '33333333-3333-3333-3333-333333333333'
  ),
  'Ann''s 5-day-old (within-grace) request is correctly excluded');

set role service_role;
select public.pdpa_process_deletion_requests(30);
reset role;

select test_assert(
  (select status from public.deletion_requests
    where user_id = '33333333-3333-3333-3333-333333333333') = 'pending',
  'Ann''s within-grace request is untouched by processing Ben''s — still pending, not completed');

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

-- Financial retention (legal-review.md 2026-10-22; 20261022000000_pdpa_financial_retention.sql):
-- Ben's booking is anonymized, but still exists — "kept, but no longer
-- identifies you," never deleted.
select test_assert(
  (select count(*) from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001') = 1,
  'Ben''s booking record still exists — financial records are kept, not purged, by this function');

select test_assert(
  (select customer_name from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001') = '',
  'Ben''s booking is anonymized (customer_name cleared)');

select test_assert(
  (select customer_phone is null from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Ben''s booking is anonymized (customer_phone cleared)');

-- QA report #8 §4: the customer's own freeform notes field is personal
-- data too (an allergy, a callback number, a name — anything they typed).
select test_assert(
  (select notes is null from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Ben''s booking notes are cleared');

-- QA report #8 §4: tightened label — actually asserts each fact claimed,
-- not just service_name (report #8's finding: the old label overclaimed).
select test_assert(
  (select service_name = 'Cut' and price = 300
     and starts_at = '2026-01-10T03:00:00Z'::timestamptz
     and ends_at = '2026-01-10T04:00:00Z'::timestamptz
    from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'Ben''s booking keeps its non-identifying transaction facts: service_name, price, starts_at and ends_at all survive');

-- Decision #21 / QA report #8 §1: a barber's private note *about* Ben is
-- deleted outright (not anonymized — it has no financial-record purpose),
-- scoped to Ben only.
select test_assert(
  (select count(*) from public.customer_notes
    where customer_id = '44444444-4444-4444-4444-444444444444') = 0,
  'Ben''s customer_notes row is deleted, not just anonymized');

select test_assert(
  (select count(*) from public.customer_notes
    where customer_id = '33333333-3333-3333-3333-333333333333') = 1,
  'Ann''s customer_notes row is untouched by processing Ben''s request');

select test_assert(
  (select count(*) from public.pdpa_accounts_past_retention(30)) = 0,
  'nothing left to process — the job is idempotent, not re-processing a completed request');

-- ---------------------------------------------------------------------------
-- Decision #21, "then deletes them" half: pdpa_purge_financial_records_past_retention
-- ---------------------------------------------------------------------------

set role authenticated;
select test_assert(
  test_sqlstate('44444444-4444-4444-4444-444444444444',
    'select * from public.pdpa_purge_financial_records_past_retention()') = '42501',
  'an ordinary authenticated user cannot run the financial-records purge job');
reset role;

-- Positive control: Carol, a customer whose account deletion completed 6
-- years ago — well past the 5-year financial-retention window — with one
-- booking. 55555555... is free to reuse: 10_booking_invariants.sql
-- creates then deletes it (its own "sneaky self-sign-up" probe), so by the
-- time this file runs it no longer exists.
insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-5555-5555-555555555555', 'carol@example.test',
   '{"role":"customer","full_name":"Carol Customer","phone":"0855555555"}');

insert into public.deletion_requests (user_id, requested_at, status, completed_at)
values
  ('55555555-5555-5555-5555-555555555555',
   now() - interval '6 years' - interval '30 days',
   'completed', now() - interval '6 years');

insert into public.bookings
  (id, business_id, service_id, customer_id, starts_at, ends_at, status,
   service_name, price, customer_name, customer_phone)
values
  ('eeeeeeee-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   '55555555-5555-5555-5555-555555555555',
   '2019-01-10T03:00:00Z', '2019-01-10T04:00:00Z', 'completed',
   'Cut', 300, '', null);

select test_assert(
  (select count(*) from public.pdpa_bookings_past_financial_retention(5)
    where booking_id = 'eeeeeeee-0000-0000-0000-000000000002') = 1,
  'Carol''s booking is correctly identified as past the 5-year financial-retention window');

select test_assert(
  (select count(*) from public.pdpa_bookings_past_financial_retention(5)
    where booking_id = 'eeeeeeee-0000-0000-0000-000000000001') = 0,
  'Ben''s booking (deletion completed moments ago, this same test run) is not — the negative control');

set role service_role;
select public.pdpa_purge_financial_records_past_retention(5);
reset role;

select test_assert(
  (select count(*) from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000002') = 0,
  'positive control: Carol''s 6-year-old booking is actually deleted');

select test_assert(
  (select count(*) from public.bookings
    where id = 'eeeeeeee-0000-0000-0000-000000000001') = 1,
  'negative control: Ben''s recent booking survives the same purge call');

-- 60_beta_ops.sql reuses the eeeeeeee-... booking ids; leave the table as found.
reset role;
delete from public.bookings where id::text like 'eeeeeeee-0000-0000-0000-0000000%';
