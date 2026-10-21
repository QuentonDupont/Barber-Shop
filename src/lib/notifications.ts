import "server-only";

import type { BookingRow, BusinessRow } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/server";
import { formatInBusinessTz, formatMoney } from "@/lib/booking/time";
import { t } from "@/lib/i18n/dictionaries";

type BusinessLike = Pick<BusinessRow, "name" | "timezone"> &
  Partial<Pick<BusinessRow, "slug" | "phone" | "address" | "cancellation_policy">>;

/**
 * Emails always render in Thai: there is no live session to offer a toggle
 * on, and Thai is the default locale (roadmap.md §1 row 3). If a per-recipient
 * locale preference is ever stored, thread it through here instead of this
 * constant — the dictionary already has the English strings ready
 * (`@/lib/i18n/dictionaries`, `email.*`).
 */
const EMAIL_LOCALE = "th";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    from: process.env.RESEND_FROM ?? "TatNat <onboarding@resend.dev>",
  };
}

/**
 * Email is best effort. A booking that is already committed must never be
 * rolled back because a third-party mail API was down, so every failure here
 * is logged and swallowed.
 */
async function send(to: string, subject: string, html: string): Promise<void> {
  const config = resendConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[notifications] RESEND_API_KEY unset — would email ${to}: ${subject}`);
    }
    return;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to, subject, html }),
    });

    if (!response.ok) {
      console.error(
        `[notifications] Resend rejected the message: ${response.status} ${await response.text()}`,
      );
    }
  } catch (error) {
    console.error("[notifications] Could not reach Resend", error);
  }
}

/**
 * Looks up the email addresses for a booking.
 *
 * Uses the service-role client because a customer cannot read the owner's
 * profile and vice versa — which is the point of the RLS policies. The only
 * values that reach this function come from a booking row the caller was
 * already authorised to act on.
 */
async function recipientsFor(
  booking: Pick<BookingRow, "customer_id" | "business_id">,
): Promise<{ customerEmail: string | null; ownerEmail: string | null }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { customerEmail: null, ownerEmail: null };
  }

  try {
    const admin = createAdminClient();

    const [{ data: customer }, { data: business }] = await Promise.all([
      admin.from("profiles").select("email").eq("id", booking.customer_id).maybeSingle(),
      admin.from("businesses").select("owner_id").eq("id", booking.business_id).maybeSingle(),
    ]);

    let ownerEmail: string | null = null;
    if (business?.owner_id) {
      const { data: owner } = await admin
        .from("profiles")
        .select("email")
        .eq("id", business.owner_id)
        .maybeSingle();
      ownerEmail = owner?.email ?? null;
    }

    return { customerEmail: customer?.email ?? null, ownerEmail };
  } catch (error) {
    console.error("[notifications] Could not resolve recipients", error);
    return { customerEmail: null, ownerEmail: null };
  }
}

function layout(heading: string, intro: string, rows: [string, string][], footer: string) {
  const cells = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#7a726a;font-size:14px;">${label}</td>
          <td style="padding:8px 0;color:#1f1a16;font-size:14px;font-weight:600;text-align:right;">${value}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e7e2da;">
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#d08a12;">ตัดนัด</p>
      <h1 style="margin:0 0 8px;font-size:21px;line-height:1.3;color:#1f1a16;">${heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#5c544c;">${intro}</p>
      <table role="presentation" style="width:100%;border-top:1px solid #efeae2;">${cells}</table>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#8b837a;">${footer}</p>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whenLine(booking: Pick<BookingRow, "starts_at">, timezone: string): string {
  return `${formatInBusinessTz(
    booking.starts_at,
    timezone,
    "EEEE d MMMM yyyy",
    EMAIL_LOCALE,
  )} ${formatInBusinessTz(booking.starts_at, timezone, "h:mm a", EMAIL_LOCALE)}`;
}

export async function notifyBookingCreated(
  booking: BookingRow,
  business: BusinessLike,
): Promise<void> {
  const { customerEmail, ownerEmail } = await recipientsFor(booking);
  const when = whenLine(booking, business.timezone);
  const confirmed = booking.status === "confirmed";
  const e = (key: string, vars?: Record<string, string | number>) =>
    t(EMAIL_LOCALE, key, vars);

  const rows: [string, string][] = [
    [e("email.rowService"), escapeHtml(booking.service_name)],
    [e("email.rowWhen"), when],
    [e("email.rowWhere"), escapeHtml(business.address ?? business.name)],
    [e("email.rowPrice"), formatMoney(booking.price, booking.currency)],
  ];

  if (customerEmail) {
    // Cancellation/no-show policy, repeated here as on the listing page and
    // the booking-confirmation screen (roadmap.md §1 row 6) — always shown,
    // falling back to generic contact copy when unset, same as the other two
    // placements (QA report #2 §5: this row was being omitted entirely instead
    // of falling back, which is what failed test list item 16).
    const customerRows: [string, string][] = [
      ...rows,
      [
        e("email.rowCancellationPolicy"),
        escapeHtml(business.cancellation_policy || e("email.cancellationPolicyFallback")),
      ],
    ];

    await send(
      customerEmail,
      e(confirmed ? "email.bookingConfirmedSubject" : "email.bookingRequestedSubject", {
        business: business.name,
      }),
      layout(
        e(confirmed ? "email.youAreBookedHeading" : "email.requestSentHeading"),
        e(confirmed ? "email.confirmedIntro" : "email.requestedIntro", {
          business: escapeHtml(business.name),
          timezone: escapeHtml(business.timezone),
        }),
        customerRows,
        e("email.footerCustomerConfirmed"),
      ),
    );
  }

  if (ownerEmail) {
    await send(
      ownerEmail,
      e("email.newBookingSubject", { service: booking.service_name }),
      layout(
        e(confirmed ? "email.newBookingHeading" : "email.newBookingRequestHeading"),
        e("email.ownerNewBookingIntro", {
          customer: escapeHtml(booking.customer_name),
          service: escapeHtml(booking.service_name),
        }),
        [
          ...rows,
          [e("email.rowCustomer"), escapeHtml(booking.customer_name)],
          [e("email.rowPhone"), escapeHtml(booking.customer_phone ?? e("email.phoneNotGiven"))],
        ],
        e("email.footerOwner"),
      ),
    );
  }
}

export async function notifyBookingCancelled(
  booking: Pick<
    BookingRow,
    | "customer_id"
    | "business_id"
    | "service_name"
    | "starts_at"
    | "price"
    | "currency"
    | "customer_name"
  >,
  business: BusinessLike | null,
): Promise<void> {
  if (!business) return;

  const { customerEmail, ownerEmail } = await recipientsFor(booking);
  const when = whenLine(booking, business.timezone);
  const e = (key: string, vars?: Record<string, string | number>) =>
    t(EMAIL_LOCALE, key, vars);

  const rows: [string, string][] = [
    [e("email.rowService"), escapeHtml(booking.service_name)],
    [e("email.rowWasBookedFor"), when],
    [e("email.rowBusiness"), escapeHtml(business.name)],
  ];

  const body = layout(
    e("email.bookingCancelledHeading"),
    e("email.cancelledIntro"),
    rows,
    e("email.footerCancelled"),
  );

  if (customerEmail) {
    await send(customerEmail, e("email.bookingCancelledSubject", { business: business.name }), body);
  }
  if (ownerEmail) {
    await send(
      ownerEmail,
      e("email.cancelledOwnerSubject", {
        service: booking.service_name,
        customer: booking.customer_name,
      }),
      body,
    );
  }
}
