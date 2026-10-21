/**
 * PDPA retention/deletion math (roadmap.md §1 row 7; legal-review.md §3's
 * retention condition; handoff 07). Pure logic only — the database-side
 * enforcement (which rows actually get anonymized) lives in
 * `pdpa_accounts_past_retention` / `pdpa_process_deletion_requests`
 * (migration 20261021120000_pdpa_consent_and_deletion.sql). This module
 * exists so the grace-period rule can be unit-tested without a database, and
 * so the UI (account page "request deletion" copy) can show the same date
 * the database will actually act on.
 */

/** Days a deletion request waits before it's eligible for processing — gives
 * the user a window to change their mind, per legal-review.md §3. Must match
 * the default argument on both SQL functions in the migration. */
export const DELETION_GRACE_DAYS = 30;

/** The instant a given deletion request becomes eligible for processing. */
export function deletionReadyAt(requestedAt: Date, graceDays: number = DELETION_GRACE_DAYS): Date {
  const ready = new Date(requestedAt.getTime());
  ready.setUTCDate(ready.getUTCDate() + graceDays);
  return ready;
}

/** Whether a deletion request filed at `requestedAt` is past its grace
 * window as of `now` (defaults to the real current time). */
export function isPastDeletionGrace(
  requestedAt: Date,
  now: Date = new Date(),
  graceDays: number = DELETION_GRACE_DAYS,
): boolean {
  return now.getTime() >= deletionReadyAt(requestedAt, graceDays).getTime();
}

/** Whether a user's consent is currently valid for processing their data:
 * they must have consented to the policy version in force, and not have
 * withdrawn since. Used wherever booking-creation gates on consent
 * (test item 15) — withdrawing blocks new processing without touching the
 * account itself. */
export function hasCurrentConsent(
  consent: { policyVersion: string; withdrawnAt: Date | null } | null,
  currentPolicyVersion: string,
): boolean {
  if (!consent) return false;
  if (consent.withdrawnAt !== null) return false;
  return consent.policyVersion === currentPolicyVersion;
}
