import { Chrono } from "chrono-node";
import t from "./lang/helper";

/**
 * Interface pour les dépendances nécessaires à la détection d'heure
 */
export interface TimeDetectorDependencies {
  languages: string[];
  chronos: Chrono[];
  regexRelative: RegExp;
  regexRelativeCombined: RegExp;
  regexWeekday: RegExp;
  regexWeekdayWithTime: RegExp;
}

/**
 * Classe pour détecter si un texte contient une composante d'heure
 */
export class TimeDetector {
  private languages: string[];
  private chronos: Chrono[];
  private regexRelative: RegExp;
  private regexRelativeCombined: RegExp;
  private regexWeekday: RegExp;
  private regexWeekdayWithTime: RegExp;

  constructor(dependencies: TimeDetectorDependencies) {
    this.languages = dependencies.languages;
    this.chronos = dependencies.chronos;
    this.regexRelative = dependencies.regexRelative;
    this.regexRelativeCombined = dependencies.regexRelativeCombined;
    this.regexWeekday = dependencies.regexWeekday;
    this.regexWeekdayWithTime = dependencies.regexWeekdayWithTime;
  }

  /**
   * Vérifie si le texte contient une composante d'heure
   */
  hasTimeComponent(text: string): boolean {
    // 1. If it's "now" in any language, YES.
    // Translations can list several variants pipe-separated (e.g. Italian
    // "adesso|ora", Chinese "現在|现在"); split each language's "now" entry
    // directly instead of trying to match individual immediateKeywords
    // entries (already split, for all of now/today/tomorrow/yesterday
    // combined) against the raw, unsplit translation string, which could
    // never equal a single already-split variant.
    const nowWords = this.languages.flatMap(lang =>
      t('now', lang).toLowerCase().split('|').map(w => w.trim()).filter(w => w)
    );
    if (nowWords.some(w => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(text))) {
      return true;
    }

    // 2. First check combinations "in X weeks and Y days"
    const relCombinedMatch = text.match(this.regexRelativeCombined);
    if (relCombinedMatch) {
        const unitStr1 = relCombinedMatch[2].toLowerCase();
        const unitStr2 = relCombinedMatch[4].toLowerCase();
        // If one of the units is hours or minutes -> YES
        if (unitStr1.startsWith('h') || unitStr1 === 'm' || unitStr1.startsWith('min') ||
            unitStr2.startsWith('h') || unitStr2 === 'm' || unitStr2.startsWith('min')) {
            return true;
        }
        // Otherwise -> NO (days, weeks, months, years)
        return false;
    }

    // 3. If it's a simple delay in HOURS or MINUTES -> YES
    const relMatch = text.match(this.regexRelative);
    if (relMatch) {
        const unitStr = relMatch[2].toLowerCase();
        // m, min, minutes, h, hours...
        if (unitStr.startsWith('h') || unitStr === 'm' || unitStr.startsWith('min')) {
            return true;
        }
        // Days, months, years -> NO
        return false;
    }

    // 4. If it's a specific day with time (Next Monday at 3pm) -> YES
    if (this.regexWeekdayWithTime && this.regexWeekdayWithTime.test(text)) {
      return true;
    }
    
    // 5. If it's a specific day without time (Next Monday) or Tomorrow -> NO (Generally we just want the date)
    // If you want time for "Tomorrow", remove the lines below.
    if (this.regexWeekday.test(text)) {
      return false;
    }
    
    // Check today/tomorrow/yesterday keywords in all languages
    const dateKeywords = ['today', 'tomorrow', 'yesterday'];
    const dateWords: string[] = [];
    for (const key of dateKeywords) {
      for (const lang of this.languages) {
        // t() always falls back to English (lang/helper.ts), and en.ts
        // always defines today/tomorrow/yesterday, so this guard can't
        // actually be false for these three keys -- kept for safety in case
        // that invariant ever changes.
        const word = t(key, lang);
        if (word && word !== "NOTFOUND") {
          dateWords.push(word.toLowerCase());
        }
      }
    }
    if (dateWords.some(w => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(text))) {
      return false;
    }

    // 6. Otherwise, ask the library if it sees an explicit time (ex: "Tomorrow at 5pm")
    if (!this.chronos) {
      return false;
    }
    for (const c of this.chronos) {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
          if (start && (start.isCertain("hour") || start.isCertain("minute"))) {
            return true;
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return false;
  }
}

