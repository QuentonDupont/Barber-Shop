"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useT } from "@/lib/i18n/context";

/**
 * Root error boundary. Without it any thrown error rendered Next.js's own
 * unbranded error output.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // No error reporting service is wired up yet, so the console is the only
    // place this survives.
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <EmptyState
        className="w-full"
        icon={AlertTriangle}
        title={t("pages.errorTitle")}
        description={t("pages.errorDescription")}
        action={
          <Button variant="accent" size="lg" onClick={reset}>
            {t("pages.tryAgain")}
          </Button>
        }
      />
    </main>
  );
}
