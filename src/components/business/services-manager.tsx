"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Clock3, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
import {
  deleteServiceAction,
  saveServiceAction,
  toggleServiceAction,
} from "@/lib/actions/services";
import { idleState } from "@/lib/actions/types";
import type { ServiceRow } from "@/lib/database.types";
import { formatDuration, formatMoney } from "@/lib/booking/time";
import { cn } from "@/lib/utils";

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="space-y-2.5">
        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="No services yet"
            description="A service is what a customer books — its name, how long it takes and what it costs. Bookly turns the duration into slots."
            action={
              <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
                <Plus />
                Add your first service
              </Button>
            }
          />
        ) : (
          services.map((service) => (
            <ServiceCard key={service.id} service={service} onEdit={setEditing} />
          ))
        )}
      </div>

      {services.length > 0 ? (
        <>
          {/* Desktop: inline button. Mobile: a floating action button that sits
              above the tab bar, always within thumb reach. */}
          <Button
            variant="accent"
            size="md"
            onClick={() => setCreating(true)}
            className="mt-4 hidden sm:inline-flex"
          >
            <Plus />
            Add a service
          </Button>

          <Button
            variant="accent"
            size="icon"
            onClick={() => setCreating(true)}
            aria-label="Add a service"
            className="fixed bottom-24 right-4 z-30 size-14 rounded-full shadow-[var(--shadow-raised)] sm:hidden"
          >
            <Plus className="size-6" />
          </Button>
        </>
      ) : null}

      <ServiceSheet
        key={editing?.id ?? (creating ? "new" : "closed")}
        service={editing}
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

function ServiceCard({
  service,
  onEdit,
}: {
  service: ServiceRow;
  onEdit: (service: ServiceRow) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5",
        !service.is_active && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(service)}
        className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{service.name}</span>
          {!service.is_active ? <Badge tone="neutral">Hidden</Badge> : null}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {formatDuration(service.duration_min)}
            {service.buffer_min > 0 ? ` + ${service.buffer_min} min tidy-up` : ""}
          </span>
          <span className="font-semibold text-fg">
            {formatMoney(service.price, service.currency)}
          </span>
        </span>
        {service.description ? (
          <span className="mt-1 block truncate text-sm text-fg-subtle">
            {service.description}
          </span>
        ) : null}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <ToggleForm service={service} />
        <button
          type="button"
          onClick={() => onEdit(service)}
          className="flex size-11 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
          aria-label={`Edit ${service.name}`}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Show/hide without opening the editor — the single most common change an
 * owner makes when a service is temporarily unavailable.
 */
function ToggleForm({ service }: { service: ServiceRow }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={toggleServiceAction} className="flex items-center">
      <input type="hidden" name="id" value={service.id} />
      <input type="hidden" name="isActive" value={String(!service.is_active)} />
      <Switch
        checked={service.is_active}
        // Radix Switch renders a `type="button"`, so it never submits on its
        // own; the form has to be asked explicitly.
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={`${service.is_active ? "Hide" : "Show"} ${service.name}`}
      />
    </form>
  );
}

function ServiceSheet({
  service,
  open,
  onOpenChange,
}: {
  service: ServiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(saveServiceAction, idleState);
  const [deleteState, deleteAction] = useActionState(deleteServiceAction, idleState);
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Saved.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  useEffect(() => {
    if (deleteState.status === "success") {
      toast.success(deleteState.message ?? "Deleted.");
      onOpenChange(false);
    }
    if (deleteState.status === "error" && deleteState.message) {
      toast.error(deleteState.message);
    }
  }, [deleteState, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{service ? "Edit service" : "New service"}</SheetTitle>
          <SheetDescription>
            The duration is what reserves the chair, so include everything the
            appointment actually takes.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction}>
          <SheetBody>
            {state.status === "error" && state.message ? (
              <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert">
                {state.message}
              </p>
            ) : null}

            <input type="hidden" name="id" value={service?.id ?? ""} />

            <Field label="Name" htmlFor="service-name" error={errors.name} required>
              <Input
                id="service-name"
                name="name"
                defaultValue={service?.name ?? ""}
                placeholder="Men's cut & style"
                enterKeyHint="next"
                autoFocus
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Duration"
                htmlFor="durationMin"
                error={errors.durationMin}
                hint="minutes"
                required
              >
                <Input
                  id="durationMin"
                  name="durationMin"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={1440}
                  step={5}
                  defaultValue={service?.duration_min ?? 30}
                  required
                />
              </Field>

              <Field label="Price" htmlFor="price" error={errors.price} hint="THB">
                <Input
                  id="price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  defaultValue={service?.price ?? 0}
                />
              </Field>
            </div>

            <Field
              label="Tidy-up time"
              htmlFor="bufferMin"
              error={errors.bufferMin}
              hint="Extra minutes blocked after this service. Leave at 0 if you don't need it."
            >
              <Input
                id="bufferMin"
                name="bufferMin"
                type="number"
                inputMode="numeric"
                min={0}
                max={240}
                step={5}
                defaultValue={service?.buffer_min ?? 0}
              />
            </Field>

            <Field label="Description" htmlFor="service-description" hint="Optional.">
              <Textarea
                id="service-description"
                name="description"
                defaultValue={service?.description ?? ""}
                placeholder="Consultation, wash, cut and finish."
                maxLength={400}
              />
            </Field>

            <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface-muted px-3.5">
              <label htmlFor="isActive" className="text-sm font-medium">
                Visible to customers
              </label>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <input type="hidden" name="isActive" value={isActive ? "on" : "off"} />
            </div>
          </SheetBody>

          <SheetFooter className="sm:justify-between">
            {service ? (
              <DeleteButton id={service.id} action={deleteAction} />
            ) : (
              <span className="hidden sm:block" />
            )}
            <SaveButton isNew={!service} />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="accent" loading={pending} className="sm:w-auto">
      {isNew ? "Add service" : "Save changes"}
    </Button>
  );
}

function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      className="text-danger sm:w-auto"
      onClick={() => {
        const data = new FormData();
        data.set("id", id);
        action(data);
      }}
    >
      <Trash2 />
      Delete
    </Button>
  );
}
