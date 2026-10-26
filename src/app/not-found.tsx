import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata = { title: "Not found" };

/**
 * A shop link shared on LINE outlives the shop. Without this file that landed
 * on unbranded Next.js default output.
 */
export default async function NotFound() {
  const locale = await getLocale();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <EmptyState
        className="w-full"
        icon={MapPinOff}
        title={t(locale, "pages.notFoundTitle")}
        description={t(locale, "pages.notFoundDescription")}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="accent" size="lg">
              <Link href="/app">{t(locale, "pages.findPlace")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">{t(locale, "pages.goHome")}</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
