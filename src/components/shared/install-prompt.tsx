"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n/context";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Add to home screen", which is how TatNat gets a launcher icon without an
 * app store.
 *
 * Chrome fires `beforeinstallprompt` and lets us drive the native dialog. iOS
 * Safari does neither, so it gets the manual Share-sheet instructions instead —
 * and since iOS is most of this audience, that path is the one that matters.
 */
export function InstallPrompt() {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Non-standard, iOS only.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !/crios|fxios/i.test(navigator.userAgent),
    );

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIos) return null;

  return (
    <Card className="border-accent/30 bg-accent-soft/35">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-fg-muted" />
          {t("customer.installTitle")}
        </CardTitle>
        <CardDescription>{t("customer.installDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {deferred ? (
          <Button
            variant="accent"
            size="lg"
            block
            onClick={async () => {
              await deferred.prompt();
              const { outcome } = await deferred.userChoice;
              if (outcome === "accepted") setInstalled(true);
              setDeferred(null);
            }}
          >
            {t("customer.installButton")}
          </Button>
        ) : (
          <ol className="space-y-2.5 text-sm text-fg-muted">
            <li className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold">
                1
              </span>
              {t("customer.installStep1a")}
              <Share className="size-4 shrink-0 text-fg-muted" />
              {t("customer.installStep1b")}
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold">
                2
              </span>
              {t("customer.installStep2a")}
              <SquarePlus className="size-4 shrink-0 text-fg-muted" />
              {t("customer.installStep2b")}
            </li>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
