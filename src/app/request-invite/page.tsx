import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Request beta invite" };

/**
 * Static on purpose: during the invite-only beta, business accounts are made by
 * the TatNat team, so this page never creates an account or stores anything.
 */
export default function RequestInvitePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <Badge tone="accent">Invite-only beta</Badge>
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft">
        <Store className="size-7 text-accent" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">Request your invite.</h1>
        <p className="max-w-sm text-sm text-fg-muted text-pretty">
          We&rsquo;re onboarding a small number of shops by hand before opening up.
          Tell the TatNat team who shared this demo with you about your business
          and we&rsquo;ll reach out.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button asChild size="lg" block variant="ghost">
          <Link href="/">Back to TatNat</Link>
        </Button>
        <Button asChild size="md" block variant="ghost">
          <Link href="/sign-in?role=business_owner">I already have an invite</Link>
        </Button>
      </div>
    </div>
  );
}
