// The barber limit, as the owner meets it. The database trigger
// (enforce_staff_limit) is the real guard; this check runs first so the owner
// gets a friendly Thai/English message and an upgrade link instead of a raw
// database error. Owner write path only: nothing public ever calls this.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PLANS, type PlanId } from "./plans";
import { rowToSubscription } from "./repo";
import { effectivePlanId } from "./state";

export interface LimitCheck {
  ok: boolean;
  plan: PlanId;
  limit: number;
  /** Active barbers other than the one being added or re-activated. */
  activeOthers: number;
}

export async function checkBarberLimit(
  db: SupabaseClient<Database>,
  businessId: string,
  now: Date,
  excludeStaffId?: string,
): Promise<LimitCheck> {
  const [{ data: subRow }, { data: staffRows }] = await Promise.all([
    db.from("subscriptions").select("*").eq("business_id", businessId).maybeSingle(),
    db.from("staff").select("id, is_active").eq("business_id", businessId),
  ]);
  const plan = effectivePlanId(subRow ? rowToSubscription(subRow) : null, now);
  const limit = PLANS[plan].maxBarbers;
  const activeOthers = (staffRows ?? []).filter((s) => s.is_active && s.id !== excludeStaffId).length;
  return { ok: activeOthers + 1 <= limit, plan, limit, activeOthers };
}

/** The database trigger's error text, so a race that slips past the check still reads well. */
export const isBarberLimitError = (message: string | undefined | null): boolean =>
  !!message && message.includes("staff_limit_exceeded");
