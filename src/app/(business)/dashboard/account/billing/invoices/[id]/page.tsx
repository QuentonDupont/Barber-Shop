import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/shared/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBanner } from "@/components/billing/demo-banner";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server";
import { renderReceiptData } from "@/lib/billing/invoice";
import { loadInvoice } from "@/lib/billing/repo";

export const metadata: Metadata = { title: "Receipt" };

/**
 * One receipt, from the same Thai / English receipt data the billing core
 * builds. Owner-only: the query is scoped to the signed-in owner's business,
 * so another shop's invoice id is simply "not found".
 */
export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const ctx = await requireBusiness();
  const pageLocale = await getLocale();
  const { id } = await params;
  const { lang } = await searchParams;
  const receiptLocale: Locale = lang === "en" || lang === "th" ? lang : pageLocale;

  const db = await createClient();
  const invoice = await loadInvoice(db, ctx.business.id, id);
  if (!invoice) notFound();
  const r = renderReceiptData(invoice, receiptLocale);
  const th = receiptLocale === "th";
  const other: Locale = th ? "en" : "th";

  return (
    <PageContainer className="max-w-2xl">
      <Link
        href="/dashboard/account/billing"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-ink hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t(pageLocale, "billing.backToBilling")}
      </Link>

      <div className="space-y-4">
        <DemoBanner compact />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">{t(pageLocale, "billing.showIn")}:</span>
          <Link
            href={`?lang=${other}`}
            className="inline-flex min-h-11 items-center rounded-full border border-border px-4 font-semibold"
            data-testid="receipt-lang-switch"
          >
            {other === "th" ? "ไทย" : "English"}
          </Link>
        </div>

        <Card data-testid="receipt" lang={receiptLocale}>
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-semibold" data-testid="receipt-title">{r.title}</h1>
                <p className="text-sm text-fg-muted" data-testid="receipt-number">{r.number}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-fg-muted">{r.dateLabel}</p>
                <p className="font-medium" data-testid="receipt-date">{r.date}</p>
              </div>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-fg-muted">{t(receiptLocale, "billing.issuedBy")}</p>
                <p className="font-medium">TatNat</p>
              </div>
              <div>
                <p className="text-fg-muted">{t(receiptLocale, "billing.billedTo")}</p>
                {r.buyerLines.map((line, i) => (
                  <p key={i} className={i === 0 ? "font-medium" : ""}>{line}</p>
                ))}
              </div>
            </div>

            <p className="text-sm">
              <span className="text-fg-muted">{r.periodLabel}: </span>
              <span className="font-medium">{r.period}</span>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-fg-muted">
                    <th className="py-2 pr-2 font-medium">{t(receiptLocale, "billing.colDescription")}</th>
                    <th className="px-2 py-2 text-right font-medium">{t(receiptLocale, "billing.colQty")}</th>
                    <th className="px-2 py-2 text-right font-medium">{t(receiptLocale, "billing.colUnit")}</th>
                    <th className="py-2 pl-2 text-right font-medium">{t(receiptLocale, "billing.colAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-2 pr-2">{l.description}</td>
                      <td className="px-2 py-2 text-right">{l.quantity}</td>
                      <td className="px-2 py-2 text-right">{l.unit}</td>
                      <td className="py-2 pl-2 text-right">{l.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">{t(receiptLocale, "billing.subtotal")}</dt>
                <dd>{r.subtotal}</dd>
              </div>
              {r.vat ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-muted">{t(receiptLocale, "billing.vat")}</dt>
                  <dd>{r.vat}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-border pt-1 text-base font-semibold">
                <dt>{t(receiptLocale, "billing.total")}</dt>
                <dd data-testid="receipt-total">{r.total}</dd>
              </div>
            </dl>

            <p className="text-xs text-fg-muted">{r.vatNote}</p>
            <p className="text-xs text-fg-muted">
              {t(receiptLocale, "billing.paymentRef")}: {r.paymentRef}
            </p>
            <p className="text-xs font-medium text-warning">{t(receiptLocale, "billing.demoReceipt")}</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
