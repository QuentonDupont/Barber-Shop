import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { PRIVACY_CONTACT_EMAIL, PRIVACY_POLICY_VERSION } from "@/lib/privacy/policy";

export const metadata: Metadata = { title: "Privacy policy" };

/**
 * Draft, bilingual privacy policy (handoff 07, legal-review.md §3 checklist).
 * Public route — reachable logged-out from sign-up, and from the account and
 * dashboard-settings pages once signed in. No data layer touched here beyond
 * reading the locale cookie; this page only renders copy.
 */
const SECTION_KEYS = [
  ["sectionCollectedTitle", "sectionCollectedBody"],
  ["sectionPurposeTitle", "sectionPurposeBody"],
  ["sectionDisclosedTitle", "sectionDisclosedBody"],
  ["sectionTransferTitle", "sectionTransferBody"],
  ["sectionRetentionTitle", "sectionRetentionBody"],
] as const;

const RIGHT_KEYS = [
  "rightAccess",
  "rightCorrection",
  "rightDeletion",
  "rightObjection",
  "rightWithdraw",
  "rightComplain",
] as const;

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const p = (key: string, vars?: Record<string, string | number>) =>
    t(locale, `privacy.${key}`, vars);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title={p("pageTitle")}
        description={p("versionLabel", { version: PRIVACY_POLICY_VERSION })}
      />

      <Alert tone="warning" className="mb-5">
        {p("draftBanner")}
      </Alert>

      <p className="mb-6 text-sm text-fg-muted text-pretty">{p("pageIntro")}</p>

      <div className="space-y-4">
        {SECTION_KEYS.map(([titleKey, bodyKey]) => (
          <Card key={titleKey}>
            <CardHeader>
              <CardTitle>{p(titleKey)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-fg-muted text-pretty">
              {p(bodyKey)}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>{p("sectionRightsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted text-pretty">
              {RIGHT_KEYS.map((key) => (
                <li key={key}>{p(key)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{p("sectionContactTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted text-pretty">
            {p("sectionContactBody", { email: PRIVACY_CONTACT_EMAIL })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Button asChild variant="ghost" size="md">
          <Link href="/">{p("backLink")}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
