"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Eye, EyeOff, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/misc";
import { GoogleButton } from "./google-button";
import type { Role } from "./role-toggle";
import { signInAction } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/context";

const MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK === "1";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      {t("auth.signIn")}
    </Button>
  );
}

export function SignInForm({
  role,
  next,
  oauthError,
}: {
  role: Role;
  next?: string;
  oauthError?: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(signInAction, idleState);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  function demoLogin(email: string) {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = email;
    (form.elements.namedItem("password") as HTMLInputElement).value = "bookly123";
    form.requestSubmit();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("auth.welcomeBack")}</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {t("auth.newToTatnat")}{" "}
          <Link
            href={`/sign-up?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
            className="inline-block -my-3.5 px-1 py-3.5 font-semibold text-accent hover:underline">
            {t("auth.createAnAccount")}
          </Link>
        </p>
      </div>

      {MOCK_MODE ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-muted/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {t("auth.demoModeLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="md" onClick={() => demoLogin("owner@bookly.local")}>
              <Store className="size-4" />
              {t("auth.shopOwner")}
            </Button>
            <Button type="button" variant="outline" size="md" onClick={() => demoLogin("customer@bookly.local")}>
              <User className="size-4" />
              {t("auth.customer")}
            </Button>
          </div>
        </div>
      ) : null}

      {oauthError ? <Alert tone="error">{oauthError}</Alert> : null}
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <form ref={formRef} action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field label={t("auth.emailLabel")} htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            placeholder={t("auth.emailPlaceholder")}
            aria-invalid={Boolean(errors.email)}
            required
          />
        </Field>

        <Field label={t("auth.passwordLabel")} htmlFor="password" error={errors.password} required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              className="pr-12"
              aria-invalid={Boolean(errors.password)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:text-fg"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </Field>

        <SubmitButton />
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          {t("auth.or")}
        </span>
        <Separator className="flex-1" />
      </div>

      <GoogleButton role={role} />
    </div>
  );
}
