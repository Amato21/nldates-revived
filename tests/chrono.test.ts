import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// getChronos() has several branches that can't be exercised with real
// chrono-node locale modules alone (every real locale we ship either has
// createCasualConfiguration or casual/GB, and en's fallback always
// succeeds). vi.doMock + dynamic import lets each test control exactly what
// chrono-node "exports" for a given language key, to reach the remaining
// failure paths: unsupported languages, a locale module missing both known
// shapes, exceptions during initialization, and the English-fallback-also-
// fails path.
describe("getChronos", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("chrono-node");
    vi.resetModules();
  });

  it("initializes a Chrono per requested language using createCasualConfiguration", async () => {
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["en", "fr"]);
    expect(chronos.length).toBe(2);
  });

  it("logs a warning and skips a language chrono-node has no module for at all", async () => {
    const { logger } = await import("../src/logger");
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["xx-not-a-real-language"]);
    // Falls through to the English fallback, so it's not empty.
    expect(chronos.length).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Language is not supported by chrono-node",
      { language: "xx-not-a-real-language" }
    );
  });

  it("treats a locale module with neither createCasualConfiguration nor casual as unsupported", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return { ...actual, fr: {} };
    });
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    // Falls through to the (real, working) English fallback.
    expect(chronos.length).toBe(1);
  });

  it("catches and logs an error if building a language's Chrono throws", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return {
        ...actual,
        fr: {
          ...actual.fr,
          createCasualConfiguration: () => { throw new Error("boom"); },
        },
      };
    });
    const { logger } = await import("../src/logger");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    expect(chronos.length).toBe(1); // English fallback still succeeds
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialize chrono for language",
      expect.objectContaining({ language: "fr", error: "boom" })
    );
  });

  it("resolves an ordinal-only date like \"15th\" to the reference month, not one month off", async () => {
    // Regression guard: the custom ordinal-date parser used to pass
    // moment().month() (0-indexed) directly as chrono-node's month
    // component (1-indexed), always resolving to the wrong month --
    // and, via forwardDate, sometimes the wrong year too.
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["en"]);
    const refDate = new Date(2026, 6, 10); // July 10, 2026 (JS Date month is 0-indexed)
    const results = chronos[0].parse("15th", refDate, { forwardDate: true });
    expect(results.length).toBeGreaterThan(0);
    const parsed = results[0].start.date();
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6); // July
    expect(parsed.getDate()).toBe(15);
  });

  it("uses the parse call's reference date, not the real system clock (regression: previously used moment() directly)", async () => {
    // Fakes the system clock to a month different from the explicit refDate
    // passed to parse(). If the parser fell back to reading the real "now"
    // instead of context.refDate, this would resolve to the fake system
    // month (March) instead of the explicit reference month (July).
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 2, 1)); // March 1, 2026 -- unrelated to refDate below
      const getChronos = (await import("../src/chrono")).default;
      const chronos = getChronos(["en"]);
      const refDate = new Date(2026, 6, 10); // July 10, 2026
      const results = chronos[0].parse("15th", refDate, { forwardDate: true });
      expect(results.length).toBeGreaterThan(0);
      const parsed = results[0].start.date();
      expect(parsed.getMonth()).toBe(6); // July, from refDate -- not March, from the fake "now"
      expect(parsed.getDate()).toBe(15);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the GB Chrono instance when the locale is en-gb and GB is available", async () => {
    const realLocale = window.moment.locale;
    (window.moment as any).locale = () => 'en-gb';
    try {
      const getChronos = (await import("../src/chrono")).default;
      const chronos = getChronos(["en"]);
      expect(chronos.length).toBe(1);
    } finally {
      (window.moment as any).locale = realLocale;
    }
  });

  it("falls back to English casual when GB isn't available for a GB locale", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      const enWithoutGB = { ...(actual.en as Record<string, unknown>) };
      delete enWithoutGB.GB;
      return { ...actual, en: enWithoutGB };
    });
    const realLocale = window.moment.locale;
    (window.moment as any).locale = () => 'en-gb';
    try {
      const getChronos = (await import("../src/chrono")).default;
      const chronos = getChronos(["en"]);
      expect(chronos.length).toBe(1);
    } finally {
      (window.moment as any).locale = realLocale;
    }
  });

  it("catches and logs a non-Error throw from a language's initialization", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return {
        ...actual,
        fr: {
          ...actual.fr,
          // eslint-disable-next-line no-throw-literal
          createCasualConfiguration: () => { throw "not an Error instance"; },
        },
      };
    });
    const { logger } = await import("../src/logger");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    expect(chronos.length).toBe(1); // English fallback still succeeds
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialize chrono for language",
      expect.objectContaining({ language: "fr", error: "not an Error instance" })
    );
  });

  it("logs an error and returns an empty array if every language fails and English fallback also fails", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return { ...actual, fr: {}, en: {} };
    });
    const { logger } = await import("../src/logger");
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    expect(chronos).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith("No languages could be initialized, attempting English fallback");
    expect(errorSpy).toHaveBeenCalledWith("English chrono module not available");
  });

  it("catches and logs an error if the English fallback itself throws", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return {
        ...actual,
        fr: {},
        en: {
          ...actual.en,
          createCasualConfiguration: () => { throw new Error("fallback boom"); },
        },
      };
    });
    const { logger } = await import("../src/logger");
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    expect(chronos).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialize default English chrono",
      expect.objectContaining({ error: "fallback boom" })
    );
  });

  it("catches and logs a non-Error throw from the English fallback", async () => {
    vi.doMock("chrono-node", async (importOriginal) => {
      const actual = await importOriginal<typeof import("chrono-node")>();
      return {
        ...actual,
        fr: {},
        en: {
          ...actual.en,
          // eslint-disable-next-line no-throw-literal
          createCasualConfiguration: () => { throw "fallback not an Error"; },
        },
      };
    });
    const { logger } = await import("../src/logger");
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const getChronos = (await import("../src/chrono")).default;
    const chronos = getChronos(["fr"]);
    expect(chronos).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to initialize default English chrono",
      expect.objectContaining({ error: "fallback not an Error" })
    );
  });
});
