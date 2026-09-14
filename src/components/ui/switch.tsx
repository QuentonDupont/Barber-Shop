"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // The track is 52x32; the surrounding label row supplies the 44px height.
      "peer inline-flex h-8 w-[3.25rem] shrink-0 cursor-pointer items-center",
      "rounded-full border-2 border-transparent transition-colors outline-none",
      "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2",
      "focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-accent data-[state=unchecked]:bg-border-strong",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-7 rounded-full bg-white shadow-sm ring-0",
        "transition-transform data-[state=checked]:translate-x-5",
        "data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };
