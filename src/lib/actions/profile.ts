"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Please tell us your name").max(80),
  phone: z.string().trim().min(6, "Enter a number a shop can reach you on").max(24),
});

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return errorState(
      "Please check the highlighted fields.",
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", session.userId);

  if (error) return errorState(error.message);

  // Mirror into the JWT so the middleware and future sessions agree.
  await supabase.auth.updateUser({
    data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
  });

  revalidatePath("/app", "layout");
  revalidatePath("/dashboard", "layout");
  return successState("Profile updated.");
}
