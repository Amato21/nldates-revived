import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import type { Moment } from "moment";
import getChronos from "./chrono";

import { DayOfWeek } from "./settings";
import {
  getLastDayOfMonth,
  getLocaleWeekStart,
  getWeekNumber,
} from "./utils";

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: Moment;
}

export default class NLDParser {
  chronos: Chrono[];
  
  // --- 1. REGEX ULTRA COMPLÈTE ---
  // Elle détecte maintenant : minutes, heures, jours, semaines, mois, années.
  // Ex: "in 2 days", "dans 1 an", "in 3 weeks"
  regexRelative = /^\s*(?:in|dans)\s+(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours|heures?|d|day|days|jours?|w|week|weeks|semaines?|M|month|months|mois|y|yr|yrs|years?|ans?|années?)\s*$/i;

  constructor(languages: string[]) {
    this.chronos = getChronos(languages);
  }

  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();

    let bestResult: any = null;
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text, referenceDate, option);
        if (results && results.length > 0) {
          const match = results[0];
          if (match.text.length > bestScore) {
            bestScore = match.text.length;
            bestResult = match;
          }
        }
      } catch (e) {
        console.warn("NLDates: parsing error", e);
      }
    }

    return bestResult ? bestResult.start.date() : new Date();
  }

  getParsedResult(text: string): ParsedResult[] {
    if (!this.chronos) return [];

    let bestResults: ParsedResult[] = [];
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text);
        if (results && results.length > 0) {
          if (results[0].text.length > bestScore) {
            bestScore = results[0].text.length;
            bestResults = results;
          }
        }
      } catch (e) {
        console.warn("NLDates: parsing error", e);
      }
    }
    return bestResults;
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    // --- 2. LE BYPASS ÉTENDU ---
    // Si on détecte n'importe quel délai (jours, mois, années...), on calcule nous-même.
    const manualMatch = selectedText.match(this.regexRelative);
    if (manualMatch) {
        const value = parseInt(manualMatch[1]);
        const unitStr = manualMatch[2].toLowerCase();
        
        // On convertit le texte de l'utilisateur en unité MomentJS standard
        let unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (unitStr.startsWith('h')) unit = 'hours';
        else if (unitStr.startsWith('d') || unitStr.startsWith('j')) unit = 'days';
        else if (unitStr.startsWith('w') || unitStr.startsWith('s')) unit = 'weeks'; // weeks / semaines
        else if (unitStr === 'm' || unitStr.startsWith('min')) unit = 'minutes'; // attention au conflit m/month
        else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) unit = 'months';
        else if (unitStr.startsWith('y') || unitStr.startsWith('a')) unit = 'years';

        // MomentJS gère parfaitement les sauts d'année (Dec 31 + 1 day = Jan 1)
        return window.moment().add(value, unit).toDate();
    }

    // --- 3. Moteur Classique pour les dates complexes (Next Friday...) ---
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    const initialParse = this.getParsedResult(selectedText);
    if (!initialParse || initialParse.length === 0) {
        return new Date();
    }

    const weekdayIsCertain = initialParse[0]?.start?.isCertain("weekday");
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = weekdayIsCertain ? window.moment().weekday(0).toDate() : new Date();

    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(/(last day of|end of)\s*([^\n\r]*)/i);
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return this.getParsedDateResult(`this ${weekStart}`, referenceDate);
    }
    if (nextDateMatch && nextDateMatch[1] === "week") {
      return this.getParsedDateResult(`next ${weekStart}`, referenceDate, { forwardDate: true });
    }
    if (nextDateMatch && nextDateMatch[1] === "month") {
      const thisMonth = this.getParsedDateResult("this month", new Date(), { forwardDate: true });
      return this.getParsedDateResult(selectedText, thisMonth, { forwardDate: true });
    }
    if (nextDateMatch && nextDateMatch[1] === "year") {
      const thisYear = this.getParsedDateResult("this year", new Date(), { forwardDate: true });
      return this.getParsedDateResult(selectedText, thisYear, { forwardDate: true });
    }
    if (lastDayOfMatch) {
      const tempDate = this.getParsedResult(lastDayOfMatch[2]);
      if (tempDate && tempDate[0]) {
          const year = tempDate[0].start.get("year");
          const month = tempDate[0].start.get("month");
          const lastDay = getLastDayOfMonth(year, month);
          return this.getParsedDateResult(`${year}-${month}-${lastDay}`, new Date(), { forwardDate: true });
      }
    }
    if (midOf) {
      return this.getParsedDateResult(`${midOf[1]} 15th`, new Date(), { forwardDate: true });
    }

    return this.getParsedDateResult(selectedText, referenceDate, { locale, forwardDate: true } as any);
  }

  hasTimeComponent(text: string): boolean {
    // Si c'est notre bypass (in X ...), on doit décider si on affiche l'heure.
    if (this.regexRelative.test(text)) {
        // Logique : Si on ajoute des Années, Mois, Semaines ou Jours -> PAS d'heure (souvent on veut juste la date).
        // Si on ajoute des Heures ou Minutes -> OUI on veut l'heure.
        const manualMatch = text.match(this.regexRelative);
        if (manualMatch) {
            const unitStr = manualMatch[2].toLowerCase();
            // Si ça commence par h (hour), m (minute, attention conflict month), min -> True
            // Attention: 'm' seul peut être minute. 'M' ou 'mo' est month.
            // Ma regex sépare bien: m|min|... vs M|month
            
            // Si c'est des heures ou minutes => TRUE
            if (unitStr.startsWith('h') || unitStr === 'm' || unitStr.startsWith('min')) {
                return true;
            }
            // Si c'est jours, mois, années => FALSE (on veut juste la date [[YYYY-MM-DD]])
            return false;
        }
    }

    if (!this.chronos) return false;

    for (const c of this.chronos) {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
          if (start && (start.isCertain("hour") || start.isCertain("minute"))) {
            return true;
          }
        }
      } catch (e) {
        console.warn("Check time error", e);
      }
    }
    return false;
  }
}