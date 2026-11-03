"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveOwnerAccountAction } from "@/lib/actions/account-owner";
import { idleState } from "@/lib/actions/types";
import { useT } from "@/lib/i18n/context";

export interface OwnerAccountFormProps {
  email: string | null;
  profile: { fullName: string; phone: string };
  business: { name: string; address: string; phone: string; lineId: string };
  legal: {
    legalName: string;
    taxId: string;
    branchCode: string;
    taxAddress: string;
    vatRegistered: boolean;
  };
}

export function OwnerAccountForm({ email, profile, business, legal }: OwnerAccountFormProps) {
  const t = useT();
  const [state, formAction] = useActionState(saveOwnerAccountAction, idleState);
  const [vat, setVat] = useState(legal.vatRegistered);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? t("common.saved"));
    if (state.status === "error" && state.message) toast.error(state.message);
  }, [state, t]);

  // Optional fields say so next to the label (Thai and English).
  const optional = (label: string) => (
    <>
      {label} <span className="font-normal text-fg-subtle">({t("accountOwner.optional")})</span>
    </>
  );

  return (
    <form action={formAction} className="space-y-4 pb-24 sm:pb-0" noValidate>
      {/* ---- Personal ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accountOwner.personalTitle")}</CardTitle>
          <CardDescription>{t("accountOwner.personalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("accountOwner.fullNameLabel")} htmlFor="fullName" error={errors.fullName} required>
            <Input id="fullName" name="fullName" defaultValue={profile.fullName} autoComplete="name" />
          </Field>
          <Field label={t("accountOwner.emailLabel")} htmlFor="email" hint={t("accountOwner.emailHint")}>
            <Input id="email" type="email" value={email ?? ""} readOnly disabled />
          </Field>
          <Field label={t("accountOwner.phoneLabel")} htmlFor="phone" error={errors.phone} required>
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={profile.phone} autoComplete="tel" />
          </Field>
        </CardContent>
      </Card>

      {/* ---- Shop ---------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accountOwner.businessTitle")}</CardTitle>
          <CardDescription>{t("accountOwner.businessDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("accountOwner.shopNameLabel")} htmlFor="shopName" error={errors.shopName} required>
            <Input id="shopName" name="shopName" defaultValue={business.name} />
          </Field>
          <Field label={optional(t("accountOwner.addressLabel"))} htmlFor="address" error={errors.address}>
            <Textarea id="address" name="address" rows={2} defaultValue={business.address} />
          </Field>
          <Field label={t("accountOwner.shopPhoneLabel")} htmlFor="shopPhone" error={errors.shopPhone} required>
            <Input id="shopPhone" name="shopPhone" type="tel" inputMode="tel" defaultValue={business.phone} />
          </Field>
          <Field label={optional(t("accountOwner.lineIdLabel"))} htmlFor="lineId" error={errors.lineId}>
            <Input id="lineId" name="lineId" defaultValue={business.lineId} autoCapitalize="none" />
          </Field>
        </CardContent>
      </Card>

      {/* ---- Tax (owner only) --------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accountOwner.taxTitle")}</CardTitle>
          <CardDescription>{t("accountOwner.taxDescription")}</CardDescription>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-fg-subtle">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("accountOwner.taxPrivate")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={optional(t("accountOwner.legalNameLabel"))} htmlFor="legalName" error={errors.legalName}>
            <Input id="legalName" name="legalName" defaultValue={legal.legalName} />
          </Field>
          <Field
            label={optional(t("accountOwner.taxIdLabel"))}
            htmlFor="taxId"
            error={errors.taxId}
            hint={t("accountOwner.taxIdHint")}
          >
            <Input id="taxId" name="taxId" inputMode="numeric" defaultValue={legal.taxId} autoComplete="off" />
          </Field>
          <Field
            label={optional(t("accountOwner.branchLabel"))}
            htmlFor="branchCode"
            error={errors.branchCode}
            hint={t("accountOwner.branchHint")}
          >
            <Input id="branchCode" name="branchCode" inputMode="numeric" defaultValue={legal.branchCode} />
          </Field>
          <Field label={optional(t("accountOwner.taxAddressLabel"))} htmlFor="taxAddress" error={errors.taxAddress}>
            <Textarea id="taxAddress" name="taxAddress" rows={3} defaultValue={legal.taxAddress} />
          </Field>
          <div className="flex min-h-11 items-start justify-between gap-4">
            <div className="min-w-0">
              <label htmlFor="vatRegistered" className="text-sm font-medium">
                {optional(t("accountOwner.vatLabel"))}
              </label>
              <p className="mt-0.5 text-sm text-fg-subtle text-pretty">{t("accountOwner.vatHint")}</p>
            </div>
            <Switch id="vatRegistered" checked={vat} onCheckedChange={setVat} className="mt-0.5 shrink-0" />
            <input type="hidden" name="vatRegistered" value={vat ? "on" : "off"} />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg p-4 pb-nav sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0">
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      {t("accountOwner.save")}
    </Button>
  );
}
