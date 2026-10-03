import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import type { Role } from "@/components/auth/role-toggle";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const role: Role = params.role === "business_owner" ? "business_owner" : "customer";
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;

  return <SignInForm role={role} next={next} oauthError={params.error} />;
}
