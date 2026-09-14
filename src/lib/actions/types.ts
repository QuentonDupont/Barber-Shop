/**
 * Every Server Action returns this shape so forms can render errors uniformly
 * through `useActionState`.
 */
export interface ActionState {
  status: "idle" | "error" | "success";
  message?: string;
  /** Field-level messages keyed by input name. */
  fieldErrors?: Record<string, string>;
}

export const idleState: ActionState = { status: "idle" };

export function errorState(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors };
}

export function successState(message?: string): ActionState {
  return { status: "success", message };
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
