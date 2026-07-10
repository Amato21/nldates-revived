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

// Map des modules de langue pour faciliter l'accès
const languageModules: Record<string, typeof en> = {
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
      translatorCache[lang] = i18n.create({ values: languageModule });
    } else {
      // Fallback vers l'anglais si la langue n'est pas trouvée
      if (!translatorCache['en']) {
        translatorCache['en'] = i18n.create({ values: en });
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