import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing point. Supabase sends the user back here with a one-time code;
 * exchanging it sets the session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!code) {
    const reason = searchParams.get("error_description") ?? "Sign-in was cancelled";
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(reason)}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error?.message ?? "Could not complete sign-in")}`,
    );
  }

  // Invite-only beta: an OAuth sign-in is never promoted to a business here
  // (any `role` query parameter is ignored). Staff grant business_owner.

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const destination =
    profile?.role === "business_owner"
      ? "/dashboard"
      : safeNext.startsWith("/dashboard")
        ? "/app"
        : safeNext;

  return NextResponse.redirect(`${origin}${destination}`);
}
