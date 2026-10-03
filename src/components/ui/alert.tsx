import * as React from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  error: { cls: "border-danger/35 bg-danger-soft text-danger", Icon: CircleAlert },
  success: { cls: "border-success/35 bg-success-soft text-success", Icon: CircleCheck },
  warning: { cls: "border-warning/35 bg-warning-soft text-warning", Icon: TriangleAlert },
  info: { cls: "border-info/35 bg-info-soft text-info", Icon: Info },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { cls, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border p-3 text-sm", cls, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-pretty opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}
