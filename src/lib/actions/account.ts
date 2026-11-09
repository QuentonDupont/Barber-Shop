"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth";
import { isMockMode } from "@/lib/mock/config";
import { validateEmailChange } from "@/lib/account/email";
import { DEFAULT_PREFS, applyMarketingChoice, type NotificationPrefs } from "@/lib/account/prefs";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { errorState, successState, type ActionState } from "./types";

/**
 * Customer account actions beyond name and phone (see profile.ts):
 * verified email change, and the two notification-choice forms. The photo goes
 * through /api/account/photo because a Server Action's body limit is 1 MB.
 * All writes are scoped to the signed-in customer (and RLS enforces it too).
 */

function refresh() {
  revalidatePath("/app/account");
  revalidatePath("/app", "layout");
}

/** Step 1 of an email change: ask for the new address; the old one stays current. */
export async function requestEmailChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = await getLocale();
  const session = await requireCustomer();
  const checked = validateEmailChange(formData.get("newEmail"), session.email);
  if (!checked.ok) {
    const key = { empty: "emailEmpty", invalid: "emailInvalid", same: "emailSame" }[checked.error];
    return errorState(t(locale, `accountCustomer.${key}`), { newEmail: t(locale, `accountCustomer.${key}`) });
  }

  const supabase = await createClient();
  if (!isMockMode()) {
    // Sends the confirm link to the new address (and a notice to the old one when
    // the project has "secure email change" on). auth.users.email does not
    // change until the link is used.
    const { error } = await supabase.auth.updateUser({ email: checked.email });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return errorState(t(locale, taken ? "accountCustomer.emailTaken" : "accountCustomer.emailFailed"));
    }
  }
  const { error } = await supabase
    .from("profiles")
    .update({ pending_email: checked.email })
    .eq("id", session.userId);
  if (error) return errorState(t(locale, "accountCustomer.emailFailed"));

  refresh();
  return successState(t(locale, "accountCustomer.emailSent", { email: checked.email }));
}

/** Drop a pending change. Real mode: the link already sent is simply ignored by the UI. */
export async function cancelEmailChangeAction(): Promise<ActionState> {
  const locale = await getLocale();
  const session = await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ pending_email: null }).eq("id", session.userId);
  if (error) return errorState(t(locale, "accountCustomer.emailFailed"));
  refresh();
  return successState(t(locale, "accountCustomer.emailCancelled"));
}

/**
 * Mock mode only: stands in for the customer clicking the link in their inbox.
 * In real mode the link goes through Supabase and this action refuses.
 */
export async function demoConfirmEmailAction(): Promise<ActionState> {
  const locale = await getLocale();
  if (!isMockMode()) return errorState(t(locale, "accountCustomer.emailFailed"));
  const session = await requireCustomer();
  const pending = session.profile.pending_email;
  if (!pending) return errorState(t(locale, "accountCustomer.emailFailed"));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: pending });
  if (error) return errorState(t(locale, "accountCustomer.emailFailed"));
  await supabase.from("profiles").update({ pending_email: null }).eq("id", session.userId);
  refresh();
  return successState(t(locale, "accountCustomer.emailConfirmed", { email: pending }));
}

async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  const supabase = await createClient();
  const { data } = await supabase.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  return data ? { ...DEFAULT_PREFS, ...data } : DEFAULT_PREFS;
}

/** Service messages: confirmations and reminders. Never touches the marketing choice. */
export async function saveServicePrefsAction(input: {
  bookingConfirmations: boolean;
  reminders: boolean;
}): Promise<ActionState> {
  const locale = await getLocale();
  const session = await requireCustomer();
  const supabase = await createClient();
  const { error } = await supabase.from("notification_prefs").upsert(
    {
      user_id: session.userId,
      booking_confirmations: input.bookingConfirmations === true,
      reminders: input.reminders === true,
    },
    { onConflict: "user_id" },
  );
  if (error) return errorState(t(locale, "accountCustomer.notifFailed"));
  refresh();
  return successState(t(locale, "accountCustomer.notifSaved"));
}

/** Marketing: its own switch and its own save. Turning it on records the consent time. */
export async function saveMarketingPrefAction(input: { marketing: boolean }): Promise<ActionState> {
  const locale = await getLocale();
  const session = await requireCustomer();
  const supabase = await createClient();
  const prev = await loadPrefs(session.userId);
  const next = applyMarketingChoice(prev, input.marketing === true, new Date().toISOString());
  const { error } = await supabase.from("notification_prefs").upsert(
    {
      user_id: session.userId,
      marketing: next.marketing,
      marketing_consented_at: next.marketing_consented_at,
      marketing_withdrawn_at: next.marketing_withdrawn_at,
      marketing_consent_version: next.marketing_consent_version,
    },
    { onConflict: "user_id" },
  );
  if (error) return errorState(t(locale, "accountCustomer.notifFailed"));
  refresh();
  return successState(t(locale, next.marketing ? "accountCustomer.marketingSavedOn" : "accountCustomer.marketingSavedOff"));
}
