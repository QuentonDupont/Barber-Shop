import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ServicesManager } from "@/components/business/services-manager";
import { Button } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { businessPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const locale = await getLocale();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <PageContainer>
      <PageHeader
        title={t(locale, "servicesAdmin.pageTitle")}
        description={t(locale, "servicesAdmin.pageDescription")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={businessPath(ctx.business.slug)}>
              <Eye />
              {t(locale, "servicesAdmin.previewYourPage")}
            </Link>
          </Button>
        }
      />
      <ServicesManager services={services ?? []} />
    </PageContainer>
  );
}
