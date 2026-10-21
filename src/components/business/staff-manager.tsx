"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { saveStaffAction, toggleStaffAction } from "@/lib/actions/staff";
import { idleState } from "@/lib/actions/types";
import type { StaffWithServices } from "@/lib/booking/availability";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

type ServiceOption = { id: string; name: string; is_active: boolean };

// Monday-first, matching the hours editor's reading order even though
// Postgres numbers Sunday as 0.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function StaffManager({
  staff,
  services,
}: {
  staff: StaffWithServices[];
  services: ServiceOption[];
}) {
  const t = useT();
  const [editing, setEditing] = useState<StaffWithServices | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {/* Matches the services list's floating "+" clearance on mobile. */}
      <div className={cn("space-y-2.5", staff.length > 0 && "pb-20 sm:pb-0")}>
        {staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("staffAdmin.emptyTitle")}
            description={t("staffAdmin.emptyDescription")}
            action={
              <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
                <Plus />
                {t("staffAdmin.addFirstButton")}
              </Button>
            }
          />
        ) : (
          staff.map((member) => (
            <StaffCard key={member.id} member={member} onEdit={setEditing} />
          ))
        )}
      </div>

      {staff.length > 0 ? (
        <>
          <Button
            variant="accent"
            size="md"
            onClick={() => setCreating(true)}
            className="mt-4 hidden sm:inline-flex"
          >
            <Plus />
            {t("staffAdmin.addButton")}
          </Button>

          <div className="h-[4.5rem] sm:hidden" aria-hidden />

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 pb-nav backdrop-blur-lg sm:hidden">
            <Button variant="accent" size="lg" block onClick={() => setCreating(true)}>
              <Plus />
              {t("staffAdmin.addButton")}
            </Button>
          </div>
        </>
      ) : null}

      <StaffSheet
        key={editing?.id ?? (creating ? "new" : "closed")}
        member={editing}
        services={services}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}

function StaffCard({
  member,
  onEdit,
}: {
  member: StaffWithServices;
  onEdit: (member: StaffWithServices) => void;
}) {
  const t = useT();
  const worksEveryDay = member.works_weekdays.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface",
        !member.is_active && "bg-surface-muted/60",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(member)}
        className="block w-full rounded-t-xl p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold", !member.is_active && "text-fg-muted")}>
            {member.name}
          </span>
          <Badge tone={member.is_active ? "success" : "neutral"}>
            {member.is_active ? t("staffAdmin.activeBadge") : t("staffAdmin.inactiveBadge")}
          </Badge>
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
          <span className="font-medium">{t("staffAdmin.worksOnLabel")}:</span>
          {worksEveryDay ? (
            WEEKDAY_ORDER.filter((weekday) => member.works_weekdays.includes(weekday)).map(
              (weekday) => (
                <span
                  key={weekday}
                  className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold"
                >
                  {t(`staffAdmin.weekday${weekday}`)}
                </span>
              ),
            )
          ) : (
            <span className="italic text-fg-subtle">{t("staffAdmin.noWeekdaysSet")}</span>
          )}
        </span>

        <span className="mt-1.5 block text-sm text-fg-subtle">
          {member.serviceIds.length === 0
            ? t("staffAdmin.allServicesHint")
            : t("staffAdmin.someServicesLabel", { count: member.serviceIds.length })}
        </span>
      </button>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <ToggleForm member={member} />
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(member)}
            aria-label={`${t("staffAdmin.editButton")} ${member.name}`}
          >
            <Pencil />
            {t("staffAdmin.editButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Activate/deactivate from the list, same pattern as the services toggle. */
function ToggleForm({ member }: { member: StaffWithServices }) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const switchId = `active-${member.id}`;

  return (
    <form
      ref={formRef}
      action={toggleStaffAction}
      className="flex min-h-11 items-center gap-2.5 pl-1.5"
    >
      <input type="hidden" name="id" value={member.id} />
      <input type="hidden" name="isActive" value={String(!member.is_active)} />
      <Switch
        id={switchId}
        checked={member.is_active}
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={`${member.is_active ? t("staffAdmin.deactivateButton") : t("staffAdmin.activateButton")} ${member.name}`}
      />
      <label htmlFor={switchId} className="text-sm font-medium text-fg-muted">
        {member.is_active ? t("staffAdmin.activeBadge") : t("staffAdmin.inactiveBadge")}
      </label>
    </form>
  );
}

function StaffSheet({
  member,
  services,
  open,
  onOpenChange,
}: {
  member: StaffWithServices | null;
  services: ServiceOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(saveStaffAction, idleState);
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [weekdays, setWeekdays] = useState<number[]>(member?.works_weekdays ?? [1, 2, 3, 4, 5, 6, 0]);
  const [serviceIds, setServiceIds] = useState<string[]>(member?.serviceIds ?? []);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const toggleWeekday = (weekday: number) => {
    setWeekdays((prev) =>
      prev.includes(weekday) ? prev.filter((d) => d !== weekday) : [...prev, weekday],
    );
  };

  const toggleService = (id: string) => {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {member ? t("staffAdmin.sheetTitleEdit") : t("staffAdmin.sheetTitleNew")}
          </SheetTitle>
          <SheetDescription>{t("staffAdmin.sheetDescription")}</SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
                {state.message}
              </p>
            ) : null}

            <input type="hidden" name="id" value={member?.id ?? ""} />

            <Field
              label={t("staffAdmin.nameLabel")}
              htmlFor="staff-name"
              error={errors.name}
              required
            >
              <Input
                id="staff-name"
                name="name"
                defaultValue={member?.name ?? ""}
                placeholder={t("staffAdmin.namePlaceholder")}
                enterKeyHint="next"
                autoFocus
                required
              />
            </Field>

            <Field
              label={t("staffAdmin.weekdaysLabel")}
              htmlFor="staff-weekdays"
              hint={t("staffAdmin.weekdaysHint")}
              error={errors.worksWeekdays}
            >
              <div id="staff-weekdays" className="flex flex-wrap gap-1.5">
                {WEEKDAY_ORDER.map((weekday) => {
                  const selected = weekdays.includes(weekday);
                  return (
                    <button
                      key={weekday}
                      type="button"
                      onClick={() => toggleWeekday(weekday)}
                      aria-pressed={selected}
                      className={cn(
                        "flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors",
                        "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        selected
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border-strong bg-surface text-fg-muted",
                      )}
                    >
                      {t(`staffAdmin.weekday${weekday}`)}
                    </button>
                  );
                })}
                {weekdays.map((weekday) => (
                  <input key={weekday} type="hidden" name="worksWeekdays" value={weekday} />
                ))}
              </div>
            </Field>

            <Field label={t("staffAdmin.servicesLabel")} hint={t("staffAdmin.servicesHint")}>
              {services.length === 0 ? (
                <p className="text-sm italic text-fg-subtle">{t("staffAdmin.servicesEmptyHint")}</p>
              ) : (
                <div className="space-y-1 rounded-lg border border-border p-2">
                  {services.map((service) => {
                    const checked = serviceIds.includes(service.id);
                    const inputId = `service-${service.id}`;
                    return (
                      <label
                        key={service.id}
                        htmlFor={inputId}
                        className="flex min-h-11 items-center gap-2.5 rounded-md px-1.5 text-sm hover:bg-surface-muted"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={checked}
                          onChange={() => toggleService(service.id)}
                          className="size-4 rounded border-border-strong accent-[var(--accent)]"
                        />
                        <span className={cn(!service.is_active && "text-fg-subtle")}>
                          {service.name}
                        </span>
                        {!service.is_active ? (
                          <Badge tone="neutral">{t("staffAdmin.serviceInactiveBadge")}</Badge>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </Field>

            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5">
              <label htmlFor="isActive" className="text-sm font-medium">
                {t("staffAdmin.activeToggleLabel")}
              </label>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
            </div>
          </SheetBody>

          <SheetFooter>
            <SaveButton isNew={!member} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} className="sm:w-auto">
      {isNew ? t("staffAdmin.saveNew") : t("staffAdmin.saveEdit")}
    </Button>
  );
}
