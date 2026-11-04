/** Notification preferences (customer account): defaults and the consent stamp. */

export const MARKETING_CONSENT_VERSION = "marketing-2026-11-v1";

export interface NotificationPrefs {
  booking_confirmations: boolean;
  reminders: boolean;
  marketing: boolean;
  marketing_consented_at: string | null;
  marketing_withdrawn_at: string | null;
  marketing_consent_version: string | null;
}

/** What a customer with no saved row gets: service messages on, marketing off. */
export const DEFAULT_PREFS: NotificationPrefs = {
  booking_confirmations: true,
  reminders: true,
  marketing: false,
  marketing_consented_at: null,
  marketing_withdrawn_at: null,
  marketing_consent_version: null,
};

/**
 * The service switches and the marketing switch are saved separately; this is
 * the marketing half. Turning it on records the time and the consent text
 * version; turning it off records the withdrawal time and keeps the old grant
 * time for the audit trail. No change keeps the stamps as they were.
 * (The database trigger does the same, so a forged client cannot back-date it.)
 */
export function applyMarketingChoice(
  prev: NotificationPrefs,
  wantMarketing: boolean,
  nowIso: string,
): NotificationPrefs {
  if (wantMarketing === prev.marketing) return prev;
  if (wantMarketing) {
    return {
      ...prev,
      marketing: true,
      marketing_consented_at: nowIso,
      marketing_withdrawn_at: null,
      marketing_consent_version: MARKETING_CONSENT_VERSION,
    };
  }
  return { ...prev, marketing: false, marketing_withdrawn_at: nowIso };
}
