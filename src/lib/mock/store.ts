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
const SCHEMA_VERSION = 2;

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
