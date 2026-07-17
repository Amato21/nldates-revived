import "./setup";
import { describe, it, expect, vi, afterEach } from "vitest";
import ContextAnalyzer from "../src/context-analyzer";

// Minimal fakes: ContextAnalyzer only reads plugin.settings.languages and
// calls app.workspace.getActiveViewOfType(...) / app.metadataCache.getFileCache(...).
function createEditor(content: string) {
  return {
    getValue: () => content,
  } as any;
}

function createApp(content: string, languages: string[]) {
  const file = { path: "note.md" };
  return {
    app: {
      workspace: {
        getActiveViewOfType: vi.fn(() => ({ file })),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({ tags: [], frontmatter: undefined, headings: [] })),
      },
    } as any,
    plugin: { settings: { languages } } as any,
    editor: createEditor(content),
  };
}

describe("ContextAnalyzer", () => {
  let analyzer: ContextAnalyzer | undefined;

  afterEach(() => {
    analyzer?.destroy();
    analyzer = undefined;
  });

  it("extracts weekdays, today/tomorrow/yesterday, and relative expressions (English)", () => {
    const { app, plugin, editor } = createApp(
      "Meeting tomorrow, then next Friday. In 3 days we ship.",
      ["en"]
    );
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);

    const found = result.datesInContext.map(d => d.toLowerCase());
    expect(found).toContain("tomorrow");
    expect(found.some(d => d.includes("friday"))).toBe(true);
    expect(found.some(d => d.includes("3 days"))).toBe(true);
  });

  // Regression guard: the leading word-boundary used to be a negative
  // lookbehind ("(?<!...)"), which throws a SyntaxError constructing the
  // RegExp on Safari/iOS before 16.4. Verifies the fix (a consuming
  // alternation instead) is actually in place, not just that extraction
  // still happens to work.
  it("never constructs a pattern using lookbehind syntax", () => {
    const { app, plugin } = createApp("", ["en", "fr", "zh.hant"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const patterns = (analyzer as any).datePatterns as RegExp[];
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(pattern.source).not.toContain("?<!");
      expect(pattern.source).not.toContain("?<=");
    }
  });

  it("still blocks partial-word matches and matches at the start of the string after the lookbehind fix", () => {
    const { app, plugin, editor } = createApp("Mondayish is not a real word, but Monday is", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const found = analyzer.analyzeContextSync(editor, 0).datesInContext.map(d => d.toLowerCase());
    expect(found).not.toContain("mondayish");
    expect(found).toContain("monday");

    const { app: app2, plugin: plugin2, editor: editor2 } = createApp("Monday is the day", ["en"]);
    analyzer.destroy();
    analyzer = new ContextAnalyzer(app2, plugin2);
    expect(analyzer.analyzeContextSync(editor2, 0).datesInContext.map(d => d.toLowerCase())).toContain("monday");
  });

  it("extracts dates from Chinese context (Simplified and Traditional)", () => {
    const { app, plugin, editor } = createApp("下周一开会，2天后交稿。", ["zh.hant"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);

    expect(result.datesInContext.length).toBeGreaterThan(0);
  });

  it("returns an empty result when there is no active markdown view", () => {
    const { plugin, editor } = createApp("tomorrow", ["en"]);
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => null) },
      metadataCache: { getFileCache: vi.fn() },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);

    expect(result.datesInContext).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it("resetPatterns() picks up newly enabled languages", () => {
    const { app, plugin, editor } = createApp("下周一", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    expect(analyzer.analyzeContextSync(editor, 0).datesInContext).toEqual([]);

    plugin.settings.languages = ["zh.hant"];
    analyzer.resetPatterns();
    expect(analyzer.analyzeContextSync(editor, 0).datesInContext.length).toBeGreaterThan(0);
  });

  it("builds no date patterns at all when no languages are configured", () => {
    const { app, plugin, editor } = createApp("tomorrow next Friday in 3 days", []);
    analyzer = new ContextAnalyzer(app, plugin);
    expect(analyzer.analyzeContextSync(editor, 0).datesInContext).toEqual([]);
  });

  it("returns an empty result when the active view has no file", () => {
    const { plugin, editor } = createApp("tomorrow", ["en"]);
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => ({ file: null })) },
      metadataCache: { getFileCache: vi.fn() },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result).toEqual({
      datesInContext: [],
      tags: [],
      timestamp: expect.any(Number),
    });
  });

  it("extracts tags and a title from frontmatter metadata", () => {
    const { plugin, editor } = createApp("tomorrow", ["en"]);
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => ({ file: { path: "note.md" } })) },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          tags: [{ tag: "#work" }, { tag: "#urgent" }],
          frontmatter: { title: "My Note" },
          headings: [],
        })),
      },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result.tags).toEqual(["#work", "#urgent"]);
    expect(result.title).toBe("My Note");
  });

  it("falls back to the first heading as the title when there's no frontmatter title", () => {
    const { plugin, editor } = createApp("tomorrow", ["en"]);
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => ({ file: { path: "note.md" } })) },
      metadataCache: {
        getFileCache: vi.fn(() => ({
          tags: undefined,
          frontmatter: undefined,
          headings: [{ heading: "First Heading" }],
        })),
      },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result.title).toBe("First Heading");
  });

  it("leaves title/tags unset when metadataCache returns no metadata", () => {
    const { plugin, editor } = createApp("tomorrow", ["en"]);
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => ({ file: { path: "note.md" } })) },
      metadataCache: { getFileCache: vi.fn(() => null) },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result.title).toBeUndefined();
    expect(result.tags).toEqual([]);
  });

  it("returns a cached result on a second call for the same file/line, within the cache timeout", () => {
    const { app, plugin, editor } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const first = analyzer.analyzeContextSync(editor, 0);
    const second = analyzer.analyzeContextSync(editor, 0);
    expect(second).toBe(first); // same cached object instance
  });

  it("re-analyzes and refreshes the cache once an entry expires", () => {
    vi.useFakeTimers();
    try {
      const { app, plugin, editor } = createApp("tomorrow", ["en"]);
      analyzer = new ContextAnalyzer(app, plugin);
      const first = analyzer.analyzeContextSync(editor, 0);
      vi.advanceTimersByTime(6000); // past the 5s CACHE_TIMEOUT
      const second = analyzer.analyzeContextSync(editor, 0);
      expect(second).not.toBe(first);
      expect(second.datesInContext).toEqual(first.datesInContext);
    } finally {
      vi.useRealTimers();
    }
  });

  it("catches and logs an error if analysis throws, returning an empty-ish context", async () => {
    const { logger } = await import("../src/logger");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const { app, plugin } = createApp("tomorrow", ["en"]);
    const throwingEditor = {
      getValue: () => { throw new Error("boom"); },
    } as any;
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(throwingEditor, 0);
    expect(result.datesInContext).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith("Error analyzing context:", expect.objectContaining({ error: expect.any(Error) }));
  });

  it("analyzeContext() resolves with the same result as analyzeContextSync()", async () => {
    const { app, plugin, editor } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const result = await analyzer.analyzeContext(editor, 0);
    expect(result.datesInContext).toContain("Tomorrow");
  });

  it("getCacheStats() reports size and maxSize", () => {
    const { app, plugin, editor } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    analyzer.analyzeContextSync(editor, 0);
    const stats = analyzer.getCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.maxSize).toBeGreaterThan(0);
  });

  it("stopPeriodicCleanup() is a no-op when called twice", () => {
    const { app, plugin } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    analyzer.stopPeriodicCleanup();
    expect(() => analyzer!.stopPeriodicCleanup()).not.toThrow();
  });

  it("cleanupExpiredEntries() removes only entries past the cache timeout", () => {
    // window.setInterval was captured as a real-timer reference in
    // tests/setup.ts before any per-test vi.useFakeTimers() call can patch
    // globalThis, so the periodic callback itself can't be driven by fake
    // timers here -- call the private cleanup method directly instead.
    vi.useFakeTimers();
    try {
      const { app, plugin, editor } = createApp("tomorrow", ["en"]);
      analyzer = new ContextAnalyzer(app, plugin);
      analyzer.analyzeContextSync(editor, 0);
      expect(analyzer.getCacheStats().size).toBe(1);

      vi.advanceTimersByTime(6000); // past the 5s CACHE_TIMEOUT
      (analyzer as any).cleanupExpiredEntries();
      expect(analyzer.getCacheStats().size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cleanupExpiredEntries() is a no-op when nothing has expired", () => {
    const { app, plugin, editor } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    analyzer.analyzeContextSync(editor, 0);
    (analyzer as any).cleanupExpiredEntries();
    expect(analyzer.getCacheStats().size).toBe(1);
  });

  it("deduplicates repeated date mentions within the same context", () => {
    const { app, plugin, editor } = createApp("tomorrow, see you tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result.datesInContext.filter(d => d.toLowerCase() === "tomorrow").length).toBe(1);
  });

  it("normalizeDate() capitalizes the first letter and lowercases the rest", () => {
    const { app, plugin } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const normalizeDate = (analyzer as any).normalizeDate.bind(analyzer);
    expect(normalizeDate("TOMORROW")).toBe("Tomorrow");
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("   ")).toBe("");
  });

  it("normalizeDate() title-cases every word instead of lowercasing the rest of the whole string (regression)", () => {
    // "next Friday" (from the prefix+weekday pattern) used to come out as
    // "Next friday" -- only the very first character of the whole match was
    // capitalized, forcibly lowercasing the weekday name's own capital.
    const { app, plugin } = createApp("tomorrow", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const normalizeDate = (analyzer as any).normalizeDate.bind(analyzer);
    expect(normalizeDate("next Friday")).toBe("Next Friday");
    expect(normalizeDate("NEXT FRIDAY")).toBe("Next Friday");
  });

  it("extracts \"next Friday\" with the weekday correctly capitalized (regression)", () => {
    const { app, plugin, editor } = createApp("Meeting tomorrow, then next Friday.", ["en"]);
    analyzer = new ContextAnalyzer(app, plugin);
    const result = analyzer.analyzeContextSync(editor, 0);
    expect(result.datesInContext).toContain("Next Friday");
    expect(result.datesInContext).not.toContain("Next friday");
  });

  it("does not serve a stale cached result when content changes within the scanned window but the cursor line does not (regression)", () => {
    const file = { path: "note.md" };
    let content = "line0\nline1\nline2\nMonday meeting\nline4";
    const app = {
      workspace: { getActiveViewOfType: vi.fn(() => ({ file })) },
      metadataCache: { getFileCache: vi.fn(() => ({ tags: [], frontmatter: undefined, headings: [] })) },
    } as any;
    const plugin = { settings: { languages: ["en"] } } as any;
    const editor = { getValue: () => content } as any;
    analyzer = new ContextAnalyzer(app, plugin);

    const first = analyzer.analyzeContextSync(editor, 3);
    expect(first.datesInContext.map(d => d.toLowerCase())).not.toContain("next friday");

    // Edit content within the ±CONTEXT_LINES window without moving the
    // cursor line, then re-query at the same line within CACHE_TIMEOUT.
    content = "line0\nline1\nline2\nMonday meeting\nnext Friday too";
    const second = analyzer.analyzeContextSync(editor, 3);
    expect(second.datesInContext.map(d => d.toLowerCase())).toContain("next friday");
  });
});
