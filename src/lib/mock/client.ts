/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database.types";
import { MOCK_COOKIE, decodeMockCookie, encodeMockCookie } from "./config";
import { store, type MockDB } from "./store";
import type { MockAuthUser } from "./fixtures";

/**
 * A hand-written stand-in for the Supabase JS client, backed by the in-memory
 * fixture store. It implements exactly the surface the app uses — no more — so
 * every page, server action and RPC keeps calling `createClient()` unchanged
 * while mock mode is on.
 */

/** The subset of Next's cookie store this client needs. */
export interface MockCookieStore {
  get(name: string): { value: string } | undefined;
  set?(name: string, value: string, options?: Record<string, unknown>): void;
  delete?(name: string): void;
}

type Row = Record<string, any>;
type Op = "select" | "insert" | "update" | "delete" | "upsert";
type Cmp = "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte";
interface Filter {
  col: string;
  op: Cmp;
  val: any;
}

interface Result {
  data: any;
  error: { message: string; code?: string } | null;
  count: number | null;
}

/* -------------------------------------------------------------------------- */
/* Per-table insert defaults (mirror the Postgres column defaults)             */
/* -------------------------------------------------------------------------- */

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

const TABLES_WITH_UPDATED_AT = new Set([
  "profiles",
  "businesses",
  "services",
  "bookings",
  "products",
  "campaigns",
  "customer_notes",
]);

function insertDefaults(table: string): Row {
  const now = nowIso();
  switch (table) {
    case "profiles":
      return { role: "customer", full_name: "", phone: null, email: null, avatar_url: null, created_at: now, updated_at: now };
    case "businesses":
      return {
        category: "other", description: null, timezone: "Asia/Bangkok", place_id: null,
        address: null, lat: null, lng: null, phone: null, line_id: null, cover_url: null,
        slot_interval_min: 15, min_notice_min: 60, max_advance_days: 60,
        auto_confirm: true, is_published: false, onboarding_step: 0, created_at: now, updated_at: now,
      };
    case "business_hours":
      return { open_time: "09:00", close_time: "18:00", is_closed: false };
    case "business_breaks":
      return { label: "Break" };
    case "services":
      return {
        description: null, buffer_min: 0, price: 0, currency: "THB",
        is_active: true, sort_order: 0, created_at: now, updated_at: now,
      };
    case "staff":
      return { avatar_url: null, works_weekdays: [0, 1, 2, 3, 4, 5, 6], is_active: true, created_at: now };
    case "staff_services":
      return { created_at: now };
    case "availability_overrides":
      return { is_closed: true, open_time: null, close_time: null, note: null };
    case "bookings":
      return {
        staff_id: null, status: "pending", source: "customer", notes: null, price: 0, currency: "THB",
        customer_name: "", customer_phone: null, cancelled_at: null, cancelled_by: null,
        created_at: now, updated_at: now,
      };
    case "products":
      return {
        description: null, price: 0, currency: "THB", image_emoji: null, accent: null,
        stock: null, is_active: true, sort_order: 0, created_at: now, updated_at: now,
      };
    case "campaigns":
      return {
        description: null, ends_at: null, location: null, price: 0, currency: "THB",
        capacity: null, discount_label: null, image_emoji: null, accent: null,
        is_published: false, created_at: now, updated_at: now,
      };
    case "campaign_subscriptions":
      return { customer_name: "", status: "going", created_at: now };
    case "orders":
      return {
        quantity: 1, unit_price: 0, currency: "THB", payment_method: "stripe",
        status: "paid", customer_name: "", created_at: now,
      };
    case "customer_notes":
      return { note: "", created_at: now, updated_at: now };
    case "consent_records":
      return { consented_at: now, withdrawn_at: null };
    case "deletion_requests":
      return { requested_at: now, status: "pending", completed_at: null };
    default:
      return {};
  }
}

function withInsertDefaults(table: string, values: Row): Row {
  const row: Row = { ...insertDefaults(table), ...values };
  // Mirrors the database trigger: a booking with no customer account can only
  // be one the shop entered itself (migration 20261027000000).
  if (table === "bookings" && row.customer_id == null) row.source = "shop";
  if (row.id === undefined) row.id = newId();
  return row;
}

/* -------------------------------------------------------------------------- */
/* Query builder                                                               */
/* -------------------------------------------------------------------------- */

class MockQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderSpec: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private rangeSpec: { from: number; to: number } | null = null;
  private op: Op = "select";
  private payload: any = null;
  private onConflictCols: string[] | null = null;
  private returning = false;
  private headOnly = false;
  private countExact = false;
  private singleMode: "one" | "maybe" | null = null;
  private embeds: string[] = [];

  constructor(private db: MockDB, private table: string) {}

  private table_(): Row[] {
    const t = (this.db as any)[this.table];
    if (!Array.isArray(t)) throw new Error(`Mock: unknown table "${this.table}"`);
    return t as Row[];
  }

  select(cols?: string, opts?: { count?: string; head?: boolean }): this {
    this.returning = true;
    if (cols) {
      // Pull out embedded relations like `businesses(name, slug)` / `services(*)`.
      const re = /([a-z_]+)\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cols))) {
        if (m[1]) this.embeds.push(m[1]);
      }
    }
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  private pushFilter(op: Cmp, col: string, val: any): this {
    this.filters.push({ col, op, val });
    return this;
  }
  eq(col: string, val: any) { return this.pushFilter("eq", col, val); }
  neq(col: string, val: any) { return this.pushFilter("neq", col, val); }
  in(col: string, val: any[]) { return this.pushFilter("in", col, val); }
  gt(col: string, val: any) { return this.pushFilter("gt", col, val); }
  gte(col: string, val: any) { return this.pushFilter("gte", col, val); }
  lt(col: string, val: any) { return this.pushFilter("lt", col, val); }
  lte(col: string, val: any) { return this.pushFilter("lte", col, val); }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderSpec = { col, ascending: opts?.ascending ?? true };
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number): this {
    this.rangeSpec = { from, to };
    return this;
  }

  insert(values: Row | Row[]): this {
    this.op = "insert";
    this.payload = values;
    return this;
  }
  update(values: Row): this {
    this.op = "update";
    this.payload = values;
    return this;
  }
  delete(): this {
    this.op = "delete";
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }): this {
    this.op = "upsert";
    this.payload = values;
    this.onConflictCols = opts?.onConflict?.split(",").map((s) => s.trim()) ?? null;
    return this;
  }

  single(): this {
    this.singleMode = "one";
    return this;
  }
  maybeSingle(): this {
    this.singleMode = "maybe";
    return this;
  }

  /* ---- execution ------------------------------------------------------- */

  private match(row: Row): boolean {
    return this.filters.every(({ col, op, val }) => {
      const cell = row[col];
      switch (op) {
        case "eq": return cell === val;
        case "neq": return cell !== val;
        case "in": return Array.isArray(val) && val.includes(cell);
        case "gt": return cell > val;
        case "gte": return cell >= val;
        case "lt": return cell < val;
        case "lte": return cell <= val;
      }
    });
  }

  private applyEmbeds(rows: Row[]): void {
    for (const name of this.embeds) {
      if (name === "businesses" && this.table === "bookings") {
        for (const r of rows) {
          r.businesses = this.db.businesses.find((b) => b.id === r.business_id) ?? null;
        }
      } else if (name === "services" && this.table === "businesses") {
        for (const r of rows) {
          r.services = this.db.services.filter((s) => s.business_id === r.id);
        }
      }
      // Any other embed shape is unused by the app; leave the field undefined.
    }
  }

  private finalize(rows: Row[], count: number | null): Result {
    if (this.singleMode === "one") {
      if (rows.length === 0) {
        return { data: null, error: { message: "No rows found", code: "PGRST116" }, count };
      }
      return { data: rows[0] ?? null, error: null, count };
    }
    if (this.singleMode === "maybe") {
      return { data: rows[0] ?? null, error: null, count };
    }
    return { data: rows, error: null, count };
  }

  private execute(): Result {
    const table = this.table_();

    if (this.op === "select") {
      const matched = table.filter((r) => this.match(r));
      const count = this.countExact ? matched.length : null;
      if (this.headOnly) return { data: null, error: null, count };

      let rows = matched.map((r) => ({ ...r }));
      if (this.orderSpec) {
        const { col, ascending } = this.orderSpec;
        rows.sort((a, b) => {
          const x = a[col];
          const y = b[col];
          const c = x < y ? -1 : x > y ? 1 : 0;
          return ascending ? c : -c;
        });
      }
      if (this.rangeSpec) rows = rows.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
      else if (this.limitN != null) rows = rows.slice(0, this.limitN);
      this.applyEmbeds(rows);
      return this.finalize(rows, count);
    }

    if (this.op === "insert" || this.op === "upsert") {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      const written: Row[] = [];
      for (const v of values) {
        if (this.op === "upsert" && this.onConflictCols) {
          const existing = table.find((r) => this.onConflictCols!.every((c) => r[c] === v[c]));
          if (existing) {
            Object.assign(existing, v);
            if (TABLES_WITH_UPDATED_AT.has(this.table)) existing.updated_at = nowIso();
            written.push(existing);
            continue;
          }
        }
        const row = withInsertDefaults(this.table, v);
        table.push(row);
        written.push(row);
      }
      if (!this.returning) return { data: null, error: null, count: null };
      const rows = written.map((r) => ({ ...r }));
      this.applyEmbeds(rows);
      return this.finalize(rows, null);
    }

    if (this.op === "update") {
      const matched = table.filter((r) => this.match(r));
      for (const r of matched) {
        Object.assign(r, this.payload);
        if (TABLES_WITH_UPDATED_AT.has(this.table)) r.updated_at = nowIso();
      }
      if (!this.returning) return { data: null, error: null, count: null };
      const rows = matched.map((r) => ({ ...r }));
      this.applyEmbeds(rows);
      return this.finalize(rows, null);
    }

    // delete
    const removed: Row[] = [];
    for (let i = table.length - 1; i >= 0; i--) {
      const row = table[i];
      if (row && this.match(row)) {
        table.splice(i, 1);
        removed.unshift(row);
      }
    }
    if (!this.returning) return { data: null, error: null, count: null };
    return this.finalize(removed.map((r) => ({ ...r })), null);
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }
}

/* -------------------------------------------------------------------------- */
/* RPCs                                                                        */
/* -------------------------------------------------------------------------- */

function slugify(value: string): string {
  const s = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "business";
}

function uniqueSlug(desired: string, existing: string[]): string {
  const base = slugify(desired);
  let candidate = base;
  let n = 1;
  while (existing.includes(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

function rpc(db: MockDB, name: string, args: any): Promise<{ data: any; error: any }> {
  if (name === "busy_intervals") {
    const { target_business, from_ts, to_ts, exclude_booking } = args ?? {};
    const data = db.bookings
      .filter(
        (b) =>
          b.business_id === target_business &&
          (b.status === "pending" || b.status === "confirmed") &&
          b.starts_at >= from_ts &&
          b.starts_at < to_ts &&
          (!exclude_booking || b.id !== exclude_booking),
      )
      .sort((a, b) => (a.starts_at < b.starts_at ? -1 : a.starts_at > b.starts_at ? 1 : 0))
      .map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at }));
    return Promise.resolve({ data, error: null });
  }
  if (name === "health_check") {
    return Promise.resolve({ data: { ok: true, checked_at: nowIso() }, error: null });
  }
  if (name === "unique_business_slug") {
    const slug = uniqueSlug(args?.desired ?? "", db.businesses.map((b) => b.slug));
    return Promise.resolve({ data: slug, error: null });
  }
  return Promise.resolve({ data: null, error: { message: `Mock RPC "${name}" is not implemented` } });
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

function toAuthUser(u: MockAuthUser) {
  return {
    id: u.id,
    email: u.email,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: u.user_metadata,
    aud: "authenticated",
    role: "authenticated",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function setCookie(cookieStore: MockCookieStore | null, role: string, id: string): void {
  try {
    cookieStore?.set?.(MOCK_COOKIE, encodeMockCookie(role, id), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  } catch {
    // Read-only cookie context (e.g. a Server Component render). Auth is only
    // ever mutated from Server Actions / route handlers, where this succeeds.
  }
}

function clearCookie(cookieStore: MockCookieStore | null): void {
  try {
    cookieStore?.set?.(MOCK_COOKIE, "", { path: "/", maxAge: 0 });
  } catch {
    /* see setCookie */
  }
}

/** Look up the current user from the cookie, reconstructing a minimal one if the
 * store was rebuilt (dev restart) but the browser still holds the cookie. */
function currentUser(db: MockDB, cookieStore: MockCookieStore | null): MockAuthUser | null {
  const decoded = decodeMockCookie(cookieStore?.get(MOCK_COOKIE)?.value);
  if (!decoded) return null;
  const found = db.authUsers.find((u) => u.id === decoded.id);
  if (found) return found;
  return {
    id: decoded.id,
    email: "",
    password: "",
    user_metadata: {
      role: (decoded.role as UserRole) ?? "customer",
      full_name: "",
      phone: null,
      avatar_url: null,
    },
  };
}

function makeAuth(db: MockDB, cookieStore: MockCookieStore | null) {
  return {
    async getUser() {
      const u = currentUser(db, cookieStore);
      return { data: { user: u ? toAuthUser(u) : null }, error: null };
    },

    async signInWithPassword({ email }: { email: string; password: string }) {
      const u = db.authUsers.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (!u) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials", status: 400 },
        };
      }
      // Any password is accepted in mock mode.
      setCookie(cookieStore, u.user_metadata.role, u.id);
      return { data: { user: toAuthUser(u), session: { access_token: "mock" } }, error: null };
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, any> };
    }) {
      if (db.authUsers.some((x) => x.email.toLowerCase() === email.toLowerCase())) {
        return { data: { user: null, session: null }, error: { message: "User already registered" } };
      }
      const meta = options?.data ?? {};
      const role: UserRole = meta.role === "business_owner" ? "business_owner" : "customer";
      const id = newId();
      const user: MockAuthUser = {
        id,
        email,
        password,
        user_metadata: {
          role,
          full_name: meta.full_name ?? "",
          phone: meta.phone ?? null,
          avatar_url: meta.avatar_url ?? null,
        },
      };
      db.authUsers.push(user);
      // Mirror the `handle_new_user` trigger: every auth user gets a profile.
      db.profiles.push({
        id,
        role,
        full_name: user.user_metadata.full_name,
        phone: user.user_metadata.phone,
        email,
        avatar_url: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      setCookie(cookieStore, role, id);
      return { data: { user: toAuthUser(user), session: { access_token: "mock" } }, error: null };
    },

    async signOut() {
      clearCookie(cookieStore);
      return { error: null };
    },

    async updateUser({ email, data }: { email?: string; data?: Record<string, any> }) {
      const u = currentUser(db, cookieStore);
      if (!u) return { data: { user: null }, error: { message: "Not authenticated" } };
      const stored = db.authUsers.find((x) => x.id === u.id);
      if (email && stored) stored.email = email;
      if (data && stored) stored.user_metadata = { ...stored.user_metadata, ...data };
      const profile = db.profiles.find((p) => p.id === u.id);
      if (profile) {
        if (data?.full_name != null) profile.full_name = data.full_name;
        if (data?.phone != null) profile.phone = data.phone;
        if (data?.avatar_url != null) profile.avatar_url = data.avatar_url;
        if (email) profile.email = email;
        profile.updated_at = nowIso();
      }
      return { data: { user: toAuthUser(stored ?? u) }, error: null };
    },

    async signInWithOAuth() {
      // Handled by a mock branch in the auth action instead; never reached.
      return { data: { provider: "google", url: null }, error: { message: "OAuth disabled in mock mode" } };
    },

    async exchangeCodeForSession() {
      return { data: { user: null, session: null }, error: null };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

export function createMockClient(cookieStore: MockCookieStore | null): SupabaseClient<Database> {
  const db = store();
  const client = {
    from: (table: string) => new MockQuery(db, table),
    rpc: (name: string, args?: any) => rpc(db, name, args),
    auth: makeAuth(db, cookieStore),
  };
  return client as unknown as SupabaseClient<Database>;
}

/** Set the session cookie to a seed demo account of the given role. Used by the
 * mock branch of the Google sign-in action and the demo-login buttons. */
export function setMockUserByRole(cookieStore: MockCookieStore, role: UserRole): boolean {
  const db = store();
  const u = db.authUsers.find((x) => x.user_metadata.role === role);
  if (!u) return false;
  setCookie(cookieStore, role, u.id);
  return true;
}
