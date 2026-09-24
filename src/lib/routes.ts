/**
 * A business's public booking page.
 *
 * Deliberately outside `/app`: that tree is customer-only, so owners were
 * bounced to their dashboard when they tried to view their own page, and a
 * shop couldn't share a link with someone who hadn't signed up yet. `/b/…`
 * is readable by anyone RLS allows — customers, signed-out visitors, and the
 * owner (who can also see it before it's published).
 */
export function businessPath(slug: string, query?: Record<string, string>): string {
  const base = `/b/${encodeURIComponent(slug)}`;
  if (!query) return base;
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
