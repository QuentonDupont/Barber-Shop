"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clock3, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
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
  moveServiceAction,
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
      {/* On a phone the floating "+" sits over the bottom of the list; leave
          room so it never covers the last card's Edit button. */}
      <div className={cn("space-y-2.5", services.length > 0 && "pb-20 sm:pb-0")}>
        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="No services yet"
            description="A service is what a customer books — its name, how long it takes and what it costs. TatNat turns the duration into slots."
            action={
              <Button variant="accent" size="lg" onClick={() => setCreating(true)}>
                <Plus />
                Add your first service
              </Button>
            }
          />
        ) : (
          services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              index={index}
              count={services.length}
              onEdit={setEditing}
            />
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

          {/* Clearance so the last row can scroll clear of the sticky bar. */}
          <div className="h-[4.5rem] sm:hidden" aria-hidden />

          {/* A circular FAB pinned to the right sat on top of each row's toggle
              and edit controls, which are right-aligned too, and won the tap.
              A full-width bar above the tab bar keeps it in thumb reach without
              ever covering a row. Mirrors the booking flow's sticky bar. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 pb-nav backdrop-blur-lg sm:hidden">
            <Button variant="accent" size="lg" block onClick={() => setCreating(true)}>
              <Plus />
              Add a service
            </Button>
          </div>
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
  index,
  count,
  onEdit,
}: {
  service: ServiceRow;
  index: number;
  count: number;
  onEdit: (service: ServiceRow) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface",
        !service.is_active && "bg-surface-muted/60",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(service)}
        className="block w-full rounded-t-xl p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold", !service.is_active && "text-fg-muted")}>
            {service.name}
          </span>
          {!service.is_active ? <Badge tone="neutral">Hidden from customers</Badge> : null}
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
          <span className="mt-1.5 line-clamp-2 block text-sm text-fg-subtle">
            {service.description}
          </span>
        ) : (
          <span className="mt-1.5 block text-sm italic text-fg-subtle">
            No description — customers only see the name.
          </span>
        )}
      </button>

      {/* Every control is labelled and a full 44px tall: this bar is what an
          owner reaches for with a thumb between customers. */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <ToggleForm service={service} />
        <div className="ml-auto flex items-center gap-0.5">
          <MoveButton id={service.id} direction="up" disabled={index === 0} name={service.name} />
          <MoveButton
            id={service.id}
            direction="down"
            disabled={index === count - 1}
            name={service.name}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(service)}
            aria-label={`Edit ${service.name}`}
          >
            <Pencil />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
  name,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
  name: string;
}) {
  return (
    <form action={moveServiceAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <MoveSubmit direction={direction} disabled={disabled} name={name} />
    </form>
  );
}

function MoveSubmit({
  direction,
  disabled,
  name,
}: {
  direction: "up" | "down";
  disabled: boolean;
  name: string;
}) {
  const { pending } = useFormStatus();
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={`Move ${name} ${direction}`}
      className="flex size-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg disabled:opacity-30"
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Show/hide without opening the editor — the single most common change an
 * owner makes when a service is temporarily unavailable.
 */
function ToggleForm({ service }: { service: ServiceRow }) {
  const formRef = useRef<HTMLFormElement>(null);
  const switchId = `visible-${service.id}`;

  return (
    <form ref={formRef} action={toggleServiceAction} className="flex min-h-11 items-center gap-2.5 pl-1.5">
      <input type="hidden" name="id" value={service.id} />
      <input type="hidden" name="isActive" value={String(!service.is_active)} />
      <Switch
        id={switchId}
        checked={service.is_active}
        // Radix Switch renders a `type="button"`, so it never submits on its
        // own; the form has to be asked explicitly.
        onCheckedChange={() => formRef.current?.requestSubmit()}
        aria-label={`${service.is_active ? "Hide" : "Show"} ${service.name}`}
      />
      <label htmlFor={switchId} className="text-sm font-medium text-fg-muted">
        {service.is_active ? "Visible" : "Hidden"}
      </label>
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
            The name, description and price appear on your booking page as
            soon as you save. The duration is what reserves the chair, so
            include everything the appointment actually takes.
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

            <Field
              label="Description"
              htmlFor="service-description"
              hint="Shown to customers under the service name. What's included, who it's for."
            >
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
