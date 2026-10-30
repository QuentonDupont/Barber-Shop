import { createClient } from "@supabase/supabase-js";
import { checkHealth } from "@/lib/health";
import { isMockMode } from "@/lib/mock/config";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/** Always live: a cached "ok" would defeat the purpose of a health check. */
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

async function handle(): Promise<Response> {
  const mock = isMockMode();
  const result = await checkHealth({
    mock,
    probe: () => {
      // Anonymous client on purpose: no session, nothing read but the
      // `health_check()` function, which returns only ok + a timestamp.
      const { url, anonKey } = requireSupabaseEnv();
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return client.rpc("health_check");
    },
  });
  return Response.json(result.body, { status: result.status, headers: HEADERS });
}

export async function GET(): Promise<Response> {
  return handle();
}

export async function HEAD(): Promise<Response> {
  const res = await handle();
  return new Response(null, { status: res.status, headers: HEADERS });
}
