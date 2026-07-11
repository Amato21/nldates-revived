import { describe, it, expect } from "vitest";
import t from "../src/lang/helper";

// This file intentionally doesn't import other test files/setup that might
// already have called t() for "en" or an unsupported language -- vitest
// isolates the module graph per test file, so translatorCache (module-level
// state in lang/helper.ts) starts empty here, letting the "en not cached
// yet" fallback branch actually run.
describe("lang/helper t()", () => {
  it("translates a key for a known, supported language", () => {
    expect(t("today", "fr")).toBe("Aujourd'hui");
  });

  it("falls back to English for an unsupported language code (English not yet cached)", () => {
    expect(t("today", "xx-not-a-real-language")).toBe("Today");
  });

  it("falls back to English for a second unsupported language code (English now cached)", () => {
    expect(t("tomorrow", "yy-also-not-real")).toBe("Tomorrow");
  });

  it("returns NOTFOUND for a key that doesn't exist even in English", () => {
    expect(t("this-key-does-not-exist-anywhere", "en")).toBe("NOTFOUND");
  });
});
