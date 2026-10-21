"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/auth";
import { errorState, successState, type ActionState } from "./types";

const schema = z.object({
  customerId: z.uuid(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

/**
 * One free-text note per (business, customer) pair — "usual: skin fade,
 * prefers quiet" — visible only to this business's owner, never to the
 * customer (roadmap.md §1 row 5; RLS enforces the "never to the customer"
 * half, see `supabase/migrations/20261020120000_stretch_a_notes_and_policy.sql`).
 *
 * Upserts so the owner never has to know whether a note already exists
 * before saving — the sheet always just has a "Save" button.
 */
export async function saveCustomerNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return errorState("That note could not be saved.");
  }

  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase.from("customer_notes").upsert(
    {
      business_id: ctx.business.id,
      customer_id: parsed.data.customerId,
      note: parsed.data.note || "",
    },
    { onConflict: "business_id,customer_id" },
  );

  if (error) return errorState(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return successState("Note saved.");
}

/**
 * Looked up from the owner's booking sheet so the note is there without an
 * extra click. Returns `""` (not an error) when nothing has been saved yet —
 * the sheet treats that as an empty, writable field.
 */
export async function getCustomerNote(customerId: string): Promise<string> {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("customer_notes")
    .select("note")
    .eq("business_id", ctx.business.id)
    .eq("customer_id", customerId)
    .maybeSingle();

  return data?.note ?? "";
}
