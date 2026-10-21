-- ============================================================================
-- TatNat — denormalise the assigned staff member's name onto a booking
-- ============================================================================
-- Same reasoning as `service_name`/`customer_name` on this table (see the init
-- migration's comment): a booking must still read correctly — "who's cutting
-- my hair" on My bookings, "who did this customer see" on the owner side —
-- even if that staff member is later renamed or deactivated. This matters
-- more for "any available" bookings, where the customer never typed a name
-- themselves; the server picked one, and that choice needs to stay legible.
-- ============================================================================

alter table public.bookings
  add column staff_name text;

comment on column public.bookings.staff_name is
  'Denormalised at booking time from staff.name, same pattern as service_name '
  '/ customer_name. Null when the booking has no staff_id (a business with no '
  'staff configured, i.e. the pre-multi-staff path).';
