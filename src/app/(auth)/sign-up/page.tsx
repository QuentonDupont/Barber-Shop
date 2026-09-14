import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Role } from "@/components/auth/role-toggle";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const initialRole: Role = role === "business_owner" ? "business_owner" : "customer";
  return <SignUpForm initialRole={initialRole} />;
}
