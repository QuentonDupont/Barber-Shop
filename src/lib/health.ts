/**
 * Health check for the uptime monitor (operations-plan.md §5): the monitor
 * pings /api/health, which must fail whenever the booking database is not
 * answering - a page that renders is not proof the bookings work.
 *
 * Pure and dependency-injected so it is unit-tested without a database.
 * The response never carries error text: the endpoint is public.
 */
export interface HealthBody {
  ok: boolean;
  db: "up" | "down" | "mock";
  latency_ms: number;
  checked_at: string;
}

export interface HealthResult {
  status: 200 | 503;
  body: HealthBody;
}

export const HEALTH_TIMEOUT_MS = 3000;

export async function checkHealth(options: {
  probe: () => PromiseLike<{ data: unknown; error: unknown }>;
  mock?: boolean;
  timeoutMs?: number;
  now?: () => number;
}): Promise<HealthResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const done = (ok: boolean, db: HealthBody["db"]): HealthResult => ({
    status: ok ? 200 : 503,
    body: { ok, db, latency_ms: now() - started, checked_at: new Date(now()).toISOString() },
  });

  if (options.mock) return done(true, "mock");

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), options.timeoutMs ?? HEALTH_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([options.probe(), timeout]);
    const ok = !error && typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === true;
    return done(ok, ok ? "up" : "down");
  } catch {
    return done(false, "down");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
