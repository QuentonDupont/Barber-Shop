"use client";

import { Store, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type Role = "customer" | "business_owner";

const OPTIONS: { value: Role; label: string; hint: string; icon: typeof Users }[] = [
  { value: "customer", label: "Customer", hint: "I want to book", icon: Users },
  { value: "business_owner", label: "Business", hint: "I take bookings", icon: Store },
];

/**
 * A segmented control rather than a `<select>`: both options stay visible, and
 * each half is a full-width tap target on a phone.
 */
export function RoleToggle({
  value,
  onChange,
  name = "role",
}: {
  value: Role;
  onChange: (role: Role) => void;
  name?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">I am signing up as</legend>
      <div
        role="radiogroup"
        className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1.5"
      >
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2",
                "text-sm font-semibold transition-all outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent/40",
                selected
                  ? "bg-surface text-fg shadow-sm ring-1 ring-accent/30"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <option.icon
                className={cn("size-5", selected ? "text-accent" : "text-fg-subtle")}
              />
              {option.label}
              <span className="text-[0.6875rem] font-normal text-fg-subtle">
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value} />
    </fieldset>
  );
}
