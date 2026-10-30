import { describe, expect, it } from "vitest";
import {
  FINANCIAL_RECORD_RETENTION_YEARS,
  PRIVACY_POLICY_VERSION,
  isCurrentPolicyVersion,
  isPastFinancialRetention,
} from "./policy";

describe("isPastFinancialRetention", () => {
  const now = new Date("2026-10-21T00:00:00Z");

  it("is false for a record clearly within the retention window", () => {
    // One year old — nowhere near the retention cutoff.
    expect(isPastFinancialRetention("2025-10-21T00:00:00Z", now)).toBe(false);
  });

  it("is true for a record clearly past the retention window", () => {
    // Ten years old — well past the current 5-year financial-record window.
    expect(isPastFinancialRetention("2016-10-21T00:00:00Z", now)).toBe(true);
  });

  it("treats the exact cutoff instant as past retention (inclusive)", () => {
    const cutoff = new Date(now);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - FINANCIAL_RECORD_RETENTION_YEARS);
    expect(isPastFinancialRetention(cutoff.toISOString(), now)).toBe(true);
  });

  it("is false one day short of the cutoff", () => {
    const almostCutoff = new Date(now);
    almostCutoff.setUTCFullYear(almostCutoff.getUTCFullYear() - FINANCIAL_RECORD_RETENTION_YEARS);
    almostCutoff.setUTCDate(almostCutoff.getUTCDate() + 1);
    expect(isPastFinancialRetention(almostCutoff.toISOString(), now)).toBe(false);
  });
});

describe("isCurrentPolicyVersion", () => {
  it("matches the live policy version exactly", () => {
    expect(isCurrentPolicyVersion(PRIVACY_POLICY_VERSION)).toBe(true);
  });

  it("rejects any other version string, including an older-looking one", () => {
    expect(isCurrentPolicyVersion("2025-01-01-draft-1")).toBe(false);
    expect(isCurrentPolicyVersion("")).toBe(false);
  });
});
