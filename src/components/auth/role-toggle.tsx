"use client";

import { Store, Users } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export type Role = "customer" | "business_owner";

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
  const t = useT();
  const OPTIONS: { value: Role; label: string; hint: string; icon: typeof Users }[] = [
    { value: "customer", label: t("auth.customer"), hint: t("auth.iWantToBook"), icon: Users },
    { value: "business_owner", label: t("auth.business"), hint: t("auth.iTakeBookings"), icon: Store },
  ];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">{t("auth.iAmSigningUpAs")}</legend>
      <div
        role="radiogroup"
        className="grid grid-cols-2 gap-2 rounded-[20px] bg-surface-muted p-1.5"
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
                "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-[14px] px-3 py-2",
                "text-sm font-semibold transition-colors duration-150 outline-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "bg-primary text-primary-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <option.icon
                className={cn("size-5", selected ? "text-primary-fg" : "text-fg-subtle")}
              />
              {option.label}
              <span className={cn("text-xs font-normal", selected ? "text-primary-fg/80" : "text-fg-muted")}>
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
