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
});
