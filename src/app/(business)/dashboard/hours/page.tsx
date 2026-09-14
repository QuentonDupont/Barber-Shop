import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { HoursForm } from "@/components/business/hours-form";
import { DEFAULT_WEEK, type DayHours } from "@/components/business/hours-editor";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { minutesToTimeString, parseTimeToMinutes } from "@/lib/booking/time";

export const metadata: Metadata = { title: "Opening hours" };

export default async function HoursPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const [{ data: hours }, { data: breaks }] = await Promise.all([
    supabase
      .from("business_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("business_id", ctx.business.id),
    supabase
      .from("business_breaks")
      .select("weekday, start_time, end_time")
      .eq("business_id", ctx.business.id),
  ]);

  const initial: DayHours[] = DEFAULT_WEEK.map((fallback) => {
    const row = hours?.find((h) => h.weekday === fallback.weekday);
    const brk = breaks?.find((b) => b.weekday === fallback.weekday);
    if (!row) return fallback;
    return {
      weekday: fallback.weekday,
      isClosed: row.is_closed,
      open: minutesToTimeString(parseTimeToMinutes(row.open_time)),
      close: minutesToTimeString(parseTimeToMinutes(row.close_time)),
      breakEnabled: Boolean(brk),
      breakStart: brk ? minutesToTimeString(parseTimeToMinutes(brk.start_time)) : "12:00",
      breakEnd: brk ? minutesToTimeString(parseTimeToMinutes(brk.end_time)) : "13:00",
    };
  });

  return (
    <PageContainer>
      <PageHeader
        title="Opening hours"
        description={`Your weekly schedule in ${ctx.business.timezone}. Bookly only ever offers slots inside these windows.`}
      />
      <HoursForm initialHours={initial} />
    </PageContainer>
  );
}
