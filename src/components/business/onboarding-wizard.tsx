"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationPicker, type LocationValue } from "./location-picker";
import { HoursEditor } from "./hours-editor";
import { DEFAULT_WEEK, type DayHours } from "@/lib/booking/hours";
import {
  saveBusinessBasicsAction,
  saveBusinessHoursAction,
  saveBusinessLocationAction,
} from "@/lib/actions/business";
import { idleState } from "@/lib/actions/types";
import type { BusinessCategory, BusinessRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: { value: BusinessCategory; label: string }[] = [
  { value: "barber", label: "Barber shop" },
  { value: "salon", label: "Hair / beauty salon" },
  { value: "spa", label: "Spa & massage" },
  { value: "clinic", label: "Clinic" },
  { value: "fitness", label: "Fitness & studio" },
  { value: "event", label: "Events" },
  { value: "other", label: "Something else" },
];

const STEPS = [
  { number: 1, label: "Your business", icon: Store },
  { number: 2, label: "Location", icon: MapPin },
  { number: 3, label: "Opening hours", icon: Clock3 },
] as const;

export function OnboardingWizard({
  step,
  business,
  initialHours,
}: {
  step: 1 | 2 | 3;
  business: BusinessRow | null;
  initialHours: DayHours[] | null;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-semibold text-accent">
          Step {step} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {step === 1
            ? "Tell us about your business"
            : step === 2
              ? "Where can customers find you?"
              : "When are you open?"}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted text-pretty">
          {step === 1
            ? "This is what customers see when they search. You can change any of it later."
            : step === 2
              ? "Search your address, then drag the pin to your exact door."
              : "Bookly turns these hours into bookable slots. Breaks are blocked out automatically."}
        </p>
      </div>

      <StepRail current={step} />

      <div className="mt-6">
        {step === 1 ? <BasicsStep business={business} /> : null}
        {step === 2 ? <LocationStep business={business} /> : null}
        {step === 3 ? <HoursStep initialHours={initialHours ?? DEFAULT_WEEK} /> : null}
      </div>
    </div>
  );
}

/** Progress rail: icons only on a phone, labels once there is room. */
function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Setup progress">
      {STEPS.map((item, index) => {
        const done = item.number < current;
        const active = item.number === current;
        return (
          <li key={item.number} className="flex flex-1 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  done || active ? "bg-accent" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold",
                  active ? "text-accent" : done ? "text-fg-muted" : "text-fg-subtle",
                )}
              >
                {done ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <item.icon className="size-3.5 shrink-0" />
                )}
                <span className="hidden truncate sm:inline">{item.label}</span>
              </span>
            </div>
            {index < STEPS.length - 1 ? <span className="sr-only">then</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block loading={pending} variant="accent">
      {children}
      {pending ? null : <ArrowRight />}
    </Button>
  );
}

function BasicsStep({ business }: { business: BusinessRow | null }) {
  const [state, formAction] = useActionState(saveBusinessBasicsAction, idleState);
  const [category, setCategory] = useState<BusinessCategory>(business?.category ?? "barber");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label="Business name" htmlFor="name" error={errors.name} required>
        <Input
          id="name"
          name="name"
          defaultValue={business?.name ?? ""}
          placeholder="Nong's Barber Shop"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.name)}
          required
        />
      </Field>

      <Field label="What kind of business is it?" error={errors.category} required>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as BusinessCategory)}
        >
          <SelectTrigger aria-label="Business category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category" value={category} />
      </Field>

      <Field label="Phone number" htmlFor="phone" error={errors.phone} required>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          defaultValue={business?.phone ?? ""}
          placeholder="02 123 4567"
          aria-invalid={Boolean(errors.phone)}
          required
        />
      </Field>

      <Field
        label="LINE ID"
        htmlFor="lineId"
        error={errors.lineId}
        hint="Optional. Shown on your booking page so customers can message you."
      >
        <Input
          id="lineId"
          name="lineId"
          defaultValue={business?.line_id ?? ""}
          placeholder="@nongsbarber"
          autoCapitalize="none"
          enterKeyHint="next"
        />
      </Field>

      <Field
        label="Short description"
        htmlFor="description"
        error={errors.description}
        hint="Optional. One or two lines about what you do."
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={business?.description ?? ""}
          placeholder="Classic cuts and hot-towel shaves, five minutes from BTS Asok."
          maxLength={600}
        />
      </Field>

      <StepSubmit>Continue</StepSubmit>
    </form>
  );
}

function LocationStep({ business }: { business: BusinessRow | null }) {
  const [state, formAction] = useActionState(saveBusinessLocationAction, idleState);
  const [location, setLocation] = useState<LocationValue>({
    address: business?.address ?? "",
    placeId: business?.place_id ?? "",
    lat: business?.lat ?? null,
    lng: business?.lng ?? null,
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <LocationPicker value={location} onChange={setLocation} error={errors.address} />

      <input type="hidden" name="timezone" value={business?.timezone ?? "Asia/Bangkok"} />

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <div className="sm:flex-1">
          <StepSubmit>Continue</StepSubmit>
        </div>
        <Button asChild variant="ghost" size="lg" className="sm:w-auto">
          <Link href="/dashboard/onboarding?step=1">
            <ArrowLeft />
            Back
          </Link>
        </Button>
      </div>
    </form>
  );
}

function HoursStep({ initialHours }: { initialHours: DayHours[] }) {
  const [state, formAction] = useActionState(saveBusinessHoursAction, idleState);
  const [days, setDays] = useState<DayHours[]>(initialHours);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <HoursEditor value={days} onChange={setDays} />

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <div className="sm:flex-1">
          <StepSubmit>Finish setup</StepSubmit>
        </div>
        <Button asChild variant="ghost" size="lg" className="sm:w-auto">
          <Link href="/dashboard/onboarding?step=2">
            <ArrowLeft />
            Back
          </Link>
        </Button>
      </div>
    </form>
  );
}
