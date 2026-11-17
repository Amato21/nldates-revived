import i18n from 'roddeh-i18n';

import en from './en';
import ja from './ja';
import fr from './fr';
import pt from './pt';
import de from './de';
import nl from './nl';
import es from './es';
import it from './it';
import ru from './ru';
import uk from './uk';
import zh from './zh';
import ko from './ko';
import moment from '../../window-moment';

const notFoundDefault = "NOTFOUND" as const;

type Translator = (key: string, defaultValue: string, variables?: Record<string, string>) => string;

// Same shape-sharing trick as src/lang/helper.ts: every language dict below
// must expose exactly `en`'s keys (with its own string values).
type LangDict = { readonly [K in keyof typeof en]: string };

// The 12 UI languages we ship a translation for, keyed by the same codes
// used throughout the rest of the plugin (settings.languages, src/lang/*).
const languageModules: Record<string, LangDict> = {
  en,
  ja,
  fr,
  pt,
  de,
  nl,
  es,
  it,
  ru,
  uk,
  'zh.hant': zh,
  ko,
};

const translatorCache: Record<string, Translator> = {};

function getTranslator(lang: string): Translator {
  if (!translatorCache[lang]) {
    const languageModule = languageModules[lang];
    if (languageModule) {
      // See src/lang/helper.ts for why this cast is needed: roddeh-i18n's
      // shipped .d.ts doesn't reflect its actual string-default overload.
      translatorCache[lang] = i18n.create({ values: languageModule }) as unknown as Translator;
    } else {
      if (!translatorCache['en']) {
        translatorCache['en'] = i18n.create({ values: en }) as unknown as Translator;
      }
      return translatorCache['en'];
    }
  }
  return translatorCache[lang];
}

/**
 * Translates a UI-string key into the given language, falling back to
 * English if the key is missing in that language's dictionary (which
 * shouldn't happen -- every shipped language dict has the same keys -- but
 * mirrors src/lang/helper.ts's t() for consistency and defensiveness).
 */
export function tUI(key: string, lang: string, variables?: Record<string, string>): string {
  const langTranslator = getTranslator(lang);
  const translation = langTranslator(key, notFoundDefault, variables);

  if (translation === notFoundDefault) {
    const enTranslator = getTranslator("en");
    return enTranslator(key, notFoundDefault, variables);
  }
  return translation;
}

// Raw Obsidian interface-language codes (as stored by Obsidian itself, see
// https://github.com/obsidianmd/obsidian-translations) that map onto one of
// our 12 shipped UI languages. Obsidian uses regional variants for a few
// languages (zh-TW, pt-BR, en-GB, nan-TW) that don't have their own exact
// entry in languageModules above.
const RAW_LANGUAGE_TO_UI_LANGUAGE: Record<string, string> = {
  en: "en",
  "en-gb": "en",
  fr: "fr",
  de: "de",
  es: "es",
  it: "it",
  pt: "pt",
  "pt-br": "pt", // No separate Brazilian-Portuguese UI dict; closest shipped match.
  ru: "ru",
  uk: "uk",
  ja: "ja",
  nl: "nl",
  "zh-tw": "zh.hant",
  "nan-tw": "zh.hant", // Taiwanese Minnan: closer to Traditional Chinese than to English.
  ko: "ko",
  // Deliberately NOT mapped: plain "zh" is Simplified Chinese. We only ship
  // a Traditional-Chinese UI dict, and silently handing a Simplified-Chinese
  // reader Traditional characters isn't a safe substitute the way falling
  // back across two very similar Portuguese variants is -- so this falls
  // through to the English default below instead, same as any other
  // unshipped language.
};

/**
 * Normalizes a raw language code (as found in Obsidian's own "language"
 * localStorage key, or returned by moment.locale()) to one of our 12 shipped
 * UI language codes, defaulting to "en" for anything unrecognized.
 */
export function normalizeUILanguage(raw: string | null | undefined): string {
  if (!raw) return "en";
  const lower = raw.toLowerCase();
  if (RAW_LANGUAGE_TO_UI_LANGUAGE[lower]) {
    return RAW_LANGUAGE_TO_UI_LANGUAGE[lower];
  }
  // Exact code didn't match (e.g. a regional variant we don't special-case,
  // such as "de-at" or "es-mx") -- fall back to the base language before
  // giving up entirely.
  const base = lower.split("-")[0];
  if (RAW_LANGUAGE_TO_UI_LANGUAGE[base]) {
    return RAW_LANGUAGE_TO_UI_LANGUAGE[base];
  }
  if (languageModules[base]) {
    return base;
  }
  return "en";
}

/**
 * Detects which of our 12 shipped UI languages to display settings/commands
 * in, automatically, with no plugin setting of its own -- matching Obsidian's
 * own interface language so the plugin "just" speaks whatever language
 * Obsidian is already configured for.
 *
 * Obsidian stores its interface-language choice in
 * `localStorage.getItem("language")` (not documented, but used this way by
 * many community plugins -- see e.g. obsidian-local-gpt's localization). It
 * is intentionally preferred over moment.locale(): moment's global locale
 * can be, and has been observed in the wild to be, overridden by unrelated
 * plugins (e.g. a Pomodoro timer plugin resetting it to "en"), whereas the
 * localStorage key is Obsidian's own, single source of truth for interface
 * language and nothing else touches it. moment.locale() is kept only as a
 * secondary fallback, for the (defensive, not expected in normal use)
 * case where localStorage is unavailable or empty.
 */
export function detectUILanguage(): string {
  try {
    const stored = window.localStorage.getItem("language");
    if (stored) {
      return normalizeUILanguage(stored);
    }
  } catch {
    // localStorage can throw in some sandboxed/private contexts -- fall
    // through to the moment.locale() fallback below rather than propagate.
  }
  try {
    return normalizeUILanguage(moment.locale());
  } catch {
    return "en";
  }
}
