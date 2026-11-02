import { describe, expect, it } from "vitest";
import { firstGrapheme, initials } from "./utils";

describe("initials", () => {
  it("uses first and last word for Latin names", () => {
    expect(initials("Somchai Prasert")).toBe("SP");
    expect(initials("Nong")).toBe("NO");
    expect(initials("  ")).toBe("?");
  });

  it("keeps Thai tone marks with their consonant and skips leading vowels", () => {
    expect(firstGrapheme("เจ๊หน่อย")).toBe("จ๊");
    expect(firstGrapheme("ไก่")).toBe("ก่");
    expect(initials("สมชาย ใจดี")).toBe("สจ");
    expect(initials("แป้ง")).toBe("ป้");
  });
});
