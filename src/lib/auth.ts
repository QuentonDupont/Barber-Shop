import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BusinessRow, ProfileRow } from "@/lib/database.types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: ProfileRow;
}

/**
 * `cache` dedupes this across a single render pass, so a layout and three
 * nested components asking "who is this?" costs one round trip.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // The `handle_new_user` trigger should have made this row. If it is missing
    // the account is unusable, so fall back to a minimal in-memory profile
    // rather than crashing the whole portal.
    return {
      userId: user.id,
      email: user.email ?? null,
      profile: {
        id: user.id,
        role: (user.user_metadata?.role as ProfileRow["role"]) ?? "customer",
        full_name: (user.user_metadata?.full_name as string) ?? "",
        phone: (user.user_metadata?.phone as string) ?? null,
        email: user.email ?? null,
        avatar_url: null,
        pending_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }

  return { userId: user.id, email: user.email ?? null, profile };
});

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireCustomer(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.profile.role !== "customer") redirect("/dashboard");
  return session;
}

export interface OwnerContext extends SessionContext {
  /** `null` until the owner finishes step 1 of onboarding. */
  business: BusinessRow | null;
}

export const getOwnerContext = cache(async (): Promise<OwnerContext> => {
  const session = await requireSession();
  if (session.profile.role !== "business_owner") redirect("/app");

  const supabase = await createClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", session.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { ...session, business: business ?? null };
});

/**
 * For every dashboard screen that needs a business to exist. Sends the owner
 * back to onboarding if they have not created one yet.
 */
export async function requireBusiness(): Promise<OwnerContext & { business: BusinessRow }> {
  const ctx = await getOwnerContext();
  if (!ctx.business) redirect("/dashboard/onboarding");
  return { ...ctx, business: ctx.business };
}
