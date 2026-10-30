-- Weekly beta numbers for Data & Analytics (handoff 10).
-- Run with a role that sees every shop (service role / database admin):
--   psql "$DATABASE_URL" -f supabase/queries/beta_weekly_metrics.sql
-- Definitions are in supabase/migrations/20261026000000_beta_ops.sql.
-- Gate link (operations-plan.md §4): active_shops / onboarded_shops is the
-- "shops weekly-active" share; no_show_rate is the no-show measure.

-- Per week, all shops (newest first)
select week_start, onboarded_shops, shops_with_bookings, active_shops,
       round(100.0 * active_shops / nullif(onboarded_shops, 0), 1) as active_pct,
       bookings_total, customer_booked, shop_entered, completed, no_shows,
       cancelled, no_show_rate
from public.beta_weekly_totals
order by week_start desc;

-- Per shop per week (newest first)
select week_start, business_name, bookings_total, customer_booked, shop_entered,
       completed, no_shows, cancelled, no_show_rate, is_weekly_active
from public.beta_weekly_shop_metrics
order by week_start desc, business_name;
