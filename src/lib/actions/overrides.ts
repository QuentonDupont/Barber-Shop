"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import {
  businessToday,
  minutesToTimeString,
  parseTimeToMinutes,
  zonedDayMinutesToUtc,
} from "@/lib/booking/time";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { businessPath } from "@/lib/routes";

const overrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  mode: z.enum(["closed", "custom"]),
  openTime: z.string().optional().or(z.literal("")),
  closeTime: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(120, "Keep the note under 120 characters").optional().or(z.literal("")),
});

/**
 * A one-off day: a public holiday, a late opening, a half day.
 *
 * Refuses to close a day that already has live bookings on it. The database
 * would let the override in and leave those bookings stranded outside
 * availability, which is worse than making the owner deal with them first.
 */
export async function saveOverrideAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = overrideSchema.safeParse({
    date: formData.get("date"),
    mode: formData.get("mode"),
    openTime: formData.get("openTime"),
    closeTime: formData.get("closeTime"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const { date, mode, note } = parsed.data;
  const ctx = await requireBusiness();
  const business = ctx.business;

  if (date < businessToday(business.timezone)) {
    return errorState("That date has already passed.", { date: "Pick today or a later date." });
  }

  let openTime: string | null = null;
  let closeTime: string | null = null;

  if (mode === "custom") {
    if (!parsed.data.openTime || !parsed.data.closeTime) {
      return errorState("Set both an opening and a closing time.", {
        openTime: "Required for custom hours",
      });
    }
    const open = parseTimeToMinutes(parsed.data.openTime);
    const close = parseTimeToMinutes(parsed.data.closeTime);
    if (open >= close) {
      return errorState("Closing time must be after opening time.", {
        closeTime: "Must be after the opening time",
      });
    }
    openTime = minutesToTimeString(open);
    closeTime = minutesToTimeString(close);
  }

  const supabase = await createClient();

  // Live bookings that would fall outside the new window.
  const dayStart = zonedDayMinutesToUtc(date, 0, business.timezone).toISOString();
  const dayEnd = zonedDayMinutesToUtc(date, 1440, business.timezone).toISOString();
  const { data: live } = await supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("business_id", business.id)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const stranded = (live ?? []).filter((booking) => {
    if (mode === "closed") return true;
    const windowStart = zonedDayMinutesToUtc(date, parseTimeToMinutes(openTime!), business.timezone);
    const windowEnd = zonedDayMinutesToUtc(date, parseTimeToMinutes(closeTime!), business.timezone);
    return (
      new Date(booking.starts_at) < windowStart || new Date(booking.ends_at) > windowEnd
    );
  });

  if (stranded.length > 0) {
    return errorState(
      `${stranded.length} booking${stranded.length === 1 ? " is" : "s are"} already on that day ` +
        `${mode === "closed" ? "" : "outside those hours "}— move or cancel ${
          stranded.length === 1 ? "it" : "them"
        } first.`,
    );
  }

  const { error } = await supabase.from("availability_overrides").upsert(
    {
      business_id: business.id,
      date,
      is_closed: mode === "closed",
      open_time: openTime,
      close_time: closeTime,
      note: note || null,
    },
    { onConflict: "business_id,date" },
  );

  if (error) return errorState(error.message);

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard/calendar");
  revalidatePath(businessPath(business.slug));
  return successState(mode === "closed" ? "Day marked as closed." : "Custom hours saved.");
}

export async function deleteOverrideAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("That entry no longer exists.");

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  if (error) return errorState(error.message);

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard/calendar");
  revalidatePath(businessPath(ctx.business.slug));
  return successState("Removed. Regular hours apply again on that day.");
}
