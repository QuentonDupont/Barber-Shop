-- Stretch A (roadmap.md §1 rows 5-6, decision #18):
--   * businesses.cancellation_policy — a plain-text policy string the owner
--     sets once, shown on the listing page, the booking-confirmation screen
--     and the confirmation email.
--   * customer_notes — one free-text note per (business, customer) pair, so
--     a barber can see a customer's usual preferences. Scoped to the owning
--     business by RLS; a customer never gets a select policy, so RLS's
--     default-deny keeps notes invisible to the person they're about.

alter table businesses
  add column if not exists cancellation_policy text;

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_id uuid not null references profiles (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

alter table customer_notes enable row level security;

-- A business owner can read and write only their own business's notes.
create policy customer_notes_owner_select on customer_notes
  for select
  using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy customer_notes_owner_insert on customer_notes
  for insert
  with check (business_id in (select id from businesses where owner_id = auth.uid()));

create policy customer_notes_owner_update on customer_notes
  for update
  using (business_id in (select id from businesses where owner_id = auth.uid()))
  with check (business_id in (select id from businesses where owner_id = auth.uid()));

-- No select/insert/update policy for anyone else, including the customer the
-- note is about — RLS denies by default once enabled, so this is the
-- enforcement for "never shown to the customer", not just a UI omission.

-- Keep updated_at honest on every edit, matching the pattern other
-- owner-editable tables in this schema already rely on.
create or replace function set_customer_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customer_notes_set_updated_at
  before update on customer_notes
  for each row
  execute function set_customer_notes_updated_at();
