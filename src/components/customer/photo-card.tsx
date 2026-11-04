"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AVATAR_MAX_BYTES } from "@/lib/account/image";
import { useT } from "@/lib/i18n/context";

const ACCEPT = "image/jpeg,image/png,image/webp";

/**
 * Optional profile photo. The browser pre-checks size and type for a quick,
 * friendly message; the server decides again from the file's actual bytes.
 */
export function PhotoCard({ photoUrl }: { photoUrl: string | null }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(request: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await request();
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && body?.ok) {
        toast.success(body.message);
        router.refresh();
      } else {
        setError(body?.message ?? t("accountCustomer.photoErrFailed"));
      }
    } catch {
      setError(t("accountCustomer.photoErrFailed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    const reject = (message: string) => {
      setError(message);
      if (input.current) input.current.value = "";
    };
    if (file.size > AVATAR_MAX_BYTES) return reject(t("accountCustomer.photoErrSize"));
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return reject(t("accountCustomer.photoErrType"));
    }
    const body = new FormData();
    body.append("file", file);
    void send(() => fetch("/api/account/photo", { method: "POST", body }));
  }

  return (
    <Card data-testid="photo-card">
      <CardHeader>
        <CardTitle>{t("accountCustomer.photoTitle")}</CardTitle>
        <CardDescription>{t("accountCustomer.photoDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-muted text-fg-subtle">
            {photoUrl ? (
              // A short-lived signed URL (or a data URL in demo mode), not a next/image host.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={t("accountCustomer.photoAlt")}
                className="size-full object-cover"
                data-testid="photo-img"
              />
            ) : (
              <UserRound className="size-10" aria-label={t("accountCustomer.photoNone")} />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              data-testid="photo-input"
              tabIndex={-1}
              aria-label={t("accountCustomer.photoChoose")}
              onChange={(e) => onPick(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="md"
              block
              loading={busy}
              onClick={() => input.current?.click()}
            >
              <Camera />
              {photoUrl ? t("accountCustomer.photoReplace") : t("accountCustomer.photoChoose")}
            </Button>
            {photoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                block
                disabled={busy}
                className="text-danger"
                onClick={() => void send(() => fetch("/api/account/photo", { method: "DELETE" }))}
              >
                <Trash2 />
                {t("accountCustomer.photoRemove")}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-fg-muted">{t("accountCustomer.photoHint")}</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </CardContent>
    </Card>
  );
}
