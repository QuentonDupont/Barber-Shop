"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelEmailChangeAction,
  demoConfirmEmailAction,
  requestEmailChangeAction,
} from "@/lib/actions/account";
import { idleState } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/context";

/**
 * Verified email change. The current address stays the sign-in email until the
 * new one is confirmed. In mock mode a clearly labelled "Demo: confirm" button
 * stands in for the link in the inbox.
 */
export function EmailChangeCard({
  email,
  pendingEmail,
  demo,
}: {
  email: string | null;
  pendingEmail: string | null;
  demo: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, submitting] = useActionState(requestEmailChangeAction, idleState);
  const [busy, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fieldError = state.status === "error" ? (state.fieldErrors?.newEmail ?? state.message) : undefined;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  function run(action: typeof cancelEmailChangeAction) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  }

  return (
    <Card data-testid="email-card">
      <CardHeader>
        <CardTitle>{t("accountCustomer.emailTitle")}</CardTitle>
        <CardDescription>{t("accountCustomer.emailDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-fg">{t("accountCustomer.emailCurrent")}</p>
          <p className="break-all text-base text-fg" data-testid="current-email">
            {email || t("accountCustomer.emailNone")}
          </p>
        </div>

        {pendingEmail ? (
          <div className="space-y-3" data-testid="pending-email">
            <Alert tone="info" title={t("accountCustomer.emailPendingTitle")}>
              <p className="break-all font-medium" data-testid="pending-email-address">{pendingEmail}</p>
              <p>{t("accountCustomer.emailPendingBody", { email: pendingEmail })}</p>
            </Alert>
            {demo ? (
              <div className="space-y-2">
                <p className="text-sm text-fg-muted">{t("accountCustomer.emailDemoNote")}</p>
                <Button
                  type="button"
                  variant="accent"
                  size="md"
                  block
                  loading={busy}
                  onClick={() => run(demoConfirmEmailAction)}
                >
                  {t("accountCustomer.emailDemoConfirm")}
                </Button>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="md"
              block
              disabled={busy}
              onClick={() => run(cancelEmailChangeAction)}
            >
              {t("accountCustomer.emailCancel")}
            </Button>
          </div>
        ) : (
          <form ref={formRef} action={formAction} className="space-y-3" noValidate>
            <Field label={t("accountCustomer.emailNew")} htmlFor="newEmail" error={fieldError}>
              <Input
                id="newEmail"
                name="newEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                aria-invalid={fieldError ? true : undefined}
              />
            </Field>
            <Button type="submit" size="md" block variant="outline" loading={submitting}>
              {t("accountCustomer.emailChange")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
