"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { businessPath } from "@/lib/routes";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const staffSchema = (locale: Locale) =>
  z.object({
    id: z.uuid().optional().or(z.literal("")),
    name: z.string().trim().min(1, t(locale, "msg.staffNameRequired")).max(80),
    worksWeekdays: z
      .array(z.coerce.number().int().min(0).max(6))
      .default([])
      .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b)),
    isActive: z.boolean(),
    // Which services this staff member performs. Empty = every active
    // service at the business (`staff_services` default-open semantics —
    // see the migration comment), so an owner who adds a barber and never
    // touches this field gets a fully bookable staff member immediately.
    serviceIds: z.array(z.uuid()).default([]),
  });

/**
 * Add or edit one staff member — name, which weekdays they work
 * (`works_weekdays`), active/inactive, and which services they perform.
 *
 * Owner-side only (`requireBusiness`); RLS double-checks the business_id on
 * every statement regardless.
 */
export async function saveStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = staffSchema(locale).safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    worksWeekdays: formData.getAll("worksWeekdays"),
    isActive: formData.get("isActive") !== "off",
    serviceIds: formData.getAll("serviceIds"),
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "msg.checkFields"),
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { id, name, worksWeekdays, isActive, serviceIds } = parsed.data;

  const payload = {
    name,
    works_weekdays: worksWeekdays.length > 0 ? worksWeekdays : [...WEEKDAYS],
    is_active: isActive,
  };

  let staffId: string;

  if (id) {
    staffId = id;
    const { error } = await supabase
      .from("staff")
      .update(payload)
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);
  } else {
    const { data, error } = await supabase
      .from("staff")
      .insert({ ...payload, business_id: ctx.business.id })
      .select("id")
      .single();
    if (error) return errorState(error.message);
    staffId = data.id;
  }

  // Replace the service set wholesale — simpler and safer than a diff for a
  // handful of rows, and this action is the only writer of staff_services.
  const { error: clearError } = await supabase.from("staff_services").delete().eq("staff_id", staffId);
  if (clearError) return errorState(clearError.message);

  if (serviceIds.length > 0) {
    const { error: linkError } = await supabase
      .from("staff_services")
      .insert(serviceIds.map((serviceId) => ({ staff_id: staffId, service_id: serviceId })));
    if (linkError) return errorState(linkError.message);
  }

  revalidatePath("/dashboard/staff");
  revalidatePath(businessPath(ctx.business.slug));
  return successState(t(locale, id ? "msg.staffUpdated" : "msg.staffAdded"));
}

/** Deactivate/reactivate from the list — no confirmation sheet needed. */
export async function toggleStaffAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextActive = formData.get("isActive") === "true";
  if (!id) return;

  const ctx = await requireBusiness();
  const supabase = await createClient();

  await supabase
    .from("staff")
    .update({ is_active: nextActive })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  revalidatePath("/dashboard/staff");
  revalidatePath(businessPath(ctx.business.slug));
}
