export function normalizePath(path: string): string {
  return path;
}

// Mock pour les tests d'intégration
export class Modal {
  app: any;
  contentEl: HTMLElement;
  
  constructor(app: any) {
    this.app = app;
    this.contentEl = {
      empty: () => {},
      addClass: () => {},
      removeClass: () => {},
      createDiv: () => ({
        createDiv: () => ({}),
        createEl: () => ({}),
        addEventListener: () => {},
        empty: () => {},
        setText: () => {},
      }),
      createEl: () => ({}),
      addEventListener: () => {},
    } as any;
  }
  
  onOpen(): void {}
  onClose(): void {}
  close(): void {}
}

export class MarkdownView {
  editor?: any;
  file?: any;
  constructor(editor?: any, file?: any) {
    this.editor = editor;
    this.file = file;
  }
}

export class EditorSuggest<T> {
  app: any;
  scope: any;
  context: any;
  suggestions: any = { useSelectedItem: () => {} };
  // Captured registered scope shortcuts, keyed by "modifiers+key" (e.g.
  // "Shift+Enter"), so tests can invoke them directly to exercise the
  // callback bodies passed to scope.register().
  registeredHandlers: Record<string, (evt: any) => boolean> = {};

  constructor(app: any) {
    this.app = app;
    this.scope = {
      register: (modifiers: string[], key: string, callback: (evt: any) => boolean) => {
        this.registeredHandlers[`${modifiers.join("+")}+${key}`] = callback;
      },
    };
  }

  getSuggestions(context: any): T[] {
    return [];
  }

  setInstructions(instructions: any[]): void {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addText(callback: (text: any) => void): this { return this; }
  addToggle(callback: (toggle: any) => void): this { return this; }
  addMomentFormat(callback: (moment: any) => void): this { return this; }
  descEl: HTMLElement = {} as any;
}

export class PluginSettingTab {
  plugin: any;
  constructor(app: any, plugin: any) {
    this.plugin = plugin;
  }
  display(): void {}
}

// Ajouter d'autres exports si nécessaire
export default {};




