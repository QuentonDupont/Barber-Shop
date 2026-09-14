"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";

const serviceSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Give the service a name").max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  durationMin: z.coerce
    .number()
    .int()
    .min(5, "Five minutes is the shortest bookable service")
    .max(1440, "That is longer than a day"),
  bufferMin: z.coerce.number().int().min(0).max(240),
  price: z.coerce.number().min(0, "Price cannot be negative").max(1_000_000),
  isActive: z.boolean(),
});

export async function saveServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = serviceSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    description: formData.get("description"),
    durationMin: formData.get("durationMin"),
    bufferMin: formData.get("bufferMin") || 0,
    price: formData.get("price") || 0,
    isActive: formData.get("isActive") !== "off",
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { id, name, description, durationMin, bufferMin, price, isActive } = parsed.data;

  const payload = {
    name,
    description: description || null,
    duration_min: durationMin,
    buffer_min: bufferMin,
    price,
    currency: "THB",
    is_active: isActive,
  };

  if (id) {
    // `business_id` is in the filter as well as enforced by RLS, so a tampered
    // id cannot reach another shop's service even if a policy were relaxed.
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);
  } else {
    const { error } = await supabase
      .from("services")
      .insert({ ...payload, business_id: ctx.business.id });
    if (error) return errorState(error.message);
  }

  revalidatePath("/dashboard/services");
  revalidatePath(`/app/b/${ctx.business.slug}`);
  return successState(id ? "Service updated." : "Service added.");
}

export async function toggleServiceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextActive = formData.get("isActive") === "true";
  if (!id) return;

  const ctx = await requireBusiness();
  const supabase = await createClient();

  await supabase
    .from("services")
    .update({ is_active: nextActive })
    .eq("id", id)
    .eq("business_id", ctx.business.id);

  revalidatePath("/dashboard/services");
  revalidatePath(`/app/b/${ctx.business.slug}`);
}

export async function deleteServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return errorState("That service no longer exists.");

  const ctx = await requireBusiness();
  const supabase = await createClient();

  // `services.id` is ON DELETE RESTRICT from bookings, so a service with
  // history cannot be removed. Deactivating keeps past bookings readable.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("service_id", id);

  if (count && count > 0) {
    const { error } = await supabase
      .from("services")
      .update({ is_active: false })
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return errorState(error.message);

    revalidatePath("/dashboard/services");
    return successState(
      "This service has bookings against it, so it was hidden from customers rather than deleted.",
    );
  }

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", ctx.business.id);
  if (error) return errorState(error.message);

  revalidatePath("/dashboard/services");
  revalidatePath(`/app/b/${ctx.business.slug}`);
  return successState("Service deleted.");
}
