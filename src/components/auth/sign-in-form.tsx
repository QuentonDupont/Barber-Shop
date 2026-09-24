"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/misc";
import { GoogleButton } from "./google-button";
import type { Role } from "./role-toggle";
import { signInAction } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending}>
      Sign in
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
  const [state, formAction] = useActionState(signInAction, idleState);
  const [showPassword, setShowPassword] = useState(false);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          New to Bookly?{" "}
          <Link
            href={`/sign-up?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
            className="inline-block -my-3.5 px-1 py-3.5 font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {oauthError ? <Alert tone="error">{oauthError}</Alert> : null}
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <form action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password} required>
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
              aria-label={showPassword ? "Hide password" : "Show password"}
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
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <GoogleButton role={role} />
    </div>
  );
}
