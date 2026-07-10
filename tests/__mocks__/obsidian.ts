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

// Fake form-field component shared by addText/addMomentFormat: captures
// setValue/setPlaceholder/setDefaultFormat calls and stores the onChange
// handler so tests can invoke it directly with a simulated user-typed value.
function makeTextComponent() {
  const comp = {
    value: "",
    placeholder: "",
    defaultFormat: "",
    onChangeHandler: null as ((value: string) => void | Promise<void>) | null,
    setValue(v: string) { comp.value = v; return comp; },
    setPlaceholder(p: string) { comp.placeholder = p; return comp; },
    setDefaultFormat(f: string) { comp.defaultFormat = f; return comp; },
    onChange(fn: (value: string) => void | Promise<void>) { comp.onChangeHandler = fn; return comp; },
  };
  return comp;
}

function makeToggleComponent() {
  const comp = {
    value: false,
    onChangeHandler: null as ((value: boolean) => void | Promise<void>) | null,
    setValue(v: boolean) { comp.value = v; return comp; },
    onChange(fn: (value: boolean) => void | Promise<void>) { comp.onChangeHandler = fn; return comp; },
  };
  return comp;
}

function makeDropdownComponent() {
  const comp = {
    value: "",
    options: [] as { value: string; display: string }[],
    onChangeHandler: null as ((value: string) => void | Promise<void>) | null,
    addOption(value: string, display: string) { comp.options.push({ value, display }); return comp; },
    setValue(v: string) { comp.value = v; return comp; },
    onChange(fn: (value: string) => void | Promise<void>) { comp.onChangeHandler = fn; return comp; },
  };
  return comp;
}

export class Setting {
  containerEl: HTMLElement;
  nameText = "";
  descText = "";
  components: any[] = [];
  // All Setting instances created since the last reset, in creation order --
  // lets tests find "the Nth Setting" or "the Setting named X" after calling
  // a display()-style method, without needing a reference to each instance.
  static instances: Setting[] = [];
  static resetInstances(): void { Setting.instances = []; }

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    Setting.instances.push(this);
  }
  setHeading(): this { return this; }
  setName(name: string): this { this.nameText = name; return this; }
  setDesc(desc: string): this { this.descText = desc; return this; }
  addText(callback: (text: any) => void): this {
    const comp = makeTextComponent();
    this.components.push(comp);
    callback(comp);
    return this;
  }
  addToggle(callback: (toggle: any) => void): this {
    const comp = makeToggleComponent();
    this.components.push(comp);
    callback(comp);
    return this;
  }
  addMomentFormat(callback: (text: any) => void): this {
    const comp = makeTextComponent();
    this.components.push(comp);
    callback(comp);
    return this;
  }
  addDropdown(callback: (dropdown: any) => void): this {
    const comp = makeDropdownComponent();
    this.components.push(comp);
    callback(comp);
    return this;
  }
  descEl: HTMLElement = {} as any;
}

function makeFakeContainerEl(): any {
  return {
    empty: () => {},
    addClass: () => {},
    removeClass: () => {},
    createDiv: () => makeFakeContainerEl(),
    createEl: () => makeFakeContainerEl(),
    addEventListener: () => {},
    setText: () => {},
  };
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement = makeFakeContainerEl();
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }
  display(): void {}
}

// Ajouter d'autres exports si nécessaire
export default {};




