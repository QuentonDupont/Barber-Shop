"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SHOP_ACCENTS, accentSwatch } from "@/lib/shop";
import { cn } from "@/lib/utils";

/** A row of colour swatches that writes the chosen accent to a hidden input. */
export function AccentPicker({
  name = "accent",
  defaultValue = "amber",
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "amber");
  return (
    <div className="flex items-center gap-2.5">
      <input type="hidden" name={name} value={value} />
      {SHOP_ACCENTS.map((accent) => (
        <button
          key={accent}
          type="button"
          onClick={() => setValue(accent)}
          aria-label={accent}
          aria-pressed={value === accent}
          className={cn(
            "flex size-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition",
            accentSwatch(accent),
            value === accent ? "ring-fg/60" : "ring-transparent hover:ring-border-strong",
          )}
        >
          {value === accent ? <Check className="size-4 text-white" /> : null}
        </button>
      ))}
    </div>
  );
}
