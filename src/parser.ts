import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import getChronos from "./chrono";
import t from "./lang/helper";

import { DayOfWeek } from "./settings";
import {
  getLocaleWeekStart,
  getWeekNumber,
} from "./utils";


// Type alias for Moment from the moment library bundled with Obsidian
// Using the type from the moment library types since moment is bundled with Obsidian
// The moment package is bundled with Obsidian, but the Moment type is not exported from obsidian module
type Moment = import("moment").Moment;

export interface NLDResult {
  formattedString: string;
  date: Date;
  moment: Moment;
}

export interface NLDRangeResult {
  formattedString: string;
  startDate: Date;
  endDate: Date;
  startMoment: Moment;
  endMoment: Moment;
  isRange: true;
  dateList?: Moment[]; // List of all dates in the range
}

export default class NLDParser {
  chronos: Chrono[];
  languages: string[];
  
  // Dynamic regex generated from translations
  regexRelative: RegExp;
  regexRelativeCombined: RegExp; // For "in 2 weeks and 3 days"
  regexWeekday: RegExp;
  regexWeekdayWithTime: RegExp; // For "next Monday at 3pm"
  regexDateRange: RegExp; // For "from Monday to Friday"
  
  // Keywords for all languages
  immediateKeywords: Set<string>;
  prefixKeywords: { this: Set<string>; next: Set<string>; last: Set<string> };
  timeUnitMap: Map<string, 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'>;

  constructor(languages: string[]) {
    this.languages = languages;
    this.chronos = getChronos(languages);
    this.initializeRegex();
    this.initializeKeywords();
  }

  // Initializes dynamic regex from translations
  private initializeRegex(): void {
    // Collect all "in" words for all languages
    const inWords: string[] = [];
    const nextWords: string[] = [];
    const lastWords: string[] = [];
    const thisWords: string[] = [];
    const weekdays: string[] = [];
    
    // Collect time units from all languages
    const timeUnits: string[] = [];

    for (const lang of this.languages) {
      // Collect "in"
      const inWord = t("in", lang);
      if (inWord && inWord !== "NOTFOUND") {
        inWords.push(...inWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      // Collect "next", "last", "this"
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWords.push(...nextWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWords.push(...lastWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const thisWord = t("this", lang);
      if (thisWord && thisWord !== "NOTFOUND") {
        thisWords.push(...thisWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      // Collect weekdays
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of days) {
        const dayWord = t(day, lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          weekdays.push(dayWord.toLowerCase());
        }
      }
      
      // Collect time units
      const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
      for (const unitKey of timeUnitKeys) {
        const unitWord = t(unitKey, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          timeUnits.push(...unitWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }
    }

    // Collecter les mots "and", "at", "from" et "to" pour toutes les langues
    const andWords: string[] = [];
    const atWords: string[] = [];
    const fromWords: string[] = [];
    const toWords: string[] = [];
    
    for (const lang of this.languages) {
      const andWord = t("and", lang);
      if (andWord && andWord !== "NOTFOUND") {
        andWords.push(...andWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const atWord = t("at", lang);
      if (atWord && atWord !== "NOTFOUND") {
        atWords.push(...atWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const fromWord = t("from", lang);
      if (fromWord && fromWord !== "NOTFOUND") {
        fromWords.push(...fromWord.split("|").map(w => w.trim()).filter(w => w));
      }
      
      const toWord = t("to", lang);
      if (toWord && toWord !== "NOTFOUND") {
        toWords.push(...toWord.split("|").map(w => w.trim()).filter(w => w));
      }
    }

    // Create regex with special character escaping
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inPattern = [...new Set(inWords.map(escapeRegex))].join('|');
    const prefixPattern = [...new Set([...thisWords, ...nextWords, ...lastWords].map(escapeRegex))].join('|');
    const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
    const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
    const andPattern = [...new Set(andWords.map(escapeRegex))].join('|');
    const atPattern = [...new Set(atWords.map(escapeRegex))].join('|');
    const fromPattern = [...new Set(fromWords.map(escapeRegex))].join('|');
    const toPattern = [...new Set(toWords.map(escapeRegex))].join('|');

    // Simple regex for "in 2 minutes"
    this.regexRelative = new RegExp(
      `^\\s*(?:${inPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s*$`,
      'i'
    );

    // Regex for combinations "in 2 weeks and 3 days"
    this.regexRelativeCombined = new RegExp(
      `^\\s*(?:${inPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s+(?:${andPattern})\\s+(\\d+)\\s*(${timeUnitPattern})\\s*$`,
      'i'
    );

    // Simple regex for "next Monday"
    this.regexWeekday = new RegExp(
      `^\\s*(${prefixPattern})\\s+(${weekdayPattern})\\s*$`,
      'i'
    );

    // Regex for "next Monday at 3pm" - captures day and time
    this.regexWeekdayWithTime = new RegExp(
      `^\\s*(${prefixPattern})\\s+(${weekdayPattern})\\s+(?:${atPattern})\\s+(.+)$`,
      'i'
    );

    // Regex for "from Monday to Friday" - captures two weekdays
    this.regexDateRange = new RegExp(
      `^\\s*(?:${fromPattern})\\s+(${weekdayPattern})\\s+(?:${toPattern})\\s+(${weekdayPattern})\\s*$`,
      'i'
    );
  }

  // Initializes keywords for fast detection
  private initializeKeywords(): void {
    this.immediateKeywords = new Set();
    this.prefixKeywords = {
      this: new Set(),
      next: new Set(),
      last: new Set(),
    };
    this.timeUnitMap = new Map();

    for (const lang of this.languages) {
      // Immediate keywords
      ['now', 'today', 'tomorrow', 'yesterday'].forEach(key => {
        const word = t(key, lang);
        if (word && word !== "NOTFOUND") {
          this.immediateKeywords.add(word.toLowerCase());
        }
      });

      // Prefixes
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWord.split("|").forEach(w => this.prefixKeywords.next.add(w.trim().toLowerCase()));
      }
      
      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWord.split("|").forEach(w => this.prefixKeywords.last.add(w.trim().toLowerCase()));
      }
      
      const thisWord = t("this", lang);
      if (thisWord && thisWord !== "NOTFOUND") {
        thisWord.split("|").forEach(w => this.prefixKeywords.this.add(w.trim().toLowerCase()));
      }
      
      // Time units with mapping to Moment.js units
      const unitMappings: { key: string; momentUnit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' }[] = [
        { key: 'minute', momentUnit: 'minutes' },
        { key: 'hour', momentUnit: 'hours' },
        { key: 'day', momentUnit: 'days' },
        { key: 'week', momentUnit: 'weeks' },
        { key: 'month', momentUnit: 'months' },
        { key: 'year', momentUnit: 'years' },
      ];
      
      for (const mapping of unitMappings) {
        const unitWord = t(mapping.key, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          unitWord.split("|").forEach(w => {
            const trimmed = w.trim().toLowerCase();
            if (trimmed) {
              this.timeUnitMap.set(trimmed, mapping.momentUnit);
            }
          });
        }
      }
    }
  }

  // --- UTILITY FUNCTION: DAY NAME → NUMERIC INDEX CONVERSION ---
  // Converts day names from all languages to numeric indices (0-6)
  // Moment.js uses: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  private getDayOfWeekIndex(dayName: string): number {
    const normalized = dayName.toLowerCase();
    
    // Mapping of day names to indices (0=Sunday, 1=Monday, etc.)
    const dayMap: { [key: string]: number } = {
      // English
      'sunday': 0, 'sun': 0,
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2, 'tues': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6,
    };
    
    // Add days from all enabled languages
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayKeys.length; i++) {
      for (const lang of this.languages) {
        const dayWord = t(dayKeys[i], lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          dayMap[dayWord.toLowerCase()] = i;
        }
      }
    }
    
    return dayMap[normalized] ?? 0; // Default to Sunday if not recognized
  }

  // --- MAIN ENGINE ---
  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    const text = selectedText.toLowerCase().trim();

    // ============================================================
    // LEVEL 1: IMMEDIATE KEYWORDS (Speed and Precision)
    // ============================================================
    if (this.immediateKeywords.has(text)) {
        // Check "now" in all languages
        for (const lang of this.languages) {
            if (t('now', lang).toLowerCase() === text) {
                return new Date();
            }
        }
        // Check "today" in all languages
        for (const lang of this.languages) {
            if (t('today', lang).toLowerCase() === text) {
                return new Date();
            }
        }
        // Check "tomorrow" in all languages
        for (const lang of this.languages) {
            if (t('tomorrow', lang).toLowerCase() === text) {
                return window.moment().add(1, 'days').toDate();
            }
        }
        // Check "yesterday" in all languages
        for (const lang of this.languages) {
            if (t('yesterday', lang).toLowerCase() === text) {
                return window.moment().subtract(1, 'days').toDate();
            }
        }
    }

    // ============================================================
    // LEVEL 2: RELATIVE CALCULATION (in 2 minutes, in 1 year...)
    // ============================================================
    // First check combinations "in 2 weeks and 3 days"
    const relCombinedMatch = selectedText.match(this.regexRelativeCombined);
    if (relCombinedMatch) {
        const value1 = parseInt(relCombinedMatch[1]);
        const unitStr1 = relCombinedMatch[2].toLowerCase().trim();
        const value2 = parseInt(relCombinedMatch[3]);
        const unitStr2 = relCombinedMatch[4].toLowerCase().trim();
        
        // Look up units in translation mapping
        let unit1: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        let unit2: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (this.timeUnitMap.has(unitStr1)) {
            unit1 = this.timeUnitMap.get(unitStr1)!;
        } else {
            // Fallback for common abbreviations
            if (unitStr1.startsWith('h')) unit1 = 'hours';
            else if (unitStr1.startsWith('d') || unitStr1.startsWith('j')) unit1 = 'days';
            else if (unitStr1.startsWith('w') || unitStr1.startsWith('s')) unit1 = 'weeks';
            else if (unitStr1 === 'm' || unitStr1.startsWith('min')) unit1 = 'minutes';
            else if (unitStr1.startsWith('mo') || unitStr1 === 'M' || unitStr1.startsWith('mois')) unit1 = 'months';
            else if (unitStr1.startsWith('y') || unitStr1.startsWith('a')) unit1 = 'years';
        }
        
        if (this.timeUnitMap.has(unitStr2)) {
            unit2 = this.timeUnitMap.get(unitStr2)!;
        } else {
            // Fallback for common abbreviations
            if (unitStr2.startsWith('h')) unit2 = 'hours';
            else if (unitStr2.startsWith('d') || unitStr2.startsWith('j')) unit2 = 'days';
            else if (unitStr2.startsWith('w') || unitStr2.startsWith('s')) unit2 = 'weeks';
            else if (unitStr2 === 'm' || unitStr2.startsWith('min')) unit2 = 'minutes';
            else if (unitStr2.startsWith('mo') || unitStr2 === 'M' || unitStr2.startsWith('mois')) unit2 = 'months';
            else if (unitStr2.startsWith('y') || unitStr2.startsWith('a')) unit2 = 'years';
        }

        // Add the two durations
        const resultDate = window.moment().add(value1, unit1).add(value2, unit2).toDate();
        return resultDate;
    }
    
    // Then check simple expressions "in 2 minutes"
    const relMatch = selectedText.match(this.regexRelative);
    if (relMatch) {
        const value = parseInt(relMatch[1]);
        const unitStr = relMatch[2].toLowerCase().trim();
        
        // Look up unit in translation mapping
        let unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'minutes';
        
        if (this.timeUnitMap.has(unitStr)) {
            unit = this.timeUnitMap.get(unitStr)!;
        } else {
            // Fallback for common abbreviations if not found in translations
            if (unitStr.startsWith('h')) unit = 'hours';
            else if (unitStr.startsWith('d') || unitStr.startsWith('j')) unit = 'days';
            else if (unitStr.startsWith('w') || unitStr.startsWith('s')) unit = 'weeks';
            else if (unitStr === 'm' || unitStr.startsWith('min')) unit = 'minutes';
            else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) unit = 'months';
            else if (unitStr.startsWith('y') || unitStr.startsWith('a')) unit = 'years';
        }

        // MomentJS handles year transitions perfectly
        return window.moment().add(value, unit).toDate();
    }

    // ============================================================
    // LEVEL 2.5: DATE RANGES (from Monday to Friday)
    // ============================================================
    // Check "from Monday to Friday"
    const rangeMatch = selectedText.match(this.regexDateRange);
    if (rangeMatch) {
        const startDayName = rangeMatch[1].toLowerCase();
        const endDayName = rangeMatch[2].toLowerCase();
        
        const m = window.moment();
        const startDayIndex = this.getDayOfWeekIndex(startDayName);
        const endDayIndex = this.getDayOfWeekIndex(endDayName);
        
        // Find next start day
        let startMoment = window.moment().day(startDayIndex);
        if (startMoment.isBefore(m, 'day')) {
            startMoment.add(1, 'week');
        }
        
        // Find next end day (can be in same week or next)
        let endMoment = window.moment().day(endDayIndex);
        if (endMoment.isBefore(startMoment, 'day')) {
            endMoment.add(1, 'week');
        }
        
        // Return start date (for compatibility, but should use getParsedDateRange)
        return startMoment.toDate();
    }

    // ============================================================
    // LEVEL 3: WEEKDAYS (next friday...)
    // ============================================================
    // First check "next Monday at 3pm"
    const weekWithTimeMatch = selectedText.match(this.regexWeekdayWithTime);
    if (weekWithTimeMatch) {
        const prefix = weekWithTimeMatch[1].toLowerCase();
        const dayName = weekWithTimeMatch[2].toLowerCase();
        const timePart = weekWithTimeMatch[3].trim();
        
        const m = window.moment();
        
        // Convert day name to numeric index to avoid locale issues
        const dayIndex = this.getDayOfWeekIndex(dayName);
        
        if (this.prefixKeywords.this.has(prefix)) {
            m.day(dayIndex);
        } else if (this.prefixKeywords.next.has(prefix)) {
            m.add(1, 'weeks').day(dayIndex);
        } else if (this.prefixKeywords.last.has(prefix)) {
            m.subtract(1, 'weeks').day(dayIndex);
        }
        
        // Parse time with chrono-node
        const timeResult = this.getParsedDateResult(timePart, m.toDate());
        if (timeResult) {
            return timeResult;
        }
        
        // If time parsing fails, return just the date
        return m.toDate();
    }
    
    // Then check simple expressions "next Monday"
    const weekMatch = selectedText.match(this.regexWeekday);
    if (weekMatch) {
        const prefix = weekMatch[1].toLowerCase();
        const dayName = weekMatch[2].toLowerCase();
        
        const m = window.moment();
        
        // Convert day name to numeric index to avoid locale issues
        const dayIndex = this.getDayOfWeekIndex(dayName);
        
        if (this.prefixKeywords.this.has(prefix)) {
            m.day(dayIndex);
        } else if (this.prefixKeywords.next.has(prefix)) {
            m.add(1, 'weeks').day(dayIndex);
        } else if (this.prefixKeywords.last.has(prefix)) {
            m.subtract(1, 'weeks').day(dayIndex);
        }
        return m.toDate();
    }

    // ============================================================
    // LEVEL 4: THE REST (Chrono-node Library + Fallback)
    // ============================================================
    if (!this.chronos || this.chronos.length === 0) return new Date();
    
    // We use the "Best Score" technique to choose between EN and FR
    const initialParse = this.getParsedResult(selectedText);
    if (!initialParse || initialParse.length === 0) {
        // Ultimate safety: if nothing is understood, return today
        return new Date();
    }

    // -- Handling "Next Month" / "Next Year" generic cases (not handled by Regex) --
    // Note: "Next Week" is now handled by getParsedDateRange to generate a date list
    // Create a pattern for "next" in all languages
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const nextDateMatch = selectedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = new Date();

    if (nextDateMatch) {
        const period = nextDateMatch[2].toLowerCase();
        // Check if it's "week" - if yes, let getParsedDateRange handle it
        let isNextWeek = false;
        for (const lang of this.languages) {
            if (period === t('week', lang).toLowerCase()) {
                isNextWeek = true;
                break;
            }
        }
        // If it's "next week", let getParsedDateRange handle it
        if (isNextWeek) {
            // Continue with standard parsing which will fail, allowing getParsedDateRange to take over
        } else {
            // Check if it's "month" or "year" in all languages
            for (const lang of this.languages) {
                if (period === t('month', lang).toLowerCase()) {
                    // Next month -> 1st of next month
                    return window.moment().add(1, 'months').startOf('month').toDate();
                }
                if (period === t('year', lang).toLowerCase()) {
                    // Next year -> January 1st of next year
                    return window.moment().add(1, 'years').startOf('year').toDate();
                }
            }
        }
    }

    // Standard library call with forced forwardDate
    const chronoResult = this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as ParsingOption);
    return chronoResult;
  }

  // --- METHOD FOR PARSING DATE RANGES ---
  getParsedDateRange(selectedText: string, weekStartPreference: DayOfWeek): NLDRangeResult | null {
    const text = selectedText.toLowerCase().trim();
    
    // Check "from Monday to Friday"
    const rangeMatch = selectedText.match(this.regexDateRange);
    if (rangeMatch) {
      const startDayName = rangeMatch[1].toLowerCase();
      const endDayName = rangeMatch[2].toLowerCase();
      
      const m = window.moment();
      const startDayIndex = this.getDayOfWeekIndex(startDayName);
      const endDayIndex = this.getDayOfWeekIndex(endDayName);
      
      // Find next start day
      let startMoment = window.moment().day(startDayIndex);
      if (startMoment.isBefore(m, 'day')) {
        startMoment.add(1, 'week');
      }
      
      // Find next end day (must be after or equal to start day)
      let endMoment = window.moment().day(endDayIndex);
      // If end day is before start day, take the one from next week
      if (endMoment.isBefore(startMoment, 'day')) {
        endMoment.add(1, 'week');
      }
      // Ensure endMoment is always after or equal to startMoment
      if (endMoment.isBefore(startMoment, 'day')) {
        endMoment = startMoment.clone().add(1, 'week').day(endDayIndex);
      }
      
      const format = "YYYY-MM-DD";
      const startFormatted = startMoment.format(format);
      const endFormatted = endMoment.format(format);
      
      // Generate list of all dates in range
      const dateList: Moment[] = [];
      let currentMoment = startMoment.clone();
      while (currentMoment.isSameOrBefore(endMoment, 'day')) {
        dateList.push(currentMoment.clone());
        currentMoment.add(1, 'day');
      }
      
      const result: NLDRangeResult = {
        formattedString: `${startFormatted} to ${endFormatted}`,
        startDate: startMoment.toDate(),
        endDate: endMoment.toDate(),
        startMoment: startMoment.clone(),
        endMoment: endMoment.clone(),
        isRange: true as const,
        dateList: dateList,
      };
      return result;
    }
    
    // Check "next week" as range
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const nextWeekMatch = selectedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));
    if (nextWeekMatch) {
      const period = nextWeekMatch[2].toLowerCase();
      for (const lang of this.languages) {
        if (period === t('week', lang).toLowerCase()) {
          // Next week -> return from Monday to Sunday of next week
          const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
          const weekStartIndex = this.getDayOfWeekIndex(String(weekStart));
          
          const startMoment = window.moment().add(1, 'weeks').day(weekStartIndex);
          const endMoment = startMoment.clone().add(6, 'days');
          
          const format = "YYYY-MM-DD";
          const startFormatted = startMoment.format(format);
          const endFormatted = endMoment.format(format);
          
          // Generate list of all dates in range
          const dateList: Moment[] = [];
          let currentMoment = startMoment.clone();
          while (currentMoment.isSameOrBefore(endMoment, 'day')) {
            dateList.push(currentMoment.clone());
            currentMoment.add(1, 'day');
          }
          
          const result: NLDRangeResult = {
            formattedString: `${startFormatted} to ${endFormatted}`,
            startDate: startMoment.toDate(),
            endDate: endMoment.toDate(),
            startMoment: startMoment.clone(),
            endMoment: endMoment.clone(),
            isRange: true as const,
            dateList: dateList,
          };
          return result;
        }
      }
    }
    
    return null;
  }

  // --- UTILITY FUNCTION: WHO HAS THE BEST SCORE? ---
  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();
    let bestResult: ParsedResult | null = null;
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
      } catch (e) { console.warn(e); }
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
      } catch (e) { console.warn(e); }
    }
    return bestResults;
  }

  // --- TIME DETECTION (FOR DISPLAY) ---
  hasTimeComponent(text: string): boolean {
    // 1. If it's "now" in any language, YES.
    const nowWords = Array.from(this.immediateKeywords).filter(w => 
      this.languages.some(lang => t('now', lang).toLowerCase() === w)
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
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return false;
  }
}