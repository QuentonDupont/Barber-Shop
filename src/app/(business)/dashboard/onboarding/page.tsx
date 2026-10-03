import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/business/onboarding-wizard";
import { DEFAULT_WEEK, type DayHours } from "@/lib/booking/hours";
import { getOwnerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { minutesToTimeString, parseTimeToMinutes } from "@/lib/booking/time";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step: rawStep } = await searchParams;
  const ctx = await getOwnerContext();

  const requested = Number(rawStep);
  // Never let someone skip ahead to a step whose prerequisites are missing.
  const furthest = ctx.business ? Math.min(ctx.business.onboarding_step + 1, 3) : 1;
  const step = (
    Number.isFinite(requested) && requested >= 1 && requested <= 3
      ? Math.min(requested, furthest)
      : furthest
  ) as 1 | 2 | 3;

  // Setup is already done — the wizard has nothing left to ask.
  if (ctx.business && ctx.business.onboarding_step >= 3 && !rawStep) {
    redirect("/dashboard");
  }

  let initialHours: DayHours[] | null = null;
  if (ctx.business && step === 3) {
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

    if (hours && hours.length > 0) {
      initialHours = DEFAULT_WEEK.map((fallback) => {
        const row = hours.find((h) => h.weekday === fallback.weekday);
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
    }
  }

  return (
    <OnboardingWizard step={step} business={ctx.business} initialHours={initialHours} />
  );
}
