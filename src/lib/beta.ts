/**
 * Invite-only beta: businesses cannot create their own account. Every business
 * entry point sends people here instead. If a contact address is configured at
 * build time the button opens an email; otherwise it goes to a static page.
 * Neither creates an account or writes to the database (look-and-feel.md §6).
 */
const inviteEmail = process.env.NEXT_PUBLIC_BETA_INVITE_EMAIL?.trim();

export const BETA_INVITE_LABEL = "Request beta invite";

export const BETA_INVITE_HREF = inviteEmail
  ? `mailto:${inviteEmail}?subject=${encodeURIComponent("Bookly beta invite request")}`
  : "/request-invite";
