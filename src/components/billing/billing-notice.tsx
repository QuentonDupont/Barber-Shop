import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";
import { formatDate } from "@/lib/billing/invoice";
import type { BillingNotice } from "@/lib/billing/ui";
import { t, type Locale } from "@/lib/i18n/dictionaries";

const BODY = {
  past_due: "noticePastDue",
  grace: "noticeGrace",
  downgraded: "noticeDowngraded",
  cancelling: "noticeCancelling",
  upcoming: "noticeUpcoming",
} as const;

const TITLE = {
  past_due: "noticePastDueTitle",
  grace: "noticeGraceTitle",
  downgraded: "noticeDowngradedTitle",
  cancelling: "noticeCancellingTitle",
  upcoming: "noticeUpcomingTitle",
} as const;

/**
 * The owner's grace / past-due / downgraded / cancelling notice. Owner screens
 * only: it is rendered by the dashboard layout and the billing page, never by
 * anything a customer can open. The wording always says customers are unaffected.
 */
export function BillingNoticeAlert({
  notice,
  locale,
  withLink = false,
}: {
  notice: BillingNotice;
  locale: Locale;
  withLink?: boolean;
}) {
  const date = notice.date ? formatDate(notice.date, locale) : "";
  const tone = notice.kind === "past_due" || notice.kind === "grace" ? "warning" : "info";
  return (
    <div data-testid={`billing-notice-${notice.kind}`}>
      <Alert
        tone={tone}
        title={
          <>
            {t(locale, `billing.${TITLE[notice.kind]}`)}{" "}
            <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold" data-testid="notice-demo-tag">
              {t(locale, "billing.demoTag")}
            </span>
          </>
        }
      >
        <p>{t(locale, `billing.${BODY[notice.kind]}`, { date })}</p>
        {withLink ? (
          <div className="mt-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/account/billing">
                {notice.kind === "downgraded" && notice.fromPlan
                  ? t(locale, "billing.resubscribe", {
                      plan: locale === "th" ? PLANS[notice.fromPlan].nameTh : PLANS[notice.fromPlan].nameEn,
                    })
                  : t(locale, "billing.openBilling")}
              </Link>
            </Button>
          </div>
        ) : null}
      </Alert>
    </div>
  );
}
