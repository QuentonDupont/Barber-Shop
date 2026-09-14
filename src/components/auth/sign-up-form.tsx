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
import { RoleToggle, type Role } from "./role-toggle";
import { GoogleButton } from "./google-button";
import { signUpAction } from "@/lib/actions/auth";
import { idleState } from "@/lib/actions/types";

function SubmitButton({ role }: { role: Role }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      block
      loading={pending}
      variant={role === "business_owner" ? "primary" : "accent"}
    >
      {role === "business_owner" ? "Create business account" : "Create account"}
    </Button>
  );
}

export function SignUpForm({ initialRole }: { initialRole: Role }) {
  const [state, formAction] = useActionState(signUpAction, idleState);
  const [role, setRole] = useState<Role>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Already with us?{" "}
          <Link href="/sign-in" className="inline-block -my-3.5 px-1 py-3.5 font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <form action={formAction} className="space-y-4" noValidate>
        <RoleToggle value={role} onChange={setRole} />

        <Field
          label={role === "business_owner" ? "Your name" : "Full name"}
          htmlFor="fullName"
          error={errors.fullName}
          required
        >
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            enterKeyHint="next"
            placeholder="Somchai Ratanakul"
            aria-invalid={Boolean(errors.fullName)}
            required
          />
        </Field>

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

        <Field
          label="Mobile number"
          htmlFor="phone"
          error={errors.phone}
          hint="Used only so a shop can reach you about a booking."
          required
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder="081 234 5678"
            aria-invalid={Boolean(errors.phone)}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters."
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
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </Field>

        <SubmitButton role={role} />
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <GoogleButton role={role} />

      <p className="text-center text-xs leading-relaxed text-fg-subtle text-pretty">
        By creating an account you agree to Bookly&rsquo;s terms of service and
        privacy policy.
      </p>
    </div>
  );
}
