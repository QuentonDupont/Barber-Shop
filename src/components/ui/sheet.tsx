"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/context";

function CloseLabel() {
  const t = useT();
  return <span className="sr-only">{t("ui.close")}</span>;
}

/**
 * One component, two presentations:
 *   * below `sm` it is a bottom sheet with a drag handle — the pattern phone
 *     users already know, and it keeps actions under the thumb.
 *   * from `sm` up it becomes a centred dialog.
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-fg/40 backdrop-blur-[2px]",
      "data-[state=open]:animate-fade-in",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Hides the default close button when the sheet supplies its own. */
  hideClose?: boolean;
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, hideClose, onOpenAutoFocus, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={onOpenAutoFocus}
      className={cn(
        "fixed z-50 bg-surface shadow-[var(--shadow-raised)] focus:outline-none",
        // phone: bottom sheet, capped so the header behind stays visible
        "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain",
        "rounded-t-2xl pb-safe data-[state=open]:animate-slide-up",
        // tablet and up: centred dialog
        "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2",
        "sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2",
        "sm:rounded-xl sm:max-h-[85dvh] sm:data-[state=open]:animate-fade-in",
        className,
      )}
      {...props}
    >
      {/* Grab handle — purely affordance, so hidden from assistive tech. The
          close button rides in this sticky bar so it stays reachable on a phone
          however far the sheet is scrolled. */}
      <div className="sticky top-0 z-10 flex justify-center bg-surface pt-3 pb-1 relative sm:hidden">
        <div className="h-1.5 w-11 rounded-full bg-border-strong" aria-hidden />
        {hideClose ? null : (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-1 top-0 flex size-11 items-center justify-center rounded-full",
              "text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg",
            )}
          >
            <X className="size-5" />
            <CloseLabel />
          </DialogPrimitive.Close>
        )}
      </div>
      {children}
      {hideClose ? null : (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-3 top-3 hidden size-9 items-center justify-center rounded-full",
            "text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg sm:flex",
          )}
        >
          <X className="size-4" />
          <CloseLabel />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-2 pb-3 sm:p-5 sm:pb-3 space-y-1", className)} {...props} />;
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4 sm:px-5 space-y-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-surface",
        "px-4 py-3 sm:flex-row sm:justify-end sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-fg-muted text-pretty", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
