"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { errorState, fieldErrorsFrom, successState, type ActionState } from "./types";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

const profileSchema = (locale: Locale) =>
  z.object({
    fullName: z.string().trim().min(2, t(locale, "msg.profileNameRequired")).max(80),
    phone: z.string().trim().min(6, t(locale, "msg.profilePhoneRequired")).max(24),
  });

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = profileSchema(locale).safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "msg.checkFields"),
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
  return successState(t(locale, "msg.profileUpdated"));
}
