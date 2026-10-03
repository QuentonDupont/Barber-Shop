"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { requireSupabaseEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser client. Used only for authentication flows (OAuth redirect, password
 * reset, sign-out) — every read and write of application data happens in a
 * Server Action or Server Component.
 */
export function createClient() {
  if (cached) return cached;
  const { url, anonKey } = requireSupabaseEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
