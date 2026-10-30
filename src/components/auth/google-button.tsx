"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/context";
import type { Role } from "./role-toggle";

function Submit() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" variant="outline" size="lg" block loading={pending}>
      {pending ? null : <GoogleMark />}
      {t("auth.continueWithGoogle")}
    </Button>
  );
}

export function GoogleButton({ role }: { role: Role }) {
  return (
    <form action={signInWithGoogleAction}>
      <input type="hidden" name="role" value={role} />
      <Submit />
    </form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.5 5.5 0 0 1-2.4 3.6v3h3.87c2.27-2.09 3.58-5.17 3.58-8.78Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3a7.2 7.2 0 0 1-10.72-3.78H1.34v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.34a12 12 0 0 0 0 10.78l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.34 6.61l4.01 3.09A7.2 7.2 0 0 1 12 4.75Z"
      />
    </svg>
  );
}
