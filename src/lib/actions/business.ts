"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOwnerContext, requireBusiness } from "@/lib/auth";
import { minutesToTimeString, parseTimeToMinutes } from "@/lib/booking/time";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { businessPath } from "@/lib/routes";

const CATEGORIES = [
  "salon",
  "barber",
  "clinic",
  "spa",
  "fitness",
  "event",
  "other",
] as const;

const basicsSchema = z.object({
  name: z.string().trim().min(2, "Give your business a name").max(80, "That name is too long"),
  category: z.enum(CATEGORIES),
  phone: z.string().trim().min(6, "Add a phone number customers can call").max(24),
  lineId: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(600, "Keep it under 600 characters").optional().or(z.literal("")),
});

/** Step 1 — identity. Creates the business row the first time through. */
export async function saveBusinessBasicsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = basicsSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    phone: formData.get("phone"),
    lineId: formData.get("lineId"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const { name, category, phone, lineId, description } = parsed.data;
  const ctx = await getOwnerContext();
  const supabase = await createClient();

  const shared = {
    name,
    category,
    phone,
    line_id: lineId || null,
    description: description || null,
  };

  if (ctx.business) {
    const { error } = await supabase
      .from("businesses")
      .update({ ...shared, onboarding_step: Math.max(ctx.business.onboarding_step, 1) })
      .eq("id", ctx.business.id);
    if (error) return errorState(error.message);
  } else {
    const { data: slug, error: slugError } = await supabase.rpc("unique_business_slug", {
      desired: name,
    });
    if (slugError) return errorState(slugError.message);

    const { data: created, error } = await supabase
      .from("businesses")
      .insert({
        ...shared,
        owner_id: ctx.userId,
        slug: slug ?? `business-${Date.now()}`,
        onboarding_step: 1,
      })
      .select("id")
      .single();
    if (error) return errorState(error.message);

    // A brand-new business starts with a sensible week so the owner is never
    // looking at an empty calendar: open 09:00–18:00 Monday to Saturday.
    const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      business_id: created.id,
      weekday,
      open_time: "09:00",
      close_time: "18:00",
      is_closed: weekday === 0,
    }));
    await supabase.from("business_hours").insert(rows);
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/onboarding?step=2");
}

const locationSchema = z.object({
  address: z.string().trim().min(4, "Search for your address, or type it in"),
  placeId: z.string().trim().optional().or(z.literal("")),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  timezone: z.string().trim().min(1).default("Asia/Bangkok"),
});

/** Step 2 — where the business is. */
export async function saveBusinessLocationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawLat = formData.get("lat");
  const rawLng = formData.get("lng");

  const parsed = locationSchema.safeParse({
    address: formData.get("address"),
    placeId: formData.get("placeId"),
    lat: rawLat === "" || rawLat === null ? undefined : rawLat,
    lng: rawLng === "" || rawLng === null ? undefined : rawLng,
    timezone: formData.get("timezone") || "Asia/Bangkok",
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      address: parsed.data.address,
      place_id: parsed.data.placeId || null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      timezone: parsed.data.timezone,
      onboarding_step: Math.max(ctx.business.onboarding_step, 2),
    })
    .eq("id", ctx.business.id);

  if (error) return errorState(error.message);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/onboarding?step=3");
}

const daySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  open: z.string(),
  close: z.string(),
  breakEnabled: z.boolean(),
  breakStart: z.string(),
  breakEnd: z.string(),
});

const hoursSchema = z.object({
  days: z.array(daySchema).length(7),
});

/**
 * Step 3 — the weekly template, and the same form later under Hours.
 *
 * Replaces the whole week in one go rather than diffing: seven rows is cheap,
 * and a partial write here would leave the availability engine reading a
 * half-updated schedule.
 */
export async function saveBusinessHoursAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formData.get("payload");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(typeof raw === "string" ? raw : "null");
  } catch {
    return errorState("Could not read the opening hours. Please try again.");
  }

  const parsed = hoursSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return errorState("Could not read the opening hours. Please try again.");
  }

  // Validate the windows before touching the database so the owner sees which
  // day is wrong rather than a Postgres constraint name.
  for (const day of parsed.data.days) {
    if (day.isClosed) continue;

    const open = parseTimeToMinutes(day.open);
    const close = parseTimeToMinutes(day.close);
    if (open >= close) {
      return errorState(`${dayName(day.weekday)}: closing time must be after opening time.`);
    }

    if (day.breakEnabled) {
      const bStart = parseTimeToMinutes(day.breakStart);
      const bEnd = parseTimeToMinutes(day.breakEnd);
      if (bStart >= bEnd) {
        return errorState(`${dayName(day.weekday)}: the break must end after it starts.`);
      }
      if (bStart < open || bEnd > close) {
        return errorState(`${dayName(day.weekday)}: the break has to sit inside opening hours.`);
      }
    }
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const businessId = ctx.business.id;

  const hourRows = parsed.data.days.map((day) => ({
    business_id: businessId,
    weekday: day.weekday,
    // Postgres still needs a valid window on a closed day, so keep the times
    // and let `is_closed` do the talking.
    open_time: day.isClosed ? "09:00" : minutesToTimeString(parseTimeToMinutes(day.open)),
    close_time: day.isClosed ? "18:00" : minutesToTimeString(parseTimeToMinutes(day.close)),
    is_closed: day.isClosed,
  }));

  const { error: hoursError } = await supabase
    .from("business_hours")
    .upsert(hourRows, { onConflict: "business_id,weekday" });
  if (hoursError) return errorState(hoursError.message);

  const breakRows = parsed.data.days
    .filter((day) => !day.isClosed && day.breakEnabled)
    .map((day) => ({
      business_id: businessId,
      weekday: day.weekday,
      start_time: minutesToTimeString(parseTimeToMinutes(day.breakStart)),
      end_time: minutesToTimeString(parseTimeToMinutes(day.breakEnd)),
      label: "Break",
    }));

  const { error: deleteError } = await supabase
    .from("business_breaks")
    .delete()
    .eq("business_id", businessId);
  if (deleteError) return errorState(deleteError.message);

  if (breakRows.length > 0) {
    const { error: insertError } = await supabase.from("business_breaks").insert(breakRows);
    if (insertError) return errorState(insertError.message);
  }

  const finishing = ctx.business.onboarding_step < 3;
  if (finishing) {
    await supabase
      .from("businesses")
      .update({ onboarding_step: 3 })
      .eq("id", businessId);
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(businessPath(ctx.business.slug));

  if (finishing) redirect("/dashboard?welcome=1");
  return successState("Opening hours saved.");
}

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  phone: z.string().trim().min(6).max(24),
  lineId: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  timezone: z.string().trim().min(1),
  cancellationPolicy: z.string().trim().max(500).optional().or(z.literal("")),
  slotInterval: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), {
    message: "Pick one of the offered intervals",
  }),
  minNotice: z.coerce.number().int().min(0).max(60 * 24 * 7),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  autoConfirm: z.boolean(),
  isPublished: z.boolean(),
});

export async function saveBusinessSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    lineId: formData.get("lineId"),
    address: formData.get("address"),
    timezone: formData.get("timezone"),
    cancellationPolicy: formData.get("cancellationPolicy"),
    slotInterval: formData.get("slotInterval"),
    minNotice: formData.get("minNotice"),
    maxAdvanceDays: formData.get("maxAdvanceDays"),
    autoConfirm: formData.get("autoConfirm") === "on",
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  // Publishing without services would put a shop in the directory that nobody
  // can actually book, so block it with a clear reason.
  if (parsed.data.isPublished) {
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("is_active", true);

    if (!count) {
      return errorState(
        "Add at least one active service before going live — customers need something to book.",
      );
    }
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      phone: parsed.data.phone,
      line_id: parsed.data.lineId || null,
      address: parsed.data.address || null,
      timezone: parsed.data.timezone,
      cancellation_policy: parsed.data.cancellationPolicy || null,
      slot_interval_min: parsed.data.slotInterval,
      min_notice_min: parsed.data.minNotice,
      max_advance_days: parsed.data.maxAdvanceDays,
      auto_confirm: parsed.data.autoConfirm,
      is_published: parsed.data.isPublished,
    })
    .eq("id", ctx.business.id);

  if (error) return errorState(error.message);

  revalidatePath("/dashboard", "layout");
  revalidatePath(businessPath(ctx.business.slug));
  return successState("Settings saved.");
}

function dayName(weekday: number): string {
  return (
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      weekday
    ] ?? "That day"
  );
}
