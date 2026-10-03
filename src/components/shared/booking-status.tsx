import { Ban, CalendarClock, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/database.types";

const PRESET: Record<
  BookingStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info"; Icon: typeof Clock }
> = {
  pending: { label: "Awaiting confirmation", tone: "warning", Icon: Clock },
  confirmed: { label: "Confirmed", tone: "success", Icon: CheckCircle2 },
  completed: { label: "Completed", tone: "neutral", Icon: CalendarClock },
  cancelled: { label: "Cancelled", tone: "danger", Icon: Ban },
  no_show: { label: "No-show", tone: "danger", Icon: CircleSlash },
};

export function BookingStatusBadge({
  status,
  short,
}: {
  status: BookingStatus;
  short?: boolean;
}) {
  const { label, tone, Icon } = PRESET[status];
  return (
    <Badge tone={tone}>
      <Icon />
      {short && status === "pending" ? "Pending" : label}
    </Badge>
  );
}

export function statusLabel(status: BookingStatus): string {
  return PRESET[status].label;
}
