import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { readSupabaseEnv } from "./env";

/**
 * Refreshes the auth cookie on every request and reports who the caller is, so
 * `middleware.ts` can route by role without a second round trip.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readSupabaseEnv();
  if (!env) {
    return { response, userId: null as string | null, role: null as string | null };
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser` (not `getSession`) — it revalidates the JWT with the auth server
  // rather than trusting a cookie the client could have forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, userId: null, role: null };
  }

  // The role lives in the JWT's user metadata as well as in `profiles`, so the
  // common case needs no database hit. Fall back to the table if it is absent
  // (e.g. a user created before the metadata was written).
  let role = (user.user_metadata?.role as string | undefined) ?? null;
  if (role !== "customer" && role !== "business_owner") {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = data?.role ?? "customer";
  }

  return { response, userId: user.id, role };
}
