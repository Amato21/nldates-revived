import "./setup";
import { describe, it, expect, vi } from "vitest";
import getWordBoundaries from "../src/utils";
import {
  shouldOmitDateForShortRelative,
  getSelectedText,
  adjustCursor,
  getFormattedDate,
  getLastDayOfMonth,
  parseTruthy,
  validateMomentFormat,
  getLocaleWeekStart,
  generateMarkdownLink,
  getOrCreateDailyNote,
} from "../src/utils";

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

  it("returns false when no languages are configured (no patterns to test against)", () => {
    expect(shouldOmitDateForShortRelative("in 15 min", [])).toBe(false);
  });
});

function makeEditor(overrides: Record<string, unknown> = {}) {
  return {
    getCursor: vi.fn(() => ({ line: 0, ch: 5 })),
    posToOffset: vi.fn(() => 5),
    offsetToPos: vi.fn((offset: number) => ({ line: 0, ch: offset })),
    getSelection: vi.fn(() => ""),
    setSelection: vi.fn(),
    setCursor: vi.fn(),
    somethingSelected: vi.fn(() => false),
    cm: {
      state: {
        wordAt: vi.fn(() => ({ from: 2, to: 8 })),
      },
    },
    ...overrides,
  } as any;
}

describe("getWordBoundaries", () => {
  it("returns the range of the word at the cursor position", () => {
    const editor = makeEditor();
    const range = getWordBoundaries(editor);
    expect(range.from).toEqual({ line: 0, ch: 2 });
    expect(range.to).toEqual({ line: 0, ch: 8 });
  });

  it("falls back to a zero-width range at the cursor instead of throwing when wordAt() returns null", () => {
    // CodeMirror 6's wordAt() returns null when the cursor isn't inside/adjacent
    // to a word (empty line, whitespace, punctuation-only text).
    const editor = makeEditor({
      cm: { state: { wordAt: vi.fn(() => null) } },
    });
    expect(() => getWordBoundaries(editor)).not.toThrow();
    const range = getWordBoundaries(editor);
    expect(range.from).toEqual({ line: 0, ch: 5 });
    expect(range.to).toEqual({ line: 0, ch: 5 });
  });

  it("falls back to a zero-width range at the cursor when the editor has no cm property at all", () => {
    const editor = makeEditor({ cm: undefined });
    expect(() => getWordBoundaries(editor)).not.toThrow();
  });
});

describe("getSelectedText", () => {
  it("returns the current selection if something is selected", () => {
    const editor = makeEditor({
      somethingSelected: vi.fn(() => true),
      getSelection: vi.fn(() => "tomorrow"),
    });
    expect(getSelectedText(editor)).toBe("tomorrow");
    expect(editor.setSelection).not.toHaveBeenCalled();
  });

  it("selects the word at the cursor and returns it if nothing is selected", () => {
    const editor = makeEditor({
      somethingSelected: vi.fn(() => false),
      getSelection: vi.fn(() => "word"),
    });
    expect(getSelectedText(editor)).toBe("word");
    expect(editor.setSelection).toHaveBeenCalledWith({ line: 0, ch: 2 }, { line: 0, ch: 8 });
  });
});

describe("adjustCursor", () => {
  it("shifts the cursor forward when the replacement text is longer", () => {
    const editor = makeEditor();
    adjustCursor(editor, { line: 2, ch: 10 }, "longer text", "old");
    expect(editor.setCursor).toHaveBeenCalledWith({ line: 2, ch: 18 });
  });

  it("shifts the cursor backward when the replacement text is shorter", () => {
    const editor = makeEditor();
    adjustCursor(editor, { line: 2, ch: 10 }, "x", "longer old text");
    expect(editor.setCursor).toHaveBeenCalledWith({ line: 2, ch: -4 });
  });
});

describe("getFormattedDate", () => {
  it("delegates to DateFormatter.format", () => {
    const date = new Date(2025, 0, 6);
    expect(getFormattedDate(date, "YYYY-MM-DD")).toBe("2025-01-06");
  });
});

describe("getLastDayOfMonth", () => {
  it("returns the number of days in a 31-day month", () => {
    expect(getLastDayOfMonth(2025, 1)).toBe(31); // January
  });

  it("returns the number of days in a 30-day month", () => {
    expect(getLastDayOfMonth(2025, 4)).toBe(30); // April
  });

  it("handles February in a leap year", () => {
    expect(getLastDayOfMonth(2024, 2)).toBe(29);
  });

  it("handles February in a non-leap year", () => {
    expect(getLastDayOfMonth(2025, 2)).toBe(28);
  });
});

describe("parseTruthy", () => {
  it("recognizes truthy flag strings, case-insensitively", () => {
    for (const flag of ["y", "Y", "yes", "YES", "1", "t", "T", "true", "TRUE"]) {
      expect(parseTruthy(flag)).toBe(true);
    }
  });

  it("returns false for anything else", () => {
    for (const flag of ["n", "no", "0", "f", "false", "", "maybe"]) {
      expect(parseTruthy(flag)).toBe(false);
    }
  });
});

describe("validateMomentFormat", () => {
  it("rejects an empty format", () => {
    const result = validateMomentFormat("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("rejects a non-string format", () => {
    const result = validateMomentFormat(null as unknown as string);
    expect(result.valid).toBe(false);
  });

  it("rejects a format longer than 100 characters", () => {
    const result = validateMomentFormat("Y".repeat(101));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("100");
  });

  it("rejects a format Moment.js doesn't recognize (returns it unchanged)", () => {
    const result = validateMomentFormat("@@@");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalide");
  });

  it("rejects a format containing dangerous characters", () => {
    const result = validateMomentFormat("YYYY<script>");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("non autorisés");
  });

  it("accepts a valid format and returns a preview", () => {
    const result = validateMomentFormat("YYYY-MM-DD");
    expect(result.valid).toBe(true);
    expect(result.preview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("catches a non-Error throw and reports a generic message", () => {
    const realMoment = window.moment;
    (window as any).moment = (...args: unknown[]) => {
      const m = (realMoment as any)(...args);
      // eslint-disable-next-line no-throw-literal
      m.format = () => { throw "not an Error instance"; };
      return m;
    };
    try {
      const result = validateMomentFormat("YYYY-MM-DD");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Erreur lors de la validation du format");
    } finally {
      (window as any).moment = realMoment;
    }
  });

  it("catches an exception from an invalid format and reports it", () => {
    // Force window.moment().format() to throw for this one call, to exercise
    // the catch branch (real Moment.js formats are very permissive and
    // rarely throw on their own).
    const realMoment = window.moment;
    (window as any).moment = (...args: unknown[]) => {
      const m = (realMoment as any)(...args);
      m.format = () => { throw new Error("boom"); };
      return m;
    };
    try {
      const result = validateMomentFormat("YYYY-MM-DD");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("boom");
    } finally {
      (window as any).moment = realMoment;
    }
  });
});

describe("getLocaleWeekStart", () => {
  it("returns a valid day-of-week name", () => {
    const start = getLocaleWeekStart();
    expect(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]).toContain(start);
  });

  it("defaults to Sunday when the locale data has no _week info", () => {
    const realMoment = window.moment;
    (window as any).moment = Object.assign((...args: unknown[]) => (realMoment as any)(...args), {
      localeData: () => ({}),
    });
    try {
      expect(getLocaleWeekStart()).toBe("sunday");
    } finally {
      (window as any).moment = realMoment;
    }
  });
});

function makeApp(useMarkdownLinks: boolean) {
  return {
    vault: {
      getConfig: vi.fn(() => useMarkdownLinks),
    },
  } as any;
}

describe("generateMarkdownLink", () => {
  it("generates a wikilink without an alias when useMarkdownLinks is off", () => {
    expect(generateMarkdownLink(makeApp(false), "notes/today")).toBe("[[notes/today]]");
  });

  it("generates a wikilink with an alias when useMarkdownLinks is off", () => {
    expect(generateMarkdownLink(makeApp(false), "notes/today", "Today")).toBe("[[notes/today|Today]]");
  });

  it("generates a markdown link without an alias when useMarkdownLinks is on", () => {
    expect(generateMarkdownLink(makeApp(true), "notes/today")).toBe("[notes/today](notes/today)");
  });

  it("generates a markdown link with an alias when useMarkdownLinks is on, URL-encoding spaces", () => {
    expect(generateMarkdownLink(makeApp(true), "notes/my note", "My Note")).toBe("[My Note](notes/my%20note)");
  });
});

describe("getOrCreateDailyNote", () => {
  it("returns the existing daily note if one is found", async () => {
    const dailyNotesModule = await import("obsidian-daily-notes-interface");
    const existing = { path: "existing.md" } as any;
    vi.spyOn(dailyNotesModule, "getDailyNote").mockReturnValue(existing);
    const result = await getOrCreateDailyNote(window.moment() as any);
    expect(result).toBe(existing);
  });

  it("creates a new daily note if none is found", async () => {
    const dailyNotesModule = await import("obsidian-daily-notes-interface");
    vi.spyOn(dailyNotesModule, "getDailyNote").mockReturnValue(null);
    const created = { path: "created.md" } as any;
    vi.spyOn(dailyNotesModule, "createDailyNote").mockReturnValue(Promise.resolve(created));
    const result = await getOrCreateDailyNote(window.moment() as any);
    expect(result).toBe(created);
  });
});
