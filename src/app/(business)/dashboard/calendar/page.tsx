import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { CalendarView } from "@/components/business/calendar-view";
import { Skeleton } from "@/components/ui/misc";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  businessToday,
  shiftDateKey,
  weekdayOf,
  zonedDayMinutesToUtc,
  type DateKey,
} from "@/lib/booking/time";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Calendar" };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireBusiness();
  const business = ctx.business;
  const locale = await getLocale();

  const today = businessToday(business.timezone);
  const selectedDate: DateKey =
    params.date && DATE_PATTERN.test(params.date) && !Number.isNaN(Date.parse(params.date))
      ? params.date
      : today;
  const view = params.view === "week" ? "week" : "day";

  // Weeks start on Monday, matching how the hours editor reads.
  const weekday = weekdayOf(selectedDate);
  const weekStart = shiftDateKey(selectedDate, weekday === 0 ? -6 : 1 - weekday);

  // Day view still loads the surrounding fortnight so the date strip can show
  // which days already have bookings without a request per day.
  const rangeStart = view === "week" ? weekStart : shiftDateKey(selectedDate, -3);
  const rangeEnd = view === "week" ? shiftDateKey(weekStart, 7) : shiftDateKey(selectedDate, 18);

  const supabase = await createClient();
  const [{ data: bookings }, { data: staff }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("business_id", business.id)
      .gte("starts_at", zonedDayMinutesToUtc(rangeStart, 0, business.timezone).toISOString())
      .lt("starts_at", zonedDayMinutesToUtc(rangeEnd, 0, business.timezone).toISOString())
      .order("starts_at", { ascending: true }),
    // Only active staff are offered as a filter — a deactivated barber's past
    // bookings still show under "All staff", matching item 22's "past
    // bookings are untouched" rule without resurrecting them as a filter choice.
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "calendarAdmin.pageTitle")}
        description={t(locale, "calendarAdmin.pageDescription", { timezone: business.timezone })}
      />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CalendarView
          business={business}
          bookings={bookings ?? []}
          staff={staff ?? []}
          selectedDate={selectedDate}
          today={today}
          view={view}
          weekStart={weekStart}
        />
      </Suspense>
    </PageContainer>
  );
}
