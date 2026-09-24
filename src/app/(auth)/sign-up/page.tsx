import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Role } from "@/components/auth/role-toggle";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;
  const initialRole: Role = role === "business_owner" ? "business_owner" : "customer";
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return <SignUpForm initialRole={initialRole} next={safeNext} />;
}
