import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing point. Supabase sends the user back here with a one-time code;
 * exchanging it sets the session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const role = searchParams.get("role");
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

  // A Google sign-in carries no role, so the trigger defaulted the profile to
  // `customer`. If the user came in through the "I'm a business" door, promote
  // them now — but only on their very first visit, so an existing customer
  // cannot flip themselves into a business account by editing the URL.
  if (role === "business_owner") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, created_at")
      .eq("id", data.user.id)
      .maybeSingle();

    const createdAt = profile ? Date.parse(profile.created_at) : NaN;
    const isBrandNew = Number.isFinite(createdAt) && Date.now() - createdAt < 60_000;

    if (profile?.role === "customer" && isBrandNew) {
      await supabase
        .from("profiles")
        .update({ role: "business_owner" })
        .eq("id", data.user.id);
      await supabase.auth.updateUser({ data: { role: "business_owner" } });
    }
  }

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
