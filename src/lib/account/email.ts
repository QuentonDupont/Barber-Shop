/** Email-change validation (customer account). Pure, unit-tested. */

export type EmailChangeError = "empty" | "invalid" | "same";

export type EmailChangeResult =
  | { ok: true; email: string }
  | { ok: false; error: EmailChangeError };

// Deliberately plain: one @, something on both sides, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateEmailChange(input: unknown, current: string | null): EmailChangeResult {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!email) return { ok: false, error: "empty" };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "invalid" };
  if (current && email === current.trim().toLowerCase()) return { ok: false, error: "same" };
  return { ok: true, email };
}
