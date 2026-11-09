import { describe, expect, it } from "vitest";
import { drainAvatarCleanup, type CleanupClient } from "./cleanup";

function fake(rows: { id: string; path: string }[], removeFails = false) {
  const removed: string[] = [];
  const deleted: string[] = [];
  const client: CleanupClient = {
    from: () => ({
      select: async () => ({ data: rows, error: null }),
      delete: () => ({ in: async (_c, ids) => { deleted.push(...ids); return { error: null }; } }),
    }),
    storage: { from: () => ({ remove: async (paths) => { if (removeFails) return { error: { message: "x" } }; removed.push(...paths); return { error: null }; } }) },
  };
  return { client, removed, deleted };
}

describe("drainAvatarCleanup", () => {
  it("removes each queued file through the storage API, then clears the queue", async () => {
    const f = fake([{ id: "1", path: "u1/photo-1.jpg" }, { id: "2", path: "u2/photo-2.png" }]);
    expect(await drainAvatarCleanup(f.client)).toBe(2);
    expect(f.removed).toEqual(["u1/photo-1.jpg", "u2/photo-2.png"]);
    expect(f.deleted).toEqual(["1", "2"]);
  });
  it("keeps the queue when the storage call fails", async () => {
    const f = fake([{ id: "1", path: "u1/p.jpg" }], true);
    expect(await drainAvatarCleanup(f.client)).toBe(0);
    expect(f.deleted).toEqual([]);
  });
  it("does nothing on an empty queue", async () => {
    expect(await drainAvatarCleanup(fake([]).client)).toBe(0);
  });
});
