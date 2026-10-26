import { describe, expect, it } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("returns 200 / up when the database answers ok", async () => {
    const r = await checkHealth({ probe: async () => ({ data: { ok: true }, error: null }) });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, db: "up" });
  });

  it("returns 503 and never leaks the error text when the database errors", async () => {
    const r = await checkHealth({
      probe: async () => ({ data: null, error: { message: "password authentication failed for user x" } }),
    });
    expect(r.status).toBe(503);
    expect(r.body.db).toBe("down");
    expect(JSON.stringify(r.body)).not.toContain("password");
  });

  it("returns 503 when the probe throws", async () => {
    const r = await checkHealth({
      probe: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toContain("ECONNREFUSED");
  });

  it("returns 503 when the probe hangs past the timeout", async () => {
    const r = await checkHealth({ probe: () => new Promise(() => {}), timeoutMs: 20 });
    expect(r.status).toBe(503);
  });

  it("returns 503 when the database answers something unexpected", async () => {
    const r = await checkHealth({ probe: async () => ({ data: { ok: false }, error: null }) });
    expect(r.status).toBe(503);
  });

  it("returns 200 / mock in mock mode without calling the database", async () => {
    let called = false;
    const r = await checkHealth({
      mock: true,
      probe: async () => {
        called = true;
        return { data: null, error: null };
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.db).toBe("mock");
    expect(called).toBe(false);
  });
});
