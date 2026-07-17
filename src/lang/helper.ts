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

const notFoundDefault = "NOTFOUND" as const;

type Translator = (key: string, defaultValue: string, variables?: Record<string, string>) => string;

// Cache des traducteurs pour éviter de les recréer à chaque appel
// Performance optimization: translators are created once and reused
const translatorCache: Record<string, Translator> = {};

// Shape shared by every language dict: same keys as `en`, but each language
// has its own string values (not `en`'s exact literal text) -- using
// `typeof en` directly here would compare every other language's text
// against `en`'s literal English strings and always fail.
type LangDict = { readonly [K in keyof typeof en]: string };

// Map des modules de langue pour faciliter l'accès
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
};

/**
 * Obtient un traducteur pour une langue donnée (avec cache)
 * Gets a translator for a given language (cached)
 */
function getTranslator(lang: string): Translator {
  if (!translatorCache[lang]) {
    const languageModule = languageModules[lang];
    if (languageModule) {
      // roddeh-i18n's shipped types declare the 2nd call argument as
      // `number | FormattingContext`, but its actual runtime API (used
      // throughout this file) also accepts a plain string default value --
      // that overload just isn't reflected in its .d.ts, hence the cast.
      translatorCache[lang] = i18n.create({ values: languageModule }) as unknown as Translator;
    } else {
      // Fallback vers l'anglais si la langue n'est pas trouvée
      if (!translatorCache['en']) {
        translatorCache['en'] = i18n.create({ values: en }) as unknown as Translator;
      }
      return translatorCache['en'];
    }
  }
  return translatorCache[lang];
}

export default function t(key: string, lang: string, variables?: Record<string, string>): string {
  const langTranslator = getTranslator(lang);
  const translation = langTranslator(key, notFoundDefault, variables);
  
  if (translation === notFoundDefault) {
    const enTranslator = getTranslator("en");
    return enTranslator(key, notFoundDefault, variables);
  }
  return translation;
}