-- ============================================================================
-- TatNat — local development seed
-- ============================================================================
-- Applied automatically by `supabase db reset` (see config.toml). Plain SQL,
-- no psql meta-commands, so the CLI's seed runner can execute it.
--
-- It creates two demo logins, then two published businesses owned by the
-- first, so the app is usable the moment it starts:
--
--   owner@tatnat.local     / tatnat123   -> business portal (Nong Barber)
--   customer@tatnat.local  / tatnat123   -> customer portal
--
-- These are for LOCAL use only. Never run this against a production project:
-- it writes directly to auth.users with a known password.
-- ============================================================================

do $$
declare
  v_owner     uuid := 'a0000000-0000-4000-8000-000000000001';
  v_customer  uuid := 'a0000000-0000-4000-8000-000000000002';
  pw          text := crypt('tatnat123', gen_salt('bf'));
  shop        uuid;
  spa         uuid;
begin
  -- ---- demo users ----------------------------------------------------------
  -- The `handle_new_user` trigger turns each of these into a profile row and
  -- reads the role from raw_user_meta_data.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_sso_user
  )
  values
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner@tatnat.local', pw, now(),
     '{"provider":"email","providers":["email"]}',
     '{"role":"business_owner","full_name":"Nong Srisuk","phone":"081 000 0001"}',
     now(), now(), '', '', '', '', '', '', '', '', false),
    (v_customer, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'customer@tatnat.local', pw, now(),
     '{"provider":"email","providers":["email"]}',
     '{"role":"customer","full_name":"Ann Suwannee","phone":"081 000 0002"}',
     now(), now(), '', '', '', '', '', '', '', '', false)
  on conflict (id) do nothing;

  -- GoTrue needs an identity row per provider before a password login works.
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  values
    (gen_random_uuid(), v_owner, v_owner::text, 'email',
     jsonb_build_object('sub', v_owner::text, 'email', 'owner@tatnat.local', 'email_verified', true),
     now(), now(), now()),
    (gen_random_uuid(), v_customer, v_customer::text, 'email',
     jsonb_build_object('sub', v_customer::text, 'email', 'customer@tatnat.local', 'email_verified', true),
     now(), now(), now())
  on conflict do nothing;

  -- The trigger already made the profiles; make sure the role is right even
  -- if the row existed from an earlier run.
  update public.profiles set role = 'business_owner' where id = v_owner;

  -- ---- Shop one: a barber with a lunch break -------------------------------
  if not exists (select 1 from public.businesses b where b.owner_id = v_owner and b.slug like 'nong-barber%') then
    insert into public.businesses
      (owner_id, name, slug, category, description, timezone, address, lat, lng,
       phone, line_id, slot_interval_min, min_notice_min, max_advance_days,
       auto_confirm, is_published, onboarding_step)
    values
      (v_owner, 'Nong Barber', public.unique_business_slug('Nong Barber'), 'barber',
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

    -- A public holiday in three weeks, to exercise the override path.
    insert into public.availability_overrides (business_id, date, is_closed, note)
    values (shop, (current_date + 20), true, 'Public holiday');
  end if;

  -- ---- Shop two: a spa that confirms manually ------------------------------
  if not exists (select 1 from public.businesses b where b.owner_id = v_owner and b.slug like 'baan-suan-spa%') then
    insert into public.businesses
      (owner_id, name, slug, category, description, timezone, address, lat, lng,
       phone, slot_interval_min, min_notice_min, max_advance_days,
       auto_confirm, is_published, onboarding_step)
    values
      (v_owner, 'Baan Suan Spa', public.unique_business_slug('Baan Suan Spa'), 'spa',
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
  end if;

  raise notice 'Seeded: owner@tatnat.local and customer@tatnat.local (password tatnat123), 2 businesses, 7 services';
end
$$;
