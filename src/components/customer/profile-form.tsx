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

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string;
  phone: string | null;
  email: string | null;
}) {
  const [state, formAction] = useActionState(saveProfileAction, idleState);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor="phone"
        error={errors.phone}
        hint="Shared with a shop only when you book with them."
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

      <Field
        label="Email"
        htmlFor="email"
        hint="Changing your sign-in email is not available yet."
      >
        <Input id="email" value={email ?? ""} disabled readOnly />
      </Field>

      <SaveButton />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      Save changes
    </Button>
  );
}
