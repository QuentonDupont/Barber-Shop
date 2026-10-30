-- PDPA program (roadmap.md §1 row 7; legal-review.md §3 "Clear with conditions"
-- checklist; handoff 07). Two new tables, both owned entirely by the user they
-- describe — no business-owner access, same default-deny-by-RLS discipline as
-- `customer_notes` (20261020120000_stretch_a_notes_and_policy.sql).
--
--   * consent_records — one row per consent event. A user can have more than
--     one row over time (re-consenting after a policy bump, or withdrawing and
--     later re-consenting); the latest non-withdrawn row for a user is "current
--     consent". `policy_version` ties the row to the exact privacy-policy text
--     that was in force (see src/lib/privacy/policy.ts, Stream P).
--   * deletion_requests — a user-initiated "please delete my data" request.
--     Processing is a grace-period job (src/lib/privacy/retention.ts), not an
--     immediate hard delete — that's deliberate: it gives the user a window to
--     change their mind, and matches legal-review.md §3's retention condition.
--     Nothing here runs on a live cron yet (no beta hosting exists — roadmap.md
--     §3); `pdpa_process_deletion_requests()` below is the documented path a
--     scheduled job will call once hosting exists.

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  policy_version text not null,
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index if not exists consent_records_user_id_idx
  on consent_records (user_id);

alter table consent_records enable row level security;

-- A user may only see and write their own consent history. No policy of any
-- kind exists for anyone else (including a business owner) — RLS denies by
-- default once enabled.
create policy consent_records_self_select on consent_records
  for select
  using (user_id = auth.uid());

create policy consent_records_self_insert on consent_records
  for insert
  with check (user_id = auth.uid());

-- Update is only ever used to stamp `withdrawn_at` on an existing row the
-- user owns — `policy_version`/`consented_at`/`user_id` are not meant to
-- change after the fact, but Postgres RLS can't restrict *which columns*
-- change, only *which rows*; the application (withdrawConsentAction) is
-- responsible for only ever touching `withdrawn_at`.
create policy consent_records_self_update on consent_records
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  unique (user_id, status) deferrable initially deferred
);

-- The unique(user_id, status) constraint above is deliberately loose (it only
-- stops two simultaneously-pending rows for the same user from being a silent
-- duplicate pile-up); 'completed'/'cancelled' can repeat per user across a
-- lifetime of requests, which is why status is part of the key rather than
-- user_id alone.

create index if not exists deletion_requests_user_id_idx
  on deletion_requests (user_id);
create index if not exists deletion_requests_pending_idx
  on deletion_requests (requested_at) where status = 'pending';

alter table deletion_requests enable row level security;

create policy deletion_requests_self_select on deletion_requests
  for select
  using (user_id = auth.uid());

create policy deletion_requests_self_insert on deletion_requests
  for insert
  with check (user_id = auth.uid());

-- Deliberately no update/delete policy for the regular user — a request, once
-- filed, is only ever transitioned to 'completed' by the retention job below,
-- which runs as a privileged role, not as the requesting user. This stops a
-- user (or a bug in the UI layer) from marking their own request "completed"
-- without the data actually having been processed.

-- ---------------------------------------------------------------------------
-- Retention processing — the DB-side half of src/lib/privacy/retention.ts's
-- grace-period math (test items 16-18). Anonymizes the profile rather than
-- hard-deleting it: bookings made with real businesses stay intact for the
-- business's own record-keeping (legal-review.md §3's retention condition),
-- but the personal fields that identify the person are cleared. Consent
-- history is kept as an audit trail of what was agreed to and withdrawn, not
-- erased by this function.
-- ---------------------------------------------------------------------------

create or replace function pdpa_accounts_past_retention(grace_days int default 30)
returns table (deletion_request_id uuid, user_id uuid, requested_at timestamptz)
language sql
stable
as $$
  select id, deletion_requests.user_id, requested_at
  from deletion_requests
  where status = 'pending'
    and requested_at <= now() - (grace_days || ' days')::interval;
$$;

comment on function pdpa_accounts_past_retention is
  'Deletion requests whose grace period has elapsed and are ready to process. '
  'Read-only lookup; see pdpa_process_deletion_requests() for the write side.';

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

    update deletion_requests
      set status = 'completed', completed_at = now()
      where id = rec.deletion_request_id;

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

comment on function pdpa_process_deletion_requests is
  'Anonymizes profiles whose deletion request has passed its grace period and '
  'marks the request completed. SECURITY DEFINER because it writes across '
  'rows the calling role would not otherwise be allowed to touch directly '
  '(RLS intentionally gives users no update/delete policy on deletion_requests). '
  'Not yet wired to a live scheduler — there is no beta hosting to schedule it '
  'on (roadmap.md §3) — this is the documented, callable path for when there '
  'is. Revoke-by-default: only service_role can execute it.';

revoke all on function pdpa_process_deletion_requests(int) from public, anon, authenticated;
revoke all on function pdpa_accounts_past_retention(int) from public, anon, authenticated;
grant execute on function pdpa_accounts_past_retention(int) to service_role;
grant execute on function pdpa_process_deletion_requests(int) to service_role;
