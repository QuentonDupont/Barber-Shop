import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-border shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className,
      )}
      {...props}
    />
  );
}

/** Static block at the real size of what is loading. No shimmer: a moving
 * gradient draws the eye to the one part of the screen with nothing in it. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg bg-surface-muted", className)} {...props} />;
}

function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden",
        "rounded-full bg-surface-muted text-sm font-semibold text-fg",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Empty states: never leave a screen blank without telling the user why. */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-border",
        "bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="mb-3 size-5 text-fg-subtle" /> : null}
      <p className="text-base font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-fg-muted text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export { Separator, Skeleton, Avatar, EmptyState };
