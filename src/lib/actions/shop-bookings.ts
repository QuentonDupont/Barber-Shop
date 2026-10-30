"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import {
  buildSlotInput,
  loadAvailabilitySources,
  loadStaffWithServices,
  resolveStaffCandidates,
} from "@/lib/booking/availability";
import { findSlot, getDayAvailability } from "@/lib/booking/slots";
import { toDateKey } from "@/lib/booking/time";
import { businessPath } from "@/lib/routes";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import type { BookingRow } from "@/lib/database.types";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";

/**
 * The owner's "add booking" screen: a customer who phones, messages on LINE or
 * walks in has no account, so the shop types in a name and a phone number.
 *
 * Availability and double-booking are exactly the customer rules (same engine,
 * same database exclusion constraint) with one owner exception, as for
 * rescheduling: the minimum-notice window is waived, because it protects the
 * shop from customers, not from itself. The row is stored with
 * `customer_id = null`; the database stamps `source = 'shop'` (migration
 * 20261026000000) and refuses any other owner's shop.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ShopSlot {
  startsAt: string;
  label: string;
}

export type ShopSlotsResult =
  | { status: "ok"; isOpen: boolean; slots: ShopSlot[] }
  | { status: "error"; message: string };

/** Bookable start times for a service on a day, for the add-booking screen. */
export async function getShopSlotsAction(
  serviceId: string,
  staffId: string,
  date: string,
): Promise<ShopSlotsResult> {
  const locale = await getLocale();
  if (!DATE_RE.test(date) || !serviceId) {
    return { status: "error", message: t(locale, "bookingAdmin.errorDateUnreadable") };
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("business_id", ctx.business.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!service) return { status: "error", message: t(locale, "bookingAdmin.errorServiceGone") };

  const allStaff = await loadStaffWithServices(supabase, ctx.business.id);
  const selection = resolveStaffCandidates(allStaff, serviceId, date, staffId);
  if (!selection.ok) {
    return { status: "ok", isOpen: true, slots: [] };
  }

  const merged = new Map<string, ShopSlot>();
  let isOpen = false;
  for (const candidate of selection.candidateIds) {
    const sources = await loadAvailabilitySources(supabase, ctx.business, date, date, {
      staffId: candidate ?? undefined,
    });
    const input = buildSlotInput(ctx.business, service, sources, date);
    const day = getDayAvailability({
      ...input,
      rules: { ...input.rules, minNoticeMin: 0, maxAdvanceDays: 365 },
    });
    if (day.isOpen) isOpen = true;
    for (const slot of day.slots) {
      if (!merged.has(slot.startsAt)) merged.set(slot.startsAt, { startsAt: slot.startsAt, label: slot.label });
    }
  }

  const slots = [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { status: "ok", isOpen, slots };
}

const schema = (locale: Locale) =>
  z.object({
    serviceId: z.uuid(),
    staffId: z.uuid().optional().or(z.literal("any")).or(z.literal("")),
    startsAt: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
    customerName: z.string().trim().min(1, t(locale, "msg.walkInNameRequired")).max(80),
    customerPhone: z.string().trim().min(6, t(locale, "msg.walkInPhoneRequired")).max(24),
    notes: z.string().trim().max(400).optional().or(z.literal("")),
  });

export async function createShopBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = schema(locale).safeParse({
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId") ?? "",
    startsAt: formData.get("startsAt"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors);
    const missingChoice = "serviceId" in fieldErrors || "startsAt" in fieldErrors;
    return errorState(
      t(locale, missingChoice ? "msg.walkInIncomplete" : "msg.checkFields"),
      fieldErrors,
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { serviceId, staffId: requestedStaffId, startsAt, customerName, customerPhone, notes } = parsed.data;
  const business = ctx.business;

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!service) return errorState(t(locale, "bookingAdmin.errorServiceGone"));

  const date = toDateKey(new Date(startsAt), business.timezone);
  const allStaff = await loadStaffWithServices(supabase, business.id);
  const selection = resolveStaffCandidates(allStaff, serviceId, date, requestedStaffId);
  if (!selection.ok) {
    return errorState(
      t(locale, selection.reason === "no_staff_available" ? "toast.noStaffAvailable" : "toast.staffUnavailable"),
    );
  }
  const staffNameById = new Map(allStaff.map((s) => [s.id, s.name]));

  let booking: BookingRow | null = null;
  for (const candidateStaffId of selection.candidateIds) {
    const sources = await loadAvailabilitySources(supabase, business, date, date, {
      staffId: candidateStaffId ?? undefined,
    });
    const input = buildSlotInput(business, service, sources, date);
    const slot = findSlot(
      { ...input, rules: { ...input.rules, minNoticeMin: 0, maxAdvanceDays: 365 } },
      startsAt,
    );
    if (!slot) continue;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        business_id: business.id,
        service_id: serviceId,
        customer_id: null,
        staff_id: candidateStaffId,
        staff_name: candidateStaffId ? staffNameById.get(candidateStaffId) ?? null : null,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        status: "confirmed",
        notes: notes || null,
        service_name: service.name,
        price: service.price,
        currency: service.currency,
        customer_name: customerName,
        customer_phone: customerPhone,
      })
      .select("*")
      .single();

    if (!error) {
      booking = data;
      break;
    }
    // 23P01: someone took the slot in the meantime; try the next barber.
    if (error.code !== "23P01") return errorState(error.message);
  }

  if (!booking) return errorState(t(locale, "msg.walkInSlotTaken"));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath(businessPath(business.slug));
  return successState(t(locale, "msg.walkInAdded"));
}
