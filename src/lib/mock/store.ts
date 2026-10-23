/**
 * Process-wide singleton holding the mock database. Kept on `globalThis` so it
 * survives Next's dev-server module reloads (HMR) — otherwise every edit would
 * silently wipe any bookings made while clicking around.
 *
 * The store lives in whichever runtime touches it first; the Node server
 * runtime (server components, actions, route handlers) and the Edge middleware
 * runtime each get their own copy built from the same deterministic fixtures,
 * which is why the auth cookie carries the role rather than relying on a shared
 * lookup (see `config.ts`).
 */

import { buildDB, type MockDB } from "./fixtures";

/**
 * Bump when the fixture *shape* changes (new tables/columns). The store
 * auto-rebuilds on a version mismatch, so schema additions don't require a
 * manual dev-server restart to clear a stale singleton.
 */
// v3: handoff 07 — added consent_records, deletion_requests, and registered
// the pre-existing customer_notes table in the mock store.
// v4: handoff 08 (runtime fix) — registered staff_services and seeded
// staff for the barber shop, so multi-staff booking is exercisable in mock
// mode instead of 500ing the moment a shop has barbers.
const SCHEMA_VERSION = 4;

const globalForMock = globalThis as unknown as {
  __booklyMockDB?: MockDB;
  __booklyMockVersion?: number;
};

export function store(): MockDB {
  if (!globalForMock.__booklyMockDB || globalForMock.__booklyMockVersion !== SCHEMA_VERSION) {
    globalForMock.__booklyMockDB = buildDB();
    globalForMock.__booklyMockVersion = SCHEMA_VERSION;
  }
  return globalForMock.__booklyMockDB;
}

/** Rebuild the fixtures from scratch (used by the dev reset endpoint). */
export function resetStore(): MockDB {
  globalForMock.__booklyMockDB = buildDB();
  globalForMock.__booklyMockVersion = SCHEMA_VERSION;
  return globalForMock.__booklyMockDB;
}

export type { MockDB };
