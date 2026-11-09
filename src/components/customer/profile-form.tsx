"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { saveProfileAction } from "@/lib/actions/profile";
import { idleState } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/context";

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string | null;
}) {
  const [state, formAction] = useActionState(saveProfileAction, idleState);
  const errors = state.fieldErrors ?? {};
  const t = useT();

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? t("account.saved"));
  }, [state, t]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label={t("account.fullName")} htmlFor="fullName" error={errors.fullName} required>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
      </Field>

      <Field
        label={t("account.mobile")}
        htmlFor="phone"
        error={errors.phone}
        hint={t("account.mobileHint")}
        required
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          required
        />
      </Field>

      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      {t("account.save")}
    </Button>
  );
}
