import { describe, expect, it } from "vitest";
import { HEAD_OFFICE_BRANCH, isValidBranchCode, isValidThaiTaxId, normalizeDigits } from "./legal";

describe("isValidThaiTaxId", () => {
  it("accepts a number with the right check digit", () => {
    expect(isValidThaiTaxId("1234567890121")).toBe(true);
    expect(isValidThaiTaxId("0105555012348")).toBe(true);
  });
  it("rejects a wrong check digit", () => {
    expect(isValidThaiTaxId("1234567890122")).toBe(false);
    expect(isValidThaiTaxId("0105555012349")).toBe(false);
  });
  it("rejects wrong length and non-digits", () => {
    expect(isValidThaiTaxId("123456789012")).toBe(false);
    expect(isValidThaiTaxId("12345678901210")).toBe(false);
    expect(isValidThaiTaxId("12345678901ab")).toBe(false);
    expect(isValidThaiTaxId("")).toBe(false);
  });
});

describe("isValidBranchCode", () => {
  it("accepts head office and five-digit branches", () => {
    expect(isValidBranchCode(HEAD_OFFICE_BRANCH)).toBe(true);
    expect(isValidBranchCode("00012")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidBranchCode("12")).toBe(false);
    expect(isValidBranchCode("000000")).toBe(false);
    expect(isValidBranchCode("0000a")).toBe(false);
  });
});

describe("normalizeDigits", () => {
  it("strips spaces and dashes", () => {
    expect(normalizeDigits("1-2345-67890-12-1")).toBe("1234567890121");
    expect(normalizeDigits(" 1234 5678 90121 ")).toBe("1234567890121");
  });
});
