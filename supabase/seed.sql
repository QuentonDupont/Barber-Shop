-- ============================================================================
-- Bookly — development seed
-- ============================================================================
-- Creates two published businesses with services, hours and a lunch break so a
-- fresh local project has something to look at.
--
-- Users are NOT created here: they belong to Supabase Auth, and the
-- `handle_new_user` trigger writes their profile. Sign up through the app
-- first, then run:
--
--   psql "$DATABASE_URL" -v owner_email="'you@example.com'" -f supabase/seed.sql
--
-- The businesses are attached to the profile with that email.
-- ============================================================================

\set ON_ERROR_STOP on
\if :{?owner_email} \else \set owner_email '''owner@example.com''' \endif

-- psql does not interpolate :variables inside a dollar-quoted body, so the
-- address reaches the block through a session setting instead.
\o /dev/null
select set_config('bookly.owner_email', :owner_email, false);
\o

do $$
declare
  target text := current_setting('bookly.owner_email', true);
  owner  uuid;
  shop   uuid;
  spa    uuid;
begin
  select id into owner from public.profiles where email = target;

  if owner is null then
    raise exception
      'No profile with email %. Sign up in the app first, then re-run with -v owner_email=''...''',
      target;
  end if;

  update public.profiles set role = 'business_owner' where id = owner;

  -- ---- Shop one: a barber with a lunch break -------------------------------
  insert into public.businesses
    (owner_id, name, slug, category, description, timezone, address, lat, lng,
     phone, line_id, slot_interval_min, min_notice_min, max_advance_days,
     auto_confirm, is_published, onboarding_step)
  values
    (owner, 'Nong Barber', public.unique_business_slug('Nong Barber'), 'barber',
     'Classic cuts and hot-towel shaves, five minutes from BTS Asok.',
     'Asia/Bangkok', '18 Sukhumvit Soi 23, Khlong Toei Nuea, Bangkok',
     13.7380, 100.5608, '02 123 4567', '@nongbarber', 15, 60, 60,
     true, true, 3)
  returning id into shop;

  insert into public.business_hours (business_id, weekday, open_time, close_time, is_closed)
  select shop, d, '10:00', '20:00', d = 1              -- closed Mondays
  from generate_series(0, 6) d;

  insert into public.business_breaks (business_id, weekday, start_time, end_time, label)
  select shop, d, '13:00', '14:00', 'Lunch'
  from generate_series(0, 6) d
  where d <> 1;

  insert into public.services
    (business_id, name, description, duration_min, buffer_min, price, sort_order)
  values
    (shop, 'Men''s cut', 'Consultation, wash, cut and finish.', 45, 10, 350, 1),
    (shop, 'Skin fade', 'Clipper fade with a razor finish.', 60, 10, 500, 2),
    (shop, 'Hot-towel shave', 'Traditional straight-razor shave.', 30, 5, 400, 3),
    (shop, 'Cut & beard', 'The full service.', 90, 15, 750, 4);

  -- ---- Shop two: a spa that confirms manually ------------------------------
  insert into public.businesses
    (owner_id, name, slug, category, description, timezone, address, lat, lng,
     phone, slot_interval_min, min_notice_min, max_advance_days,
     auto_confirm, is_published, onboarding_step)
  values
    (owner, 'Baan Suan Spa', public.unique_business_slug('Baan Suan Spa'), 'spa',
     'Thai massage and aromatherapy in a converted shophouse.',
     'Asia/Bangkok', '99 Charoen Krung Road, Bang Rak, Bangkok',
     13.7226, 100.5147, '02 987 6543', 30, 120, 45,
     false, true, 3)
  returning id into spa;

  insert into public.business_hours (business_id, weekday, open_time, close_time, is_closed)
  select spa, d, '09:00', '21:00', false
  from generate_series(0, 6) d;

  insert into public.services
    (business_id, name, description, duration_min, buffer_min, price, sort_order)
  values
    (spa, 'Thai massage (60 min)', null, 60, 15, 600, 1),
    (spa, 'Thai massage (120 min)', null, 120, 15, 1100, 2),
    (spa, 'Aromatherapy', 'Oil massage with a scent of your choosing.', 90, 15, 1400, 3);

  -- A public holiday next month, to exercise the override path.
  insert into public.availability_overrides (business_id, date, is_closed, note)
  values (shop, (current_date + interval '20 days')::date, true, 'Public holiday');

  raise notice 'Seeded 2 businesses and 7 services for %', target;
end
$$;
