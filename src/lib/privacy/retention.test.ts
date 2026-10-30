import { describe, expect, it } from "vitest";
import { DELETION_GRACE_DAYS, deletionReadyAt, hasCurrentConsent, isPastDeletionGrace } from "./retention";

describe("deletionReadyAt", () => {
  it("adds the grace period in days", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    expect(deletionReadyAt(requested, 30)).toEqual(new Date("2026-01-31T00:00:00Z"));
  });

  it("defaults to DELETION_GRACE_DAYS when no override is given", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    expect(deletionReadyAt(requested)).toEqual(deletionReadyAt(requested, DELETION_GRACE_DAYS));
  });
});

describe("isPastDeletionGrace", () => {
  it("is false the moment the request is filed", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    expect(isPastDeletionGrace(requested, requested, 30)).toBe(false);
  });

  it("is false one day before the grace window ends", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    const almostReady = new Date("2026-01-30T00:00:00Z");
    expect(isPastDeletionGrace(requested, almostReady, 30)).toBe(false);
  });

  it("is true exactly at the grace boundary (inclusive)", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    const boundary = new Date("2026-01-31T00:00:00Z");
    expect(isPastDeletionGrace(requested, boundary, 30)).toBe(true);
  });

  it("is true well past the grace window", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    const later = new Date("2026-03-01T00:00:00Z");
    expect(isPastDeletionGrace(requested, later, 30)).toBe(true);
  });

  it("respects a custom grace period, matching the SQL function's default argument", () => {
    const requested = new Date("2026-01-01T00:00:00Z");
    const tenDaysLater = new Date("2026-01-11T00:00:00Z");
    expect(isPastDeletionGrace(requested, tenDaysLater, 30)).toBe(false);
    expect(isPastDeletionGrace(requested, tenDaysLater, 10)).toBe(true);
  });
});

describe("hasCurrentConsent", () => {
  const CURRENT = "2026-10-21-draft-1";

  it("is false with no consent record at all", () => {
    expect(hasCurrentConsent(null, CURRENT)).toBe(false);
  });

  it("is true for a non-withdrawn record matching the current policy version", () => {
    expect(hasCurrentConsent({ policyVersion: CURRENT, withdrawnAt: null }, CURRENT)).toBe(true);
  });

  it("is false once withdrawn, even if the policy version matches", () => {
    expect(
      hasCurrentConsent({ policyVersion: CURRENT, withdrawnAt: new Date("2026-10-22T00:00:00Z") }, CURRENT),
    ).toBe(false);
  });

  it("is false when the consented policy version is stale", () => {
    expect(hasCurrentConsent({ policyVersion: "2026-09-01-draft-1", withdrawnAt: null }, CURRENT)).toBe(
      false,
    );
  });
});
