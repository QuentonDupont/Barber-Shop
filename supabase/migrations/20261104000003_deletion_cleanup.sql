-- Account deletion also clears what the account pages added (QA report 5, F2):
-- profiles.pending_email, the notification_prefs row, and the stored photo file.
-- The file itself is removed by the app through the storage API; this function
-- queues the path for it, because deleting storage rows from SQL orphans files.

create table if not exists public.avatar_cleanup_queue (
  id        uuid primary key default gen_random_uuid(),
  path      text not null,
  queued_at timestamptz not null default now()
);
alter table public.avatar_cleanup_queue enable row level security;
revoke all on public.avatar_cleanup_queue from anon, authenticated;
grant select, delete on public.avatar_cleanup_queue to service_role;

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
    -- A stored photo file cannot be removed from SQL without orphaning it, so queue
    -- its path; the app removes it through the storage API (drainAvatarCleanup).
    insert into avatar_cleanup_queue (path)
      select avatar_url from profiles
      where id = rec.user_id and avatar_url is not null and avatar_url not like 'data:%';

    update profiles
      set full_name = '', phone = null, email = null, avatar_url = null,
          pending_email = null
      where id = rec.user_id;

    -- Notification choices (and the marketing consent stamp) go with the account.
    delete from notification_prefs where user_id = rec.user_id;

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
