/**
 * Owner legal / tax detail validators. Pure functions (no server-only imports)
 * so the form, the server action and vitest share one implementation. The
 * database repeats the same rules (migration 20261104000001_business_legal.sql).
 */

/** Digits only; strips spaces and dashes people type (1-2345-67890-12-1). */
export function normalizeDigits(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/** Thai 13-digit tax / national ID check digit: (11 - sum(d[i] * (13 - i)) mod 11) mod 10. */
export function isValidThaiTaxId(value: string): boolean {
  if (!/^[0-9]{13}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(value[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

/** "00000" is the head office; any other branch is a 5-digit number. */
export function isValidBranchCode(value: string): boolean {
  return /^[0-9]{5}$/.test(value);
}

export const HEAD_OFFICE_BRANCH = "00000";
