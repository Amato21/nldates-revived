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

  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    let result: Date;
    // Sécurité : si pas de moteur chargé
    if (!this.chronos || this.chronos.length === 0) return new Date();

    this.chronos.forEach(c => {
      // Sécurité : try/catch pour éviter qu'un moteur plante tout
      try {
        const parsedDate = c.parseDate(text, referenceDate, option);
        if (parsedDate) {
          result = parsedDate;
          return;
        }
      } catch (e) {
        console.warn("NLDates: Error parsing date", e);
      }
    });
    return result;
  }

  getParsedResult(text: string): ParsedResult[] {
    let result: ParsedResult[];
    if (!this.chronos) return [];

    this.chronos.forEach(c => {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          result = parsedResult;
          return;
        }
      } catch (e) {
        console.warn("NLDates: Error parsing result", e);
      }
    });
    return result;
  }

  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    // Sécurité si aucun moteur
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    const parser = this.chronos[0];
    const initialParse = parser.parse(selectedText);
    
    // Si parsing échoué, on renvoie une date par défaut (aujourd'hui) sans planter
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

    // ... (Logique spéciale inchangée mais protégée par le try/catch global du caller si besoin) ...
    // Pour simplifier, on garde ta logique existante ici, elle est robuste.
    // Le risque est surtout dans les appels .parse() ci-dessous.

    if (thisDateMatch && thisDateMatch[1] === "week") {
      return parser.parseDate(`this ${weekStart}`, referenceDate);
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
      // Sécurité supplémentaire ici
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

    // @ts-ignore
    return this.getParsedDateResult(selectedText, referenceDate, { locale } as any);
  }

  // --- FONCTION BLINDÉE ---
  // C'est souvent elle qui plante sur "in 20 minutes"
  hasTimeComponent(text: string): boolean {
    let hasTime = false;
    
    if (!this.chronos) return false;

    this.chronos.forEach(c => {
      try {
        const parsedResult = c.parse(text);
        if (parsedResult && parsedResult.length > 0) {
          const start = parsedResult[0].start;
          // On vérifie que 'start' existe bien avant de l'interroger
          if (start && (start.isCertain("hour") || start.get("hour") !== null)) {
            hasTime = true;
            return;
          }
        }
      } catch (e) {
        // En cas d'erreur, on ignore silencieusement
        console.warn("Check time error", e);
      }
    });
    return hasTime;
  }
}