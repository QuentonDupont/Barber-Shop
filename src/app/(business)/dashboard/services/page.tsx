import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/app-shell";
import { ServicesManager } from "@/components/business/services-manager";
import { Button } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth";
import { businessPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <PageContainer>
      <PageHeader
        title="Services"
        description="Everything here is what customers see on your booking page — names, descriptions, prices and the order they appear in. Tap a service to change it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={businessPath(ctx.business.slug)}>
              <Eye />
              Preview your page
            </Link>
          </Button>
        }
      />
      <ServicesManager services={services ?? []} />
    </PageContainer>
  );
}
