-- ============================================================================
-- TatNat: shop-entered bookings (handoff 11, owner "add booking" screen).
--
-- A customer who phones, messages on LINE or walks in has no account. The shop
-- enters the booking for them, so a booking no longer always has a customer
-- profile behind it:
--
--   1. bookings.customer_id becomes optional.
--   2. Only the shop's own owner may insert such a booking, and only for their
--      own shop (new RLS policy). Customers keep inserting only their own.
--   3. A booking with no customer profile must be a shop-entered one. The
--      stamp_booking_source() trigger (handoff 10) already stamps 'shop' for
--      an owner insert, and CHECK runs after BEFORE triggers.
--
-- The no-double-booking rule is untouched: bookings_no_overlap does not look
-- at customer_id, so a shop-entered booking clashes with any other live
-- booking on the same staff member (or business-wide when staff is null).
-- ============================================================================

alter table public.bookings
  alter column customer_id drop not null;

alter table public.bookings
  add constraint bookings_customer_or_shop
  check (customer_id is not null or source = 'shop');

create policy "bookings: owner creates shop-entered"
  on public.bookings for insert
  to authenticated
  with check (
    customer_id is null
    and public.owns_business(business_id)
  );
