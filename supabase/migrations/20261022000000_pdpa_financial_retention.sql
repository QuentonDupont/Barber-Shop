-- PDPA fix pass (legal-review.md 2026-10-22 section; decision #21 —
-- "TatNat keeps financial booking records for 5 years, then deletes them.
-- The policy text and the retention job are set to match."). Three things:
--
--   1. `pdpa_process_deletion_requests()` anonymizes the denormalised
--      `customer_name`/`customer_phone` columns on that user's own
--      `bookings` rows (kept there on purpose, stretch A, so a booking
--      still reads correctly if a profile is later edited), AND clears the
--      freeform `bookings.notes` field (QA report #8 §4: a customer can
--      write anything there — an allergy, a callback number, a name — so
--      it is the customer's personal data too, not a financial fact worth
--      keeping). It also DELETES that customer's `customer_notes` rows
--      (decision #21's owner, per the coordinator's fix-pass instructions:
--      a barber's private note *about* a person is that person's data and
--      serves no financial-record purpose, unlike the booking itself).
--   2. The booking row's financial facts (service, price, currency, dates,
--      business, status) are NOT touched by step 1 — only once
--      `pdpa_purge_financial_records_past_retention()` actually deletes the
--      row, 5 years after the account's own deletion completed, per
--      decision #21. Until then, `bookings.customer_id`'s `on delete
--      cascade` from `profiles` (20260101000000_init.sql) is why
--      `pdpa_process_deletion_requests` must never DELETE a profiles row,
--      only UPDATE it — confirmed unchanged here, no DELETE on profiles
--      anywhere in this function.
--   3. Scheduling either function on a recurring basis waits for real
--      hosting to exist (roadmap.md §3) — same reasoning as the 30-day
--      grace job already noted in `pdpa_accounts_past_retention`'s own
--      comment. Both are documented, callable functions today, not wired
--      to any cron; see handoffs/07-pdpa-thai.md for the explicit note.

create or replace function pdpa_process_deletion_requests(grace_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  processed int := 0;
  rec record;
begin
  for rec in select * from pdpa_accounts_past_retention(grace_days) loop
    update profiles
      set full_name = '', phone = null, email = null, avatar_url = null
      where id = rec.user_id;

    -- Anonymize the customer-identifying copy left on their past bookings,
    -- and clear their own freeform notes field too (QA report #8 §4) — the
    -- booking's financial facts (service, price, currency, dates, business,
    -- status) are deliberately outside this column list and stay intact
    -- until the 5-year purge below actually removes the row.
    update bookings
      set customer_name = '', customer_phone = null, notes = null
      where customer_id = rec.user_id;

    -- A barber's private note *about* this customer (stretch A,
    -- `customer_notes`) is the customer's data too, and has no financial-
    -- record purpose the way the booking itself does — delete outright
    -- rather than anonymize (decision #21, coordinator's fix-pass call).
    delete from customer_notes where customer_id = rec.user_id;

    update deletion_requests
      set status = 'completed', completed_at = now()
      where id = rec.deletion_request_id;

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

comment on function pdpa_process_deletion_requests is
  'Anonymizes a profile and that user''s bookings'' denormalised '
  'customer_name/customer_phone/notes, and deletes their customer_notes '
  'rows (a barber''s private note about them, not a financial record), '
  'once a deletion request passes its grace period; marks the request '
  'completed. Never deletes the booking rows themselves — only '
  'pdpa_purge_financial_records_past_retention does that, 5 years later '
  '(decision #21). profiles.id cascade-deletes bookings, so this function '
  'must never DELETE a profiles row, only UPDATE it. SECURITY DEFINER for '
  'the same reason as before: it writes across rows the calling role has '
  'no RLS policy for. Revoke-by-default: only service_role can execute it.';

-- Read-only lookup, used by the purge function below and kept separately
-- callable for inspection/testing. Scoped to bookings belonging to an
-- account that has already been through the deletion flow (a completed
-- deletion_requests row) — the 5-year financial-retention clock runs from
-- account closure, not from each booking's own date, so an active
-- account's bookings are never "past retention" regardless of how old they
-- are.
create or replace function pdpa_bookings_past_financial_retention(years int default 5)
returns table (booking_id uuid, user_id uuid, completed_at timestamptz)
language sql
stable
as $$
  select b.id, dr.user_id, dr.completed_at
  from bookings b
  join deletion_requests dr
    on dr.user_id = b.customer_id
  where dr.status = 'completed'
    and dr.completed_at <= now() - (years || ' years')::interval;
$$;

comment on function pdpa_bookings_past_financial_retention is
  'Bookings belonging to an already-deleted account whose financial-'
  'retention window (default 5 years from account closure, matching '
  'src/lib/privacy/policy.ts''s FINANCIAL_RECORD_RETENTION_YEARS) has '
  'elapsed. Read-only — pdpa_purge_financial_records_past_retention is the '
  'function that actually deletes them (decision #21).';

revoke all on function pdpa_bookings_past_financial_retention(int) from public, anon, authenticated;
grant execute on function pdpa_bookings_past_financial_retention(int) to service_role;

-- Decision #21: "TatNat keeps financial booking records for 5 years, then
-- deletes them." This is the "then deletes them" half — a callable
-- function, same shape and same not-yet-scheduled status as
-- pdpa_process_deletion_requests's 30-day grace job (no live hosting to
-- put a cron on yet, roadmap.md §3). Deletes exactly the rows
-- pdpa_bookings_past_financial_retention identifies: already-anonymized
-- bookings belonging to an account whose deletion completed more than
-- `years` years ago.
create or replace function pdpa_purge_financial_records_past_retention(years int default 5)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged int;
begin
  delete from bookings
  where id in (select booking_id from pdpa_bookings_past_financial_retention(years));

  get diagnostics purged = row_count;
  return purged;
end;
$$;

comment on function pdpa_purge_financial_records_past_retention is
  'Deletes bookings past the 5-year (default) financial-retention window '
  'identified by pdpa_bookings_past_financial_retention — decision #21''s '
  '"then deletes them" half. Not wired to any scheduler yet (same reason '
  'as pdpa_process_deletion_requests''s 30-day job: no live hosting to put '
  'a cron on, roadmap.md §3) — documented, callable starting point. '
  'SECURITY DEFINER: deletes rows the calling role has no RLS policy for. '
  'Revoke-by-default: only service_role can execute it.';

revoke all on function pdpa_purge_financial_records_past_retention(int) from public, anon, authenticated;
grant execute on function pdpa_purge_financial_records_past_retention(int) to service_role;
