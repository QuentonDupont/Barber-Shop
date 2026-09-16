import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMockMode } from "@/lib/mock/config";
import { createMockClient } from "@/lib/mock/client";
import { requireSupabaseEnv } from "./env";

/**
 * Request-scoped client that carries the signed-in user and therefore obeys
 * RLS. This is the only client that should touch user data.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  // `cookies()` first, and deliberately so: awaiting it is what marks the
  // surrounding route as dynamic. Throwing on missing configuration before that
  // point makes the build treat these pages as statically prerenderable and
  // then fail on the throw.
  const cookieStore = await cookies();

  // Front-end-first mock mode: serve everything from in-memory fixtures.
  if (isMockMode()) {
    return createMockClient(cookieStore);
  }

  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to swallow.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely, so it is only for work the user
 * cannot do on their own behalf — currently just reading a booking's
 * counterparty in order to email them.
 *
 * Never hand this client a value that came from a request without checking the
 * caller's authorisation first.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (isMockMode()) {
    // No RLS to bypass in mock mode; the fixture store is fully readable.
    return createMockClient(null);
  }
  const { url } = requireSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
