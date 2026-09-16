"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/misc";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/**
 * Theme is stored per device rather than per account: someone on a shared shop
 * tablet should not flip the colours for everyone.
 */
function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("bookly-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    setDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("bookly-theme", next ? "dark" : "light");
      return next;
    });
  };

  return { dark, toggle };
}

export function AccountMenu({
  name,
  email,
  variant = "compact",
}: {
  name: string;
  email?: string | null;
  variant?: "compact" | "sidebar";
}) {
  const { dark, toggle } = useTheme();
  // The sign-out form lives outside the menu: a submit button *inside* a Radix
  // menu item never fires, because the menu (and the button with it) unmounts on
  // select before the submit propagates. The item instead submits this form.
  const signOutRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={signOutRef} action={signOutAction} className="hidden" />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-lg outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-accent/40",
            variant === "sidebar"
              ? "w-full p-2 text-left hover:bg-surface-muted"
              : "size-11 justify-center",
          )}
          aria-label="Account menu"
        >
          <Avatar name={name} className={variant === "sidebar" ? "size-9" : "size-9"} />
          {variant === "sidebar" ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{name}</span>
              {email ? (
                <span className="block truncate text-xs text-fg-subtle">{email}</span>
              ) : null}
            </span>
          ) : null}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 min-w-56 rounded-xl border border-border bg-surface p-1.5",
            "shadow-[var(--shadow-raised)] data-[state=open]:animate-fade-in",
          )}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email ? (
              <p className="truncate text-xs text-fg-subtle">{email}</p>
            ) : null}
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              toggle();
            }}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm outline-none data-[highlighted]:bg-surface-muted"
          >
            {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {dark ? "Dark mode" : "Light mode"}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              signOutRef.current?.requestSubmit();
            }}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    </>
  );
}

export { User };
