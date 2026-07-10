import { describe, it, expect } from "vitest";
import { shouldOmitDateForShortRelative } from "../src/utils";

describe("shouldOmitDateForShortRelative", () => {
  it("returns true for English/French prefix-style short relatives (minutes/hours)", () => {
    expect(shouldOmitDateForShortRelative("in 15 min", ["en"])).toBe(true);
    expect(shouldOmitDateForShortRelative("in 2 hours", ["en"])).toBe(true);
    expect(shouldOmitDateForShortRelative("dans 15 min", ["fr"])).toBe(true);
  });

  it("returns false for prefix-style relatives longer than a day (days/weeks/months)", () => {
    expect(shouldOmitDateForShortRelative("in 2 days", ["en"])).toBe(false);
    expect(shouldOmitDateForShortRelative("dans 2 jours", ["fr"])).toBe(false);
  });

  it("returns true for Chinese suffix-style short relatives, both scripts", () => {
    expect(shouldOmitDateForShortRelative("30分鐘後", ["zh.hant"])).toBe(true);
    expect(shouldOmitDateForShortRelative("2小時後", ["zh.hant"])).toBe(true);
    expect(shouldOmitDateForShortRelative("30分钟后", ["zh.hant"])).toBe(true);
    expect(shouldOmitDateForShortRelative("2小时后", ["zh.hant"])).toBe(true);
  });

  it("returns false for Chinese suffix-style relatives longer than a day (days/weeks)", () => {
    expect(shouldOmitDateForShortRelative("2天後", ["zh.hant"])).toBe(false);
    expect(shouldOmitDateForShortRelative("2週後", ["zh.hant"])).toBe(false);
  });

  it("returns false for unrelated text", () => {
    expect(shouldOmitDateForShortRelative("tomorrow", ["en"])).toBe(false);
    expect(shouldOmitDateForShortRelative("", ["en"])).toBe(false);
  });
});
