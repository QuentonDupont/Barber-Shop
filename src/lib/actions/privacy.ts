"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy/policy";
import {
  errorState,
  successState,
  type ActionState,
  type ExportDataState,
} from "./types";

/**
 * PDPA data-subject-rights actions (handoff 07, legal-review.md §3).
 *
 * Mock/seed data only here — no real customer data, no PSP code (legal gate
 * item 5 stays closed; this only touches gate item 3's conditions). Written
 * against the `consent_records` / `deletion_requests` contract the
 * migrations/RLS stream adds on this same branch — every query below is
 * scoped to the signed-in user's own `user_id`, matching the RLS policy
 * (`user_id = auth.uid()`) those migrations enforce server-side too.
 */

/**
 * Writes one `consent_records` row for `userId` at the current policy
 * version. Called two ways:
 *  - directly from `signUpAction` (`src/lib/actions/auth.ts`) right after a
 *    successful sign-up, passing the just-created user's id — avoids any
 *    session-propagation race within the same request (item 4).
 *  - with no argument, from the account page's "give consent again" action,
 *    once a withdrawn customer wants to resume booking (item 15).
 */
export async function recordConsentAction(userId?: string): Promise<{ error: string | null }> {
  const id = userId ?? (await requireCustomer()).userId;
  const supabase = await createClient();

  const { error } = await supabase.from("consent_records").insert({
    user_id: id,
    policy_version: PRIVACY_POLICY_VERSION,
  });

  if (!error) revalidatePath("/app/account");
  return { error: error?.message ?? null };
}

/**
 * Item 12: the signed-in user's own profile, bookings, consent history and
 * any customer-notes-about-them — never another user's rows.
 *
 * `customer_notes` is deliberately walled off from customers by RLS
 * ("never to the customer", stretch A) because it is a business's private
 * note *about* a customer — but PDPA's right of access means the customer
 * must still be able to get a copy of data held about them. The admin
 * client bypasses that RLS wall for this one read, filtered by
 * `session.userId`, which comes from `requireCustomer()` — i.e. from the
 * authenticated caller's own session, never from request input — matching
 * `lib/supabase/server.ts`'s own rule for when the admin client is safe to
 * use ("never hand this client a value that came from a request without
 * checking the caller's authorisation first").
 */
export async function exportMyDataAction(): Promise<ExportDataState> {
  const session = await requireCustomer();
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: profile }, { data: bookings }, { data: consentRecords }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", session.userId).maybeSingle(),
    supabase
      .from("bookings")
      .select("*")
      .eq("customer_id", session.userId)
      .order("starts_at", { ascending: false }),
    supabase
      .from("consent_records")
      .select("*")
      .eq("user_id", session.userId)
      .order("consented_at", { ascending: false }),
  ]);

  const admin = createAdminClient();
  const { data: notesAboutYou } = await admin
    .from("customer_notes")
    .select("business_id, note, created_at, updated_at")
    .eq("customer_id", session.userId);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    bookings: bookings ?? [],
    consentRecords: consentRecords ?? [],
    notesAboutYou: notesAboutYou ?? [],
  };

  return {
    status: "success",
    message: t(locale, "privacy.downloadDataSuccess"),
    json: JSON.stringify(payload, null, 2),
    filename: `tatnat-my-data-${session.userId}.json`,
  };
}

/**
 * Item 13: starts the deletion path, scoped to the requesting user only.
 * Idempotent — a second click while one is still pending doesn't create a
 * duplicate row.
 */
export async function requestDeletionAction(): Promise<ActionState> {
  const session = await requireCustomer();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("deletion_requests")
    .select("id")
    .eq("user_id", session.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return successState(t(locale, "privacy.requestDeletionAlready"));
  }

  const { error } = await supabase
    .from("deletion_requests")
    .insert({ user_id: session.userId });

  if (error) return errorState(t(locale, "privacy.requestDeletionError"));

  revalidatePath("/app/account");
  return successState(t(locale, "privacy.requestDeletionSuccess"));
}

/**
 * Item 14: records a withdrawal timestamp on the user's latest consent row.
 * Does NOT delete the account — withdrawal and deletion are different
 * actions with different effects (handoff 07). Combined with the check in
 * `createBookingAction` (item 15), a withdrawn customer is blocked from
 * making new bookings until they consent again.
 */
export async function withdrawConsentAction(): Promise<ActionState> {
  const session = await requireCustomer();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: latest } = await supabase
    .from("consent_records")
    .select("id, withdrawn_at")
    .eq("user_id", session.userId)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return errorState(t(locale, "privacy.consentNoneLabel"));
  }
  if (latest.withdrawn_at) {
    return successState(t(locale, "privacy.withdrawConsentAlready"));
  }

  const { error } = await supabase
    .from("consent_records")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("id", latest.id)
    .eq("user_id", session.userId);

  if (error) return errorState(t(locale, "privacy.withdrawConsentError"));

  revalidatePath("/app/account");
  return successState(t(locale, "privacy.withdrawConsentSuccess"));
}
