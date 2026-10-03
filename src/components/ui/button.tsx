import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sizes are floored at 44px tall on every variant except `icon-sm`, which is
 * only used inside rows that already have a large tap target of their own.
 * 44px is the Apple HIG minimum and the difference between a shop owner
 * confirming a booking first time and mis-tapping on a bus.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "font-semibold transition-[background-color,color,box-shadow,transform] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98] select-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-sm hover:bg-primary/90 active:bg-primary/85",
        accent:
          "bg-accent text-accent-fg shadow-sm hover:bg-accent/90 active:bg-accent/85",
        outline:
          "border border-border-strong bg-surface text-fg hover:bg-surface-muted",
        subtle: "bg-surface-muted text-fg hover:bg-border/60",
        ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg",
        danger: "bg-danger text-white shadow-sm hover:bg-danger/90",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-11 px-3.5 text-sm [&_svg]:size-4",
        md: "h-12 px-5 text-[0.9375rem] [&_svg]:size-4.5",
        lg: "h-14 px-6 text-base [&_svg]:size-5",
        icon: "size-12 [&_svg]:size-5",
        "icon-sm": "size-9 rounded-md [&_svg]:size-4",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild = false, loading, children, disabled, ...props },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, block }), className)}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, block }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
