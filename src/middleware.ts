import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Routes that require a signed-in customer. */
const CUSTOMER_PREFIX = "/app";
/** Routes that require a signed-in business owner. */
const BUSINESS_PREFIX = "/dashboard";
/** Auth screens a signed-in user should be bounced away from. */
const AUTH_PATHS = ["/sign-in", "/sign-up"];

export async function middleware(request: NextRequest) {
  const { response, userId, role } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const homeFor = (r: string | null) =>
    r === "business_owner" ? BUSINESS_PREFIX : CUSTOMER_PREFIX;

  // --- signed out ---------------------------------------------------------
  if (!userId) {
    if (pathname.startsWith(CUSTOMER_PREFIX) || pathname.startsWith(BUSINESS_PREFIX)) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.search = "";
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // --- signed in ----------------------------------------------------------
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Keep each role in its own portal. A customer landing on /dashboard is far
  // more likely to be a stale bookmark than an attack, so redirect rather
  // than 403 — the RLS policies are what actually stop cross-role reads.
  if (pathname.startsWith(BUSINESS_PREFIX) && role !== "business_owner") {
    const url = request.nextUrl.clone();
    url.pathname = CUSTOMER_PREFIX;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith(CUSTOMER_PREFIX) && role === "business_owner") {
    const url = request.nextUrl.clone();
    url.pathname = BUSINESS_PREFIX;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the PWA shell and image files — those
     * never need a session refresh and the redirect would break installs.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
