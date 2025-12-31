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

  constructor(languages: string[]) {
    this.chronos = getChronos(languages);
  }

  // --- 1. Logique du "Meilleur Score" (La plus robuste) ---
  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();

    let bestResult: any = null;
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text, referenceDate, option);
        if (results && results.length > 0) {
          const match = results[0];
          // On garde le résultat qui couvre le plus de texte
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
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    const initialParse = this.getParsedResult(selectedText);
    
    if (!initialParse || initialParse.length === 0) {
        return new Date();
    }

    const weekdayIsCertain = initialParse[0]?.start?.isCertain("weekday");

    const weekStart =
      weekStartPreference === "locale-default"
        ? getLocaleWeekStart()
        : weekStartPreference;

    const locale = {
      weekStart: getWeekNumber(weekStart),
    };

    const thisDateMatch = selectedText.match(/this\s([\w]+)/i);
    const nextDateMatch = selectedText.match(/next\s([\w]+)/i);
    const lastDayOfMatch = selectedText.match(/(last day of|end of)\s*([^\n\r]*)/i);
    const midOf = selectedText.match(/mid\s([\w]+)/i);

    const referenceDate = weekdayIsCertain
      ? window.moment().weekday(0).toDate()
      : new Date();

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return this.getParsedDateResult(`this ${weekStart}`, referenceDate);
    }

    if (nextDateMatch && nextDateMatch[1] === "week") {
      return this.getParsedDateResult(`next ${weekStart}`, referenceDate,{
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1] === "month") {
      const thisMonth = this.getParsedDateResult("this month", new Date(),{
        forwardDate: true,
      });
      return this.getParsedDateResult(selectedText, thisMonth, {
        forwardDate: true,
      });
    }

    if (nextDateMatch && nextDateMatch[1] === "year") {
      const thisYear = this.getParsedDateResult("this year", new Date(), {
        forwardDate: true,
      });
      return this.getParsedDateResult(selectedText, thisYear, {
        forwardDate: true,
      });
    }

    if (lastDayOfMatch) {
      const tempDate = this.getParsedResult(lastDayOfMatch[2]);
      if (tempDate && tempDate[0]) {
          const year = tempDate[0].start.get("year");
          const month = tempDate[0].start.get("month");
          const lastDay = getLastDayOfMonth(year, month);
          return this.getParsedDateResult(`${year}-${month}-${lastDay}`, new Date(), {
            forwardDate: true,
          });
      }
    }

    if (midOf) {
      return this.getParsedDateResult(`${midOf[1]} 15th`, new Date(), {
        forwardDate: true,
      });
    }

    // --- LE POINT CRITIQUE EST ICI ---
    // On passe { forwardDate: true } pour forcer "in 2 minutes" à être dans le futur.
    return this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as any);
  }

  // --- Fonction de détection d'heure (Version complète) ---
  hasTimeComponent(text: string): boolean {
    if (!this.chronos) return false;

    // On parcourt tous les parseurs actifs
    for (const c of this.chronos) {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
          
          // Si on trouve une Heure OU une Minute certaine, c'est gagné.
          // C'est ce qui fait que "in 2 minutes" (qui a des minutes certaines) 
          // déclenchera l'affichage de l'heure.
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