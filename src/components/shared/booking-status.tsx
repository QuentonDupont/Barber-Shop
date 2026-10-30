"use client";

import { Ban, CalendarClock, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/database.types";
import { useT } from "@/lib/i18n/context";

const PRESET: Record<
  BookingStatus,
  { key: string; tone: "neutral" | "success" | "warning" | "danger" | "info"; Icon: typeof Clock }
> = {
  pending: { key: "status.pending", tone: "warning", Icon: Clock },
  confirmed: { key: "status.confirmed", tone: "success", Icon: CheckCircle2 },
  completed: { key: "status.completed", tone: "neutral", Icon: CalendarClock },
  cancelled: { key: "status.cancelled", tone: "danger", Icon: Ban },
  no_show: { key: "status.noShow", tone: "danger", Icon: CircleSlash },
};

export function BookingStatusBadge({
  status,
  short,
}: {
  status: BookingStatus;
  short?: boolean;
}) {
  const t = useT();
  const { key, tone, Icon } = PRESET[status];
  return (
    <Badge tone={tone}>
      <Icon />
      {short && status === "pending" ? t("status.pendingShort") : t(key)}
    </Badge>
  );
}
