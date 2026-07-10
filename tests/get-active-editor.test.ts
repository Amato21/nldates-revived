import { describe, it, expect } from "vitest";
import { MarkdownView } from "obsidian";
import { getActiveEditor } from "../src/utils";

// getActiveEditor() tries several fallbacks in order to cope with different
// Obsidian versions and third-party plugins (e.g. QuickAdd) that create their
// own editor contexts. These tests lock in that fallback order.
function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    activeEditor: undefined,
    activeLeaf: undefined,
    getActiveViewOfType: () => null,
    getLeavesOfType: () => [],
    ...overrides,
  } as any;
}

describe("getActiveEditor", () => {
  it("returns workspace.activeEditor.editor when present (method 1)", () => {
    const editor = { id: "from-active-editor" };
    const workspace = makeWorkspace({
      activeEditor: { editor },
      // Deliberately also satisfy later methods, to confirm method 1 wins.
      getActiveViewOfType: () => new MarkdownView({ id: "wrong" }),
    });
    expect(getActiveEditor(workspace)).toBe(editor);
  });

  it("falls back to getActiveViewOfType(MarkdownView).editor (method 2)", () => {
    const editor = { id: "from-active-view" };
    const workspace = makeWorkspace({
      getActiveViewOfType: (type: unknown) => (type === MarkdownView ? new MarkdownView(editor) : null),
    });
    expect(getActiveEditor(workspace)).toBe(editor);
  });

  it("falls back to activeLeaf.view.editor (method 3)", () => {
    const editor = { id: "from-active-leaf" };
    const workspace = makeWorkspace({
      activeLeaf: { view: { editor } },
    });
    expect(getActiveEditor(workspace)).toBe(editor);
  });

  it("falls back to the focused markdown leaf (method 4)", () => {
    const unfocused = new MarkdownView({ id: "unfocused", cm: { hasFocus: () => false } });
    const focusedEditor = { id: "focused", cm: { hasFocus: () => true } };
    const focused = new MarkdownView(focusedEditor);
    const workspace = makeWorkspace({
      getLeavesOfType: (type: string) => (type === "markdown" ? [{ view: unfocused }, { view: focused }] : []),
    });
    expect(getActiveEditor(workspace)).toBe(focusedEditor);
  });

  it("falls back to the first markdown leaf as a last resort (method 5)", () => {
    const editor = { id: "first-available", cm: { hasFocus: () => false } };
    const view = new MarkdownView(editor);
    const workspace = makeWorkspace({
      getLeavesOfType: (type: string) => (type === "markdown" ? [{ view }] : []),
    });
    expect(getActiveEditor(workspace)).toBe(editor);
  });

  it("returns null when no editor can be found anywhere", () => {
    expect(getActiveEditor(makeWorkspace())).toBeNull();
  });
});
