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

const notFoundDefault = "NOTFOUND" as const;

export default function t(key: string, lang: string, variables?: Record<string, string>): string {
  const languages = {
    en: i18n.create({ values: en }),
    ja: i18n.create({ values: ja }),
    fr: i18n.create({ values: fr }),
    pt: i18n.create({ values: pt }),
    de: i18n.create({ values: de }),
    nl: i18n.create({ values: nl }),
    es: i18n.create({ values: es }),
    it: i18n.create({ values: it }),
    ru: i18n.create({ values: ru }),
  };

  // Access languages dynamically
  const langTranslator = (languages as unknown as Record<string, (key: string, defaultValue: string, variables?: Record<string, string>) => string>)[lang];
  const translation = langTranslator ? langTranslator(key, notFoundDefault, variables) : notFoundDefault;
  
  const enTranslator = (languages as unknown as Record<string, (key: string, variables?: Record<string, string>) => string>)["en"];
  return translation === notFoundDefault ? (enTranslator ? enTranslator(key, variables) : key) : translation;
}
