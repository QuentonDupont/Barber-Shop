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
import { categoryLabel } from "@/lib/i18n/dictionaries";
import { useT, useLocale } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const CATEGORY_VALUES: BusinessCategory[] = [
  "barber",
  "salon",
  "spa",
  "clinic",
  "fitness",
  "event",
  "other",
];

const STEP_ICONS = { 1: Store, 2: MapPin, 3: Clock3 } as const;

export function OnboardingWizard({
  step,
  business,
  initialHours,
}: {
  step: 1 | 2 | 3;
  business: BusinessRow | null;
  initialHours: DayHours[] | null;
}) {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-semibold text-accent-ink">
          {t("onboardingAdmin.stepOf", { step, total: 3 })}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {step === 1
            ? t("onboardingAdmin.step1Heading")
            : step === 2
              ? t("onboardingAdmin.step2Heading")
              : t("onboardingAdmin.step3Heading")}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted text-pretty">
          {step === 1
            ? t("onboardingAdmin.step1Sub")
            : step === 2
              ? t("onboardingAdmin.step2Sub")
              : t("onboardingAdmin.step3Sub")}
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
  const t = useT();
  const steps = [
    { number: 1 as const, label: t("onboardingAdmin.stepBusiness") },
    { number: 2 as const, label: t("onboardingAdmin.stepLocation") },
    { number: 3 as const, label: t("onboardingAdmin.stepHours") },
  ];
  return (
    <ol className="flex items-center gap-1.5" aria-label={t("onboardingAdmin.setupProgressLabel")}>
      {steps.map((item, index) => {
        const done = item.number < current;
        const active = item.number === current;
        const Icon = STEP_ICONS[item.number];
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
                  active ? "text-accent-ink" : done ? "text-fg-muted" : "text-fg-subtle",
                )}
              >
                {done ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <Icon className="size-3.5 shrink-0" />
                )}
                <span className="hidden truncate sm:inline">{item.label}</span>
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="sr-only">{t("onboardingAdmin.then")}</span>
            ) : null}
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
  const t = useT();
  const { locale } = useLocale();
  const [state, formAction] = useActionState(saveBusinessBasicsAction, idleState);
  const [category, setCategory] = useState<BusinessCategory>(business?.category ?? "barber");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <Field label={t("onboardingAdmin.businessNameLabel")} htmlFor="name" error={errors.name} required>
        <Input
          id="name"
          name="name"
          defaultValue={business?.name ?? ""}
          placeholder={t("onboardingAdmin.businessNamePlaceholder")}
          enterKeyHint="next"
          aria-invalid={Boolean(errors.name)}
          required
        />
      </Field>

      <Field label={t("onboardingAdmin.businessTypeLabel")} error={errors.category} required>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as BusinessCategory)}
        >
          <SelectTrigger aria-label={t("onboardingAdmin.businessCategoryAriaLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {categoryLabel(value, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="category" value={category} />
      </Field>

      <Field label={t("onboardingAdmin.phoneNumberLabel")} htmlFor="phone" error={errors.phone} required>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          defaultValue={business?.phone ?? ""}
          placeholder={t("onboardingAdmin.phoneNumberPlaceholder")}
          aria-invalid={Boolean(errors.phone)}
          required
        />
      </Field>

      <Field
        label={t("onboardingAdmin.lineIdLabel")}
        htmlFor="lineId"
        error={errors.lineId}
        hint={t("onboardingAdmin.lineIdHint")}
      >
        <Input
          id="lineId"
          name="lineId"
          defaultValue={business?.line_id ?? ""}
          placeholder={t("onboardingAdmin.lineIdPlaceholder")}
          autoCapitalize="none"
          enterKeyHint="next"
        />
      </Field>

      <Field
        label={t("onboardingAdmin.shortDescriptionLabel")}
        htmlFor="description"
        error={errors.description}
        hint={t("onboardingAdmin.shortDescriptionHint")}
      >
        <Textarea
          id="description"
          name="description"
          defaultValue={business?.description ?? ""}
          placeholder={t("onboardingAdmin.shortDescriptionPlaceholder")}
          maxLength={600}
        />
      </Field>

      <StepSubmit>{t("onboardingAdmin.continueButton")}</StepSubmit>
    </form>
  );
}

function LocationStep({ business }: { business: BusinessRow | null }) {
  const t = useT();
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
          <StepSubmit>{t("onboardingAdmin.continueButton")}</StepSubmit>
        </div>
        <Button asChild variant="ghost" size="lg" className="sm:w-auto">
          <Link href="/dashboard/onboarding?step=1">
            <ArrowLeft />
            {t("common.back")}
          </Link>
        </Button>
      </div>
    </form>
  );
}

function HoursStep({ initialHours }: { initialHours: DayHours[] }) {
  const t = useT();
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
          <StepSubmit>{t("onboardingAdmin.finishSetup")}</StepSubmit>
        </div>
        <Button asChild variant="ghost" size="lg" className="sm:w-auto">
          <Link href="/dashboard/onboarding?step=2">
            <ArrowLeft />
            {t("common.back")}
          </Link>
        </Button>
      </div>
    </form>
  );
}
