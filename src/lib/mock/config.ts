/**
 * Front-end-first "mock mode".
 *
 * When `NEXT_PUBLIC_USE_MOCK=1` the whole data layer is served from in-memory
 * fixtures instead of Supabase, so the UI can be built and clicked through with
 * no Docker, no database and no real auth. The real Supabase path is untouched —
 * flip the flag off (or leave it unset) and the app talks to Postgres again.
 *
 * This module holds only tiny, dependency-free helpers so it is safe to import
 * from the Edge middleware runtime as well as the Node server runtime.
 */

/** Cookie that stands in for a Supabase auth session in mock mode. */
export const MOCK_COOKIE = "bookly_mock_user";

/** True when the app should run against in-memory fixtures. */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "1";
}

/**
 * The cookie carries `role:id` so the Edge middleware can route by role without
 * loading the fixture store (a separate runtime from the Node server, so it
 * cannot share the in-memory data anyway).
 */
export function encodeMockCookie(role: string, id: string): string {
  return `${role}:${id}`;
}

export function decodeMockCookie(
  value: string | undefined | null,
): { role: string; id: string } | null {
  if (!value) return null;
  const i = value.indexOf(":");
  if (i < 0) return null;
  const role = value.slice(0, i);
  const id = value.slice(i + 1);
  if (!role || !id) return null;
  return { role, id };
}
