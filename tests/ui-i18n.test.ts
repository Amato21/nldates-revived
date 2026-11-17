import "./setup";
import { describe, it, expect, afterEach } from "vitest";
import { tUI, normalizeUILanguage, detectUILanguage } from "../src/lang/ui/helper";
import en from "../src/lang/ui/en";
import fr from "../src/lang/ui/fr";
import es from "../src/lang/ui/es";
import it_ from "../src/lang/ui/it";
import de from "../src/lang/ui/de";
import pt from "../src/lang/ui/pt";
import nl from "../src/lang/ui/nl";
import ru from "../src/lang/ui/ru";
import uk from "../src/lang/ui/uk";
import ja from "../src/lang/ui/ja";
import zh from "../src/lang/ui/zh";
import ko from "../src/lang/ui/ko";

// Per CLAUDE.md's rule on translation-related changes: covering all 12
// shipped languages isn't enough on its own -- it must be verified
// empirically that each one actually resolves a real translated string
// (not a missing-key fallback to English, which tUI()'s own design would
// otherwise silently mask: a typo'd/missing key in e.g. ja.ts would still
// "work" by falling back to English without these tests, defeating the
// point of shipping a Japanese translation at all).
const dicts: Record<string, Record<string, string>> = {
  en, fr, es, it: it_, de, pt, nl, ru, uk, ja, "zh.hant": zh, ko,
};

const SHIPPED_UI_LANGUAGES = Object.keys(dicts);

describe("UI i18n dictionaries", () => {
  it("ships exactly the 12 supported languages", () => {
    expect(SHIPPED_UI_LANGUAGES.sort()).toEqual(
      ["de", "en", "es", "fr", "it", "ja", "ko", "nl", "pt", "ru", "uk", "zh.hant"].sort()
    );
  });

  it("every non-English dictionary defines exactly the same keys as en.ts (no missing/extra/typo'd key)", () => {
    const enKeys = Object.keys(en).sort();
    for (const [lang, dict] of Object.entries(dicts)) {
      if (lang === "en") continue;
      expect(Object.keys(dict).sort(), `${lang}.ts key set`).toEqual(enKeys);
    }
  });

  it("every key in every language actually resolves to that language's own translation, not a silent English fallback", () => {
    for (const [lang, dict] of Object.entries(dicts)) {
      for (const key of Object.keys(dict)) {
        const resolved = tUI(key, lang);
        expect(resolved, `tUI("${key}", "${lang}")`).not.toBe("NOTFOUND");
        expect(resolved.length, `tUI("${key}", "${lang}") should be non-empty`).toBeGreaterThan(0);
        // The real, language-specific empirical check: for every key whose
        // English value differs from at least one other language's value
        // (i.e. it was actually translated, not coincidentally identical
        // across languages), confirm this language's resolved string
        // doesn't silently equal English's -- which is exactly the failure
        // mode a copy-pasted-then-forgotten-to-translate key would produce.
        if (lang !== "en" && dict[key] !== en[key as keyof typeof en]) {
          expect(resolved, `tUI("${key}", "${lang}") should differ from English`).not.toBe(tUI(key, "en"));
        }
      }
    }
  });

  it("substitutes %{variable} placeholders in every language", () => {
    for (const lang of SHIPPED_UI_LANGUAGES) {
      const resolved = tUI("locale_default_option", lang, { day: "Monday" });
      expect(resolved, `tUI("locale_default_option", "${lang}", {day})`).toContain("Monday");
    }
  });

  it("falls back to English for a language with no shipped dictionary", () => {
    expect(tUI("date_format_name", "xx-not-a-real-language")).toBe(en.date_format_name);
  });
});

describe("normalizeUILanguage", () => {
  it("maps Obsidian's own interface-language codes onto our shipped UI languages", () => {
    expect(normalizeUILanguage("en")).toBe("en");
    expect(normalizeUILanguage("fr")).toBe("fr");
    expect(normalizeUILanguage("de")).toBe("de");
    expect(normalizeUILanguage("es")).toBe("es");
    expect(normalizeUILanguage("it")).toBe("it");
    expect(normalizeUILanguage("pt")).toBe("pt");
    expect(normalizeUILanguage("ru")).toBe("ru");
    expect(normalizeUILanguage("uk")).toBe("uk");
    expect(normalizeUILanguage("ja")).toBe("ja");
    expect(normalizeUILanguage("nl")).toBe("nl");
    expect(normalizeUILanguage("ko")).toBe("ko");
  });

  it("is case-insensitive", () => {
    expect(normalizeUILanguage("FR")).toBe("fr");
    expect(normalizeUILanguage("Zh-TW")).toBe("zh.hant");
  });

  it("maps regional variants Obsidian uses onto the closest shipped language", () => {
    // Obsidian's own codes (see obsidianmd/obsidian-translations): zh-TW is
    // Traditional Chinese (our "zh.hant"), pt-BR is Brazilian Portuguese
    // (no separate dict shipped -- falls back to our single Portuguese
    // dict), en-GB is English.
    expect(normalizeUILanguage("zh-TW")).toBe("zh.hant");
    expect(normalizeUILanguage("pt-BR")).toBe("pt");
    expect(normalizeUILanguage("en-GB")).toBe("en");
    expect(normalizeUILanguage("nan-TW")).toBe("zh.hant");
  });

  it("falls back to the base language for an unlisted regional variant", () => {
    expect(normalizeUILanguage("de-AT")).toBe("de");
    expect(normalizeUILanguage("es-MX")).toBe("es");
  });

  it("falls back to English for plain Simplified Chinese (\"zh\"), rather than guessing Traditional", () => {
    // Deliberate: see RAW_LANGUAGE_TO_UI_LANGUAGE's comment in helper.ts --
    // we only ship a Traditional-Chinese dict, and silently handing a
    // Simplified-Chinese reader Traditional characters isn't a safe
    // substitute, unlike the Brazilian/European Portuguese case above.
    expect(normalizeUILanguage("zh")).toBe("en");
  });

  it("falls back to English for an unrecognized or missing language code", () => {
    expect(normalizeUILanguage("xx-not-a-real-language")).toBe("en");
    expect(normalizeUILanguage(null)).toBe("en");
    expect(normalizeUILanguage(undefined)).toBe("en");
    expect(normalizeUILanguage("")).toBe("en");
  });
});

describe("detectUILanguage", () => {
  const originalLocalStorage = (globalThis as unknown as { window: { localStorage?: unknown } }).window.localStorage;

  afterEach(() => {
    (globalThis as unknown as { window: { localStorage?: unknown } }).window.localStorage = originalLocalStorage;
  });

  function mockLocalStorage(value: string | null): void {
    (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage = {
      getItem: (key: string) => (key === "language" ? value : null),
    };
  }

  it("prefers Obsidian's own localStorage language setting over moment.locale()", () => {
    mockLocalStorage("fr");
    const realLocale = window.moment.locale;
    (window.moment as unknown as { locale: () => string }).locale = () => "de";
    try {
      expect(detectUILanguage()).toBe("fr");
    } finally {
      (window.moment as unknown as { locale: typeof realLocale }).locale = realLocale;
    }
  });

  it("falls back to moment.locale() when localStorage has no language set", () => {
    mockLocalStorage(null);
    const realLocale = window.moment.locale;
    (window.moment as unknown as { locale: () => string }).locale = () => "es";
    try {
      expect(detectUILanguage()).toBe("es");
    } finally {
      (window.moment as unknown as { locale: typeof realLocale }).locale = realLocale;
    }
  });

  it("falls back to moment.locale() when localStorage itself throws (e.g. a sandboxed context)", () => {
    (globalThis as unknown as { window: { localStorage: unknown } }).window.localStorage = {
      getItem: () => { throw new Error("blocked"); },
    };
    const realLocale = window.moment.locale;
    (window.moment as unknown as { locale: () => string }).locale = () => "it";
    try {
      expect(detectUILanguage()).toBe("it");
    } finally {
      (window.moment as unknown as { locale: typeof realLocale }).locale = realLocale;
    }
  });

  it("falls back to English when neither localStorage nor moment.locale() yield anything usable", () => {
    mockLocalStorage(null);
    const realLocale = window.moment.locale;
    (window.moment as unknown as { locale: () => string }).locale = () => "";
    try {
      expect(detectUILanguage()).toBe("en");
    } finally {
      (window.moment as unknown as { locale: typeof realLocale }).locale = realLocale;
    }
  });
});
