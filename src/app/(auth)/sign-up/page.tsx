import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  // Invite-only beta: sign-up makes customer accounts only. Someone arriving
  // from an old "business" link is told how to get an invite.
  return <SignUpForm businessLinkUsed={role === "business_owner"} next={safeNext} />;
}
