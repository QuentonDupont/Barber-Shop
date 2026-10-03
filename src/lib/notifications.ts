import "server-only";

import type { BookingRow, BusinessRow } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/server";
import { formatInBusinessTz, formatMoney } from "@/lib/booking/time";

type BusinessLike = Pick<BusinessRow, "name" | "timezone"> &
  Partial<Pick<BusinessRow, "slug" | "phone" | "address">>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    from: process.env.RESEND_FROM ?? "Bookly <onboarding@resend.dev>",
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
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#d08a12;">Bookly</p>
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
  return `${formatInBusinessTz(booking.starts_at, timezone, "EEEE d MMMM yyyy")} at ${formatInBusinessTz(
    booking.starts_at,
    timezone,
    "h:mm a",
  )}`;
}

export async function notifyBookingCreated(
  booking: BookingRow,
  business: BusinessLike,
): Promise<void> {
  const { customerEmail, ownerEmail } = await recipientsFor(booking);
  const when = whenLine(booking, business.timezone);
  const confirmed = booking.status === "confirmed";

  const rows: [string, string][] = [
    ["Service", escapeHtml(booking.service_name)],
    ["When", when],
    ["Where", escapeHtml(business.address ?? business.name)],
    ["Price", formatMoney(booking.price, booking.currency)],
  ];

  if (customerEmail) {
    await send(
      customerEmail,
      confirmed
        ? `Booking confirmed — ${business.name}`
        : `Booking requested — ${business.name}`,
      layout(
        confirmed ? "You're booked in" : "Request sent",
        confirmed
          ? `${escapeHtml(business.name)} has you down for the slot below. Times are shown in the shop's local time (${escapeHtml(business.timezone)}).`
          : `${escapeHtml(business.name)} has your request and will confirm shortly. Times are shown in the shop's local time (${escapeHtml(business.timezone)}).`,
        rows,
        "Need to change it? Open Bookly and cancel from My bookings.",
      ),
    );
  }

  if (ownerEmail) {
    await send(
      ownerEmail,
      `New booking — ${booking.service_name}`,
      layout(
        confirmed ? "New booking" : "New booking request",
        `${escapeHtml(booking.customer_name)} booked ${escapeHtml(booking.service_name)}.`,
        [
          ...rows,
          ["Customer", escapeHtml(booking.customer_name)],
          ["Phone", escapeHtml(booking.customer_phone ?? "Not given")],
        ],
        "Open your Bookly dashboard to confirm, move or cancel this booking.",
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

  const rows: [string, string][] = [
    ["Service", escapeHtml(booking.service_name)],
    ["Was booked for", when],
    ["Business", escapeHtml(business.name)],
  ];

  const body = layout(
    "Booking cancelled",
    "This appointment has been cancelled. The slot is free again for anyone to book.",
    rows,
    "Booked by mistake? You can rebook any time from Bookly.",
  );

  if (customerEmail) {
    await send(customerEmail, `Booking cancelled — ${business.name}`, body);
  }
  if (ownerEmail) {
    await send(
      ownerEmail,
      `Cancelled — ${booking.service_name} (${escapeHtml(booking.customer_name)})`,
      body,
    );
  }
}
