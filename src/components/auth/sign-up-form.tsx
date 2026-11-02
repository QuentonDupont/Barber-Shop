"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { BETA_INVITE_HREF } from "@/lib/beta";
import { GoogleButton } from "./google-button";
import { signUpAction } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/context";
import { PRIVACY_POLICY_ROUTE, PRIVACY_POLICY_VERSION } from "@/lib/privacy/policy";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" block loading={pending} variant="accent">
      {t("auth.createAccountButton")}
    </Button>
  );
}

export function SignUpForm({
  businessLinkUsed,
  next,
}: {
  businessLinkUsed: boolean;
  next?: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState(signUpAction, idleState);
  const [showPassword, setShowPassword] = useState(false);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-[30px] sm:text-4xl">
          {t("auth.createYourAccount")}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {t("auth.alreadyWithUs")}{" "}
          <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className="inline-block -my-3.5 px-1 py-3.5 font-semibold text-accent-ink underline underline-offset-4">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>

      {businessLinkUsed ? (
        <Alert tone="info">
          {t("auth.businessInviteNotice")}{" "}
          <Link href={BETA_INVITE_HREF} className="font-semibold underline">
            {t("auth.requestBetaInvite")}
          </Link>
          {t("auth.businessInviteSuffix")}
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <form action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field
          label={t("auth.fullNameLabel")}
          htmlFor="fullName"
          error={errors.fullName}
          required
        >
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            enterKeyHint="next"
            placeholder={t("auth.fullNamePlaceholder")}
            aria-invalid={Boolean(errors.fullName)}
            required
          />
        </Field>

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

        <Field
          label={t("auth.mobileNumberLabel")}
          htmlFor="phone"
          error={errors.phone}
          hint={t("auth.mobileNumberHint")}
          required
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder={t("auth.mobileNumberPlaceholder")}
            aria-invalid={Boolean(errors.phone)}
            required
          />
        </Field>

        <Field
          label={t("auth.passwordLabel")}
          htmlFor="password"
          error={errors.password}
          hint={t("auth.passwordHint")}
          required
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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

        {/* PDPA consent (legal-review.md §3): its own control, unticked by
            default, kept structurally separate from the terms-of-service
            sentence below — two distinct controls, never bundled. */}
        <div className="space-y-1.5 rounded-lg border border-border-strong p-3">
          <label htmlFor="consent" className="flex items-start gap-2.5 text-sm text-pretty">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              defaultChecked={false}
              aria-invalid={Boolean(errors.consent)}
              className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
            />
            <span>
              {t("privacy.consentCheckboxLabel", { version: PRIVACY_POLICY_VERSION })}{" "}
              <Link
                href={PRIVACY_POLICY_ROUTE}
                target="_blank"
                className="font-semibold text-accent-ink hover:underline"
              >
                {t("privacy.policyLinkLabel")}
              </Link>
            </span>
          </label>
          {errors.consent ? (
            <p className="text-sm text-danger" role="alert">
              {errors.consent}
            </p>
          ) : null}
        </div>

        <SubmitButton />
      </form>

      <p className="my-4 text-center text-[13px] text-fg-muted">{t("auth.or")}</p>

      <GoogleButton role="customer" />

      <p className="text-center text-xs leading-relaxed text-fg-subtle text-pretty">
        {t("auth.termsNoticePrefix")}{" "}
        <Link href={PRIVACY_POLICY_ROUTE} target="_blank" className="underline hover:text-fg">
          {t("privacy.policyLinkLabel")}
        </Link>
        {t("auth.termsNoticeSuffix")}
      </p>
    </div>
  );
}
