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
    uk: i18n.create({ values: uk }),
    'zh.hant': i18n.create({ values: zh }),
  } as Record<string, Translator>;

  const langTranslator = languages[lang];
  const translation = langTranslator ? langTranslator(key, notFoundDefault, variables) : notFoundDefault;
  
  const enTranslator = languages["en"];
  return translation === notFoundDefault ? (enTranslator ? enTranslator(key, notFoundDefault, variables) : key) : translation;
}