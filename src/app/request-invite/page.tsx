import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Request beta invite" };

/**
 * Static on purpose: during the invite-only beta, business accounts are made by
 * the TatNat team, so this page never creates an account or stores anything.
 */
export default async function RequestInvitePage() {
  const locale = await getLocale();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <Badge tone="accent">{t(locale, "pages.inviteBadge")}</Badge>
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft">
        <Store className="size-7 text-accent" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">{t(locale, "pages.inviteTitle")}</h1>
        <p className="max-w-sm text-sm text-fg-muted text-pretty">
          {t(locale, "pages.inviteBody")}
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button asChild size="lg" block variant="ghost">
          <Link href="/">{t(locale, "pages.backHome")}</Link>
        </Button>
        <Button asChild size="md" block variant="ghost">
          <Link href="/sign-in?role=business_owner">{t(locale, "pages.haveInvite")}</Link>
        </Button>
      </div>
    </div>
  );
}
