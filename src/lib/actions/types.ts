/**
 * Every Server Action returns this shape so forms can render errors uniformly
 * through `useActionState`.
 */
export interface ActionState {
  status: "idle" | "error" | "success";
  message?: string;
  /** Field-level messages keyed by input name. */
  fieldErrors?: Record<string, string>;
  /**
   * Set only by `createBookingAction`, when the customer chose "any
   * available": which staff member the server actually assigned. A named
   * choice doesn't need this — the client already knows who it asked for.
   */
  assignedStaffId?: string;
  assignedStaffName?: string;
  /**
   * Set only by `createBookingAction` when the booking is refused for a
   * PDPA consent reason (never consented, withdrawn, or a superseded
   * policy version) — lets the UI offer a direct way to act on it (a link
   * to the account page's consent controls), not just a prose pointer
   * (QA report #7 §5, handoff 07).
   */
  consentBlocked?: boolean;
  /**
   * Set by the staff actions when the plan's barber limit refused the change,
   * so the form can show a link to the plans (QA advisory A4, handoff 07).
   */
  limitReached?: boolean;
}

export const idleState: ActionState = { status: "idle" };

/**
 * Result shape for `exportMyDataAction` (`./privacy.ts`, PDPA item 12).
 *
 * Lives here rather than in `privacy.ts` because `privacy.ts` is a
 * `"use server"` file — Next only allows async function exports from those,
 * and throws "A 'use server' file can only export async functions" the
 * moment any client component imports it transitively (sign-in/sign-up's
 * pages import `auth.ts`, which imports `privacy.ts`) if a plain value like
 * `idleExportState` is exported alongside the actions. Every non-function
 * export a "use server" module needs belongs in a plain module like this
 * one instead.
 */
export interface ExportDataState {
  status: "idle" | "error" | "success";
  message?: string;
  /** Pretty-printed JSON payload; the client turns this into a downloadable file. */
  json?: string;
  filename?: string;
}

export const idleExportState: ExportDataState = { status: "idle" };

export function errorState(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors };
}

export function successState(
  message?: string,
  extra?: Pick<ActionState, "assignedStaffId" | "assignedStaffName">,
): ActionState {
  return { status: "success", message, ...extra };
}

/** Turns a Zod `flatten()` result into `fieldErrors`. */
export function fieldErrorsFrom(
  flattened: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flattened)) {
    if (messages?.[0]) out[key] = messages[0];
  }
  return out;
}
