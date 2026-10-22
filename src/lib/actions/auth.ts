"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock/config";
import { setMockUserByRole } from "@/lib/mock/client";
import { errorState, fieldErrorsFrom, type ActionState } from "./types";
import { recordConsentAction } from "./privacy";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

const roleSchema = z.enum(["customer", "business_owner"]);

// Invite-only beta: self-sign-up creates customers only. Business accounts are
// made by staff (see handoff 01); the database enforces the same rule, so this
// is the friendly message, not the lock.
function signUpSchema(locale: Locale) {
  return z.object({
    fullName: z.string().trim().min(2, t(locale, "auth.errorNameRequired")),
    email: z.email(t(locale, "auth.errorEmailInvalid")),
    phone: z
      .string()
      .trim()
      .min(6, t(locale, "auth.errorPhoneTooShort"))
      .max(24, t(locale, "auth.errorPhoneTooLong")),
    password: z.string().min(8, t(locale, "auth.errorPasswordTooShort")),
  });
}

function signInSchema(locale: Locale) {
  return z.object({
    email: z.email(t(locale, "auth.errorEmailInvalid")),
    password: z.string().min(1, t(locale, "auth.errorPasswordRequired")),
  });
}

function safeNext(next: FormDataEntryValue | null, fallback: string): string {
  const value = typeof next === "string" ? next : "";
  // Only ever redirect to a path on this origin.
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function homeFor(role: z.infer<typeof roleSchema>): string {
  return role === "business_owner" ? "/dashboard" : "/app";
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();

  if (formData.get("role") === "business_owner") {
    return errorState(t(locale, "auth.errorBusinessInviteOnly"));
  }

  // PDPA consent (handoff 07, legal-review.md §3): explicit, unticked by
  // default, checked server-side too since client validation can be
  // bypassed. Kept separate from the zod schema so it gets its own
  // field-level error without affecting the other fields' messages.
  if (formData.get("consent") !== "on") {
    const message = t(locale, "privacy.consentRequiredError");
    return errorState(message, { consent: message });
  }

  const parsed = signUpSchema(locale).safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "auth.errorCheckFields"),
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const { fullName, email, phone, password } = parsed.data;
  const role = "customer" as const;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Profile details for the `handle_new_user` trigger. The role here is
      // only a routing hint; the trigger never grants business_owner from it.
      data: { role, full_name: fullName, phone },
    },
  });

  if (error) {
    return errorState(
      error.message.toLowerCase().includes("already registered")
        ? t(locale, "auth.errorEmailAlreadyRegistered")
        : error.message,
    );
  }

  // Record the consent captured above (item 4: user id + timestamp + the
  // policy version in force now). Deliberately best-effort: the account
  // already exists at this point, and a transient failure here shouldn't
  // strand the new user on a dead-end sign-up page. This is safe — not a
  // silent PDPA gap — only because `createBookingAction`'s consent gate
  // (QA report #7 §5) independently re-checks `hasCurrentConsent` at
  // booking time and blocks a customer with no consent record at all, not
  // just a withdrawn one. So a failed insert here just means they're
  // prompted to consent before their first booking, not that they book
  // freely with no consent ever recorded.
  if (data.user) {
    await recordConsentAction(data.user.id);
  }

  // A customer who signed up from a shop's booking page goes straight back
  // to it. Owners always start at onboarding.
  redirect(safeNext(formData.get("next"), homeFor(role)));
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const locale = await getLocale();
  const parsed = signInSchema(locale).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return errorState(
      t(locale, "auth.errorCheckFields"),
      fieldErrorsFrom(z.flattenError(parsed.error).fieldErrors),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: do not confirm whether an address has an account.
    return errorState(t(locale, "auth.errorCredentialsMismatch"));
  }

  const role =
    (data.user.user_metadata?.role as z.infer<typeof roleSchema> | undefined) ??
    "customer";

  redirect(safeNext(formData.get("next"), homeFor(role)));
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const role = roleSchema.catch("customer").parse(formData.get("role"));

  // Mock mode: no real OAuth. "Continue with Google" just drops you into the
  // matching demo account.
  if (isMockMode()) {
    setMockUserByRole(await cookies(), role);
    redirect(homeFor(role));
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?role=${role}&next=${encodeURIComponent(
        homeFor(role),
      )}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    redirect(
      `/sign-in?error=${encodeURIComponent(error?.message ?? t(locale, "auth.errorGoogleSignInFailed"))}`,
    );
  }

  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
