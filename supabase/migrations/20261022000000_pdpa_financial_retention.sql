-- PDPA fix pass (legal-review.md 2026-10-22 section; CEO decision: 5-year
-- financial retention, per Legal's recommendation). Two things:
--
--   1. `pdpa_process_deletion_requests()` anonymized the `profiles` row only
--      — it never touched the denormalised `customer_name`/`customer_phone`
--      columns stored directly on `bookings` (kept there on purpose, stretch
--      A, so a booking still reads correctly if a profile is later edited).
--      The corrected privacy-policy wording now promises deleted customers'
--      booking records are kept "in a form that no longer identifies you" —
--      so this makes that true immediately, not just on the profile.
--   2. The booking rows themselves are deliberately NOT deleted or purged
--      here, at any age — `bookings.customer_id` is `on delete cascade`
--      from `profiles` (see 20260101000000_init.sql), so the one hard rule
--      this migration must not break is "never delete the profiles row" —
--      confirmed unchanged: this function only ever UPDATEs profiles, never
--      DELETEs. That is what "keeps financial booking records" means in
--      practice: a business's own transaction history survives a
--      customer's deletion request, indefinitely, by construction. The
--      5-year figure is the retention *floor* Thai accounting practice
--      expects (legal-review.md §3, policy.ts's
--      `FINANCIAL_RECORD_RETENTION_YEARS`), not a scheduled purge trigger —
--      no code here deletes anything after 5 years; `pdpa_bookings_past_financial_retention`
--      below is a read-only lookup only, for whoever eventually decides
--      whether/how to build that purge (legal-review.md 2026-10-22 §4, left
--      open on purpose, not blocking).

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

    -- Anonymize the customer-identifying copy left on their past bookings
    -- too — the booking itself (service, price, dates, business, status)
    -- stays, matching the policy's "kept, but no longer identifies you."
    update bookings
      set customer_name = '', customer_phone = null
      where customer_id = rec.user_id;

    update deletion_requests
      set status = 'completed', completed_at = now()
      where id = rec.deletion_request_id;

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

comment on function pdpa_process_deletion_requests is
  'Anonymizes a profile AND that user''s bookings'' denormalised '
  'customer_name/customer_phone once a deletion request passes its grace '
  'period, and marks the request completed. Never deletes the booking rows '
  'themselves (profiles.id cascade-deletes bookings, so this function must '
  'never DELETE a profiles row, only UPDATE it — that is what keeps '
  'financial/booking records intact for the business''s own record-keeping, '
  'per legal-review.md §3/2026-10-22). SECURITY DEFINER for the same reason '
  'as before: it writes across rows the calling role has no RLS policy for. '
  'Revoke-by-default: only service_role can execute it.';

-- Read-only lookup mirroring src/lib/privacy/policy.ts's
-- `isPastFinancialRetention` (same 5-year default) — for whoever eventually
-- decides whether to build an actual purge job (legal-review.md 2026-10-22
-- §4: "either build the job before go-live, or keep the policy wording in
-- its corrected form... either is fine legally"). Scoped to bookings
-- belonging to an account that has already been through the deletion flow
-- (a completed deletion_requests row) — the 5-year financial-retention
-- clock in the policy text runs from account closure, not from each
-- booking's own date, so an active account's bookings are never "past
-- retention" by this function regardless of how old they are.
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
  'elapsed. Read-only — does not purge anything itself. No automated purge '
  'job exists yet (legal-review.md 2026-10-22 §4, an open, non-blocking '
  'decision); this is the documented, callable starting point for one.';

revoke all on function pdpa_bookings_past_financial_retention(int) from public, anon, authenticated;
grant execute on function pdpa_bookings_past_financial_retention(int) to service_role;
