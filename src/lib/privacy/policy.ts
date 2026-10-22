/**
 * Shared PDPA privacy-policy constants (handoff 07, legal-review.md §3
 * "Clear with conditions"). The copy itself lives in `dictionaries.ts` under
 * the `privacy` namespace (th/en, same shape) — this file holds only the
 * values both the signup consent checkbox and the policy page need to agree
 * on byte-for-byte: the version string recorded on every `consent_records`
 * row, and the placeholder contact address.
 *
 * Bump `PRIVACY_POLICY_VERSION` whenever the policy's substance changes —
 * every consent is tied to a specific version, so a changed policy must
 * never be silently covered by an old agreement (item 4/10).
 */

// v2 (2026-10-22, legal-review.md 2026-10-22 section): the transfer, retention
// and "who sees this data" sections all changed substance (SCC claim walked
// back to "will put in place," retention wording corrected to match what the
// deletion job actually does, Google added as a sign-in processor) — bumped
// per this file's own rule above.
//
// v3 (2026-10-22, decision #21 / QA report #8): ONE sentence changed —
// `sectionRetentionBody`'s financial-records clause now ends "...and are
// then deleted" instead of stopping at "up to 5 years," because decision
// #21 committed to actually building the 5-year purge
// (pdpa_purge_financial_records_past_retention), not just describing
// anonymization. Everything else in the policy is unchanged from v2.
// **Flag for Legal's full re-review before real data** (per their own
// 2026-10-22 note that they re-review the whole policy anyway before the
// Draft banner comes off): only this one sentence needs a fresh look this
// time, not the full document.
export const PRIVACY_POLICY_VERSION = "2026-10-22-draft-3";

/**
 * Placeholder until Legal/the CEO names an actual data-protection contact
 * (legal-review.md §3's DPO note, handoff 07 item 9). Marked as a placeholder
 * in the policy page copy itself — not a real inbox yet. Domain corrected to
 * `tatnat.com` (legal-review.md 2026-10-22 §2(d)) — `naming.md`/decision 6
 * name `.com` as the domain to buy, not `.app`.
 */
export const PRIVACY_CONTACT_EMAIL = "privacy@tatnat.com";

/** Route for the bilingual, draft privacy-policy page (item 6). */
export const PRIVACY_POLICY_ROUTE = "/privacy";

/**
 * Minimum extra retention window for records Thai law treats as financial
 * (legal-review.md §3: "commonly ~5 years for financial records"), counted
 * from account closure. Account-lifetime data itself has no separate fixed
 * window — it lives as long as the account is open.
 */
export const FINANCIAL_RECORD_RETENTION_YEARS = 5;

/**
 * Pure retention-math helper (handoff 07 item 17, "unit tests cover any
 * extractable pure logic"): is `isoDate` past the financial-record retention
 * window, measured from `now`?
 */
export function isPastFinancialRetention(isoDate: string, now: Date = new Date()): boolean {
  const then = new Date(isoDate);
  const cutoff = new Date(then);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() + FINANCIAL_RECORD_RETENTION_YEARS);
  return cutoff.getTime() <= now.getTime();
}

/**
 * Pure version-comparison helper: has the policy changed since a given
 * consent was recorded? String identity is enough — versions are opaque,
 * sortable-looking date-prefixed tags, not a semver scheme to parse.
 */
export function isCurrentPolicyVersion(version: string): boolean {
  return version === PRIVACY_POLICY_VERSION;
}
