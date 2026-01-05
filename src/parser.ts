import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import getChronos from "./chrono";
import t from "./lang/helper";
import { logger } from "./logger";
import { ErrorCodes } from "./errors";
import { TimeDetector, TimeDetectorDependencies } from "./time-detector";
import { LRUCache } from "./lru-cache";

import { DayOfWeek } from "./settings";
import {
  getLocaleWeekStart,
  getWeekNumber,
} from "./utils";


// Type alias for Moment from the moment library bundled with Obsidian
// Using the type from the moment library types since moment is bundled with Obsidian
// The moment package is bundled with Obsidian, but the Moment type is not exported from obsidian module
type Moment = import("moment").Moment;

/**
 * Result object returned by date parsing methods.
 * Contains the parsed date in multiple formats for convenience.
 * 
 * @example
 * ```typescript
 * const result = plugin.parseDate("tomorrow");
 * console.log(result.formattedString); // "2025-01-06"
 * console.log(result.date); // Date object
 * console.log(result.moment.format("dddd")); // "Monday"
 * ```
 */
export interface NLDResult {
  /** Formatted date string according to the specified format */
  formattedString: string;
  /** Native JavaScript Date object */
  date: Date;
  /** Moment.js object for advanced date manipulation */
  moment: Moment;
}

/**
 * Result object returned by date range parsing methods.
 * Contains the start and end dates of a parsed range, plus a list of all dates in the range.
 * 
 * @example
 * ```typescript
 * const range = plugin.parseDateRange("from Monday to Friday");
 * if (range) {
 *   console.log(range.startDate); // Date object for Monday
 *   console.log(range.endDate); // Date object for Friday
 *   console.log(range.dateList?.length); // 5 (Monday through Friday)
 * }
 * ```
 */
export interface NLDRangeResult {
  /** Formatted range string (e.g., "2025-01-06 to 2025-01-10") */
  formattedString: string;
  /** Start date of the range as a native Date object */
  startDate: Date;
  /** End date of the range as a native Date object */
  endDate: Date;
  /** Start date as a Moment.js object */
  startMoment: Moment;
  /** End date as a Moment.js object */
  endMoment: Moment;
  /** Always true for range results */
  isRange: true;
  /** Optional list of all dates in the range as Moment objects */
  dateList?: Moment[];
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
  
  // Cache for parsed dates (LRU avec limite de 500 entrées)
  private cache: LRUCache<string, Date>;
  private cacheDay: number; // Day of year for cache invalidation
  private readonly MAX_CACHE_SIZE = 500;
  
  // Time detector
  private timeDetector: TimeDetector;

  constructor(languages: string[]) {
    this.languages = languages;
    this.chronos = getChronos(languages);
    this.initializeRegex();
    this.initializeKeywords();
    this.cache = new LRUCache<string, Date>(this.MAX_CACHE_SIZE);
    this.cacheDay = this.getDayOfYear();
    
    // Initialize time detector
    this.timeDetector = new TimeDetector({
      languages: this.languages,
      chronos: this.chronos,
      immediateKeywords: this.immediateKeywords,
      regexRelative: this.regexRelative,
      regexRelativeCombined: this.regexRelativeCombined,
      regexWeekday: this.regexWeekday,
      regexWeekdayWithTime: this.regexWeekdayWithTime,
    });
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
      
      // Ajouter les abréviations communes (pour l'anglais principalement)
      if (lang === 'en') {
        weekdays.push('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
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

  // --- CACHE UTILITIES ---
  // Get day of year (1-365/366) for cache invalidation
  private getDayOfYear(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Generate cache key from selectedText, weekStartPreference, and current day
  private generateCacheKey(selectedText: string, weekStartPreference: DayOfWeek): string {
    const currentDay = this.getDayOfYear();
    // Include day in key to automatically invalidate cache when day changes
    return `${selectedText.trim()}|${weekStartPreference}|${currentDay}`;
  }

  // Store result in cache and return it
  private cacheAndReturn(cacheKey: string, result: Date): Date {
    // Créer une nouvelle instance de Date pour éviter les références partagées
    const cachedDate = new Date(result.getTime());
    this.cache.set(cacheKey, cachedDate);
    return new Date(result.getTime());
  }

  // --- MAIN ENGINE ---
  /**
   * Parses a natural language date string and returns a Date object.
   * 
   * Supports multiple languages and various date expressions:
   * - Immediate dates: "today", "tomorrow", "yesterday", "now"
   * - Relative dates: "in 2 days", "in 3 weeks", "in 1 month"
   * - Combined durations: "in 2 weeks and 3 days"
   * - Weekdays: "next Monday", "last Friday", "this Wednesday"
   * - Weekdays with time: "next Monday at 3pm"
   * - Periods: "next week", "next month", "next year"
   * 
   * @param selectedText - Natural language date string to parse (e.g., "tomorrow", "in 2 days", "next Monday")
   * @param weekStartPreference - Day of week to consider as week start (affects "next week" calculations)
   * @returns Parsed Date object, or current date if parsing fails
   * 
   * @example
   * ```typescript
   * const parser = new NLDParser(['en', 'fr']);
   * const date = parser.getParsedDate("tomorrow", "monday");
   * console.log(date); // Date object for tomorrow
   * ```
   */
  getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date {
    // Vérifier si le jour a changé pour invalider le cache
    const currentDay = this.getDayOfYear();
    if (currentDay !== this.cacheDay) {
      this.cache.clear();
      this.cacheDay = currentDay;
    }

    // Nettoyer les caractères spéciaux en fin de chaîne (ex: "tomorrow!!!")
    const cleanedText = selectedText.trim().replace(/[!?.]+$/, '');
    
    // Générer la clé du cache avec le texte nettoyé pour que "tomorrow" et "tomorrow!!!" utilisent la même clé
    const cacheKey = this.generateCacheKey(cleanedText, weekStartPreference);
    
    // Vérifier le cache avant de parser
    if (this.cache.has(cacheKey)) {
      const cachedDate = this.cache.get(cacheKey)!;
      // Créer une nouvelle instance de Date pour éviter les références partagées
      return new Date(cachedDate.getTime());
    }

    const text = cleanedText.toLowerCase();

    // ============================================================
    // LEVEL 1: IMMEDIATE KEYWORDS (Speed and Precision)
    // ============================================================
    if (this.immediateKeywords.has(text)) {
        // Check "now" in all languages
        for (const lang of this.languages) {
            if (t('now', lang).toLowerCase() === text) {
                return this.cacheAndReturn(cacheKey, new Date());
            }
        }
        // Check "today" in all languages
        for (const lang of this.languages) {
            if (t('today', lang).toLowerCase() === text) {
                return this.cacheAndReturn(cacheKey, new Date());
            }
        }
        // Check "tomorrow" in all languages
        for (const lang of this.languages) {
            if (t('tomorrow', lang).toLowerCase() === text) {
                return this.cacheAndReturn(cacheKey, window.moment().add(1, 'days').toDate());
            }
        }
        // Check "yesterday" in all languages
        for (const lang of this.languages) {
            if (t('yesterday', lang).toLowerCase() === text) {
                return this.cacheAndReturn(cacheKey, window.moment().subtract(1, 'days').toDate());
            }
        }
    }

    // ============================================================
    // LEVEL 1.5: PAST EXPRESSIONS (2 days ago)
    // ============================================================
    // Check for "ago" expressions (e.g., "2 days ago")
    const agoMatch = text.match(/^(\d+)\s+(\w+)\s+ago$/i);
    if (agoMatch) {
        const value = parseInt(agoMatch[1]);
        const unitStr = agoMatch[2].toLowerCase().trim();
        
        let unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'days';
        
        if (this.timeUnitMap.has(unitStr)) {
            unit = this.timeUnitMap.get(unitStr)!;
        } else {
            // Fallback for common abbreviations
            if (unitStr.startsWith('h')) unit = 'hours';
            else if (unitStr.startsWith('d') || unitStr.startsWith('j')) unit = 'days';
            else if (unitStr.startsWith('w') || unitStr.startsWith('s')) unit = 'weeks';
            else if (unitStr === 'm' || unitStr.startsWith('min')) unit = 'minutes';
            else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) unit = 'months';
            else if (unitStr.startsWith('y') || unitStr.startsWith('a')) unit = 'years';
        }
        
        return this.cacheAndReturn(cacheKey, window.moment().subtract(value, unit).toDate());
    }

    // ============================================================
    // LEVEL 2: RELATIVE CALCULATION (in 2 minutes, in 1 year...)
    // ============================================================
    // Helper function to get unit type
    const getUnit = (unitStr: string): 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' => {
        if (this.timeUnitMap.has(unitStr)) {
            return this.timeUnitMap.get(unitStr)!;
        }
        // Fallback for common abbreviations
        if (unitStr.startsWith('h')) return 'hours';
        else if (unitStr.startsWith('d') || unitStr.startsWith('j')) return 'days';
        else if (unitStr.startsWith('w') || unitStr.startsWith('s')) return 'weeks';
        else if (unitStr === 'm' || unitStr.startsWith('min')) return 'minutes';
        else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) return 'months';
        else if (unitStr.startsWith('y') || unitStr.startsWith('a')) return 'years';
        return 'days';
    };
    
    // First check combinations "in 2 weeks and 3 days" or multiple combinations
    // Try to parse multiple combinations like "in 1 year and 2 months and 3 weeks and 4 days"
    const multiUnitPattern = /(\d+)\s+(\w+)(?:\s+and\s+(\d+)\s+(\w+))+/gi;
    let multiMatch;
    let hasMultiUnits = false;
    let totalMoment = window.moment();
    
    // Check for multiple units pattern (3+ units)
    const testText = cleanedText;
    const allMatches: Array<{value: number, unit: string}> = [];
    let match;
    
    // Try to match all "X unit" patterns after "in"
    const inPatterns = Array.from(new Set(this.languages.map(l => t("in", l)).filter(v => v !== "NOTFOUND").flatMap(v => v.split("|"))));
    const andPatterns = Array.from(new Set(this.languages.map(l => t("and", l)).filter(v => v !== "NOTFOUND").flatMap(v => v.split("|"))));
    
    const inRegex = new RegExp(`^(${inPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+`, 'i');
    const andRegex = new RegExp(`\\s+(${andPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+`, 'gi');
    
    if (testText.match(inRegex)) {
        const withoutIn = testText.replace(inRegex, '');
        const parts = withoutIn.split(andRegex).filter(p => p && !andPatterns.some(a => a.toLowerCase() === p.trim().toLowerCase()));
        
        if (parts.length >= 2) {
            // Multiple units detected (2 or more)
            for (const part of parts) {
                const unitMatch = part.trim().match(/^(\d+)\s+([^\s]+)$/i);
                if (unitMatch) {
                    const value = parseInt(unitMatch[1]);
                    const unitStr = unitMatch[2].toLowerCase().trim();
                    totalMoment.add(value, getUnit(unitStr));
                    hasMultiUnits = true;
                }
            }
            if (hasMultiUnits) {
                return this.cacheAndReturn(cacheKey, totalMoment.toDate());
            }
        }
    }
    
    // Fallback to original single combination match (2 units)
    const relCombinedMatch = cleanedText.match(this.regexRelativeCombined);
    if (relCombinedMatch) {
        const value1 = parseInt(relCombinedMatch[1]);
        const unitStr1 = relCombinedMatch[2].toLowerCase().trim();
        const value2 = parseInt(relCombinedMatch[3]);
        const unitStr2 = relCombinedMatch[4].toLowerCase().trim();
        
        const unit1 = getUnit(unitStr1);
        const unit2 = getUnit(unitStr2);

        // Add the two durations
        const resultDate = window.moment().add(value1, unit1).add(value2, unit2).toDate();
        return this.cacheAndReturn(cacheKey, resultDate);
    }
    
    // Then check simple expressions "in 2 minutes"
    const relMatch = cleanedText.match(this.regexRelative);
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
        return this.cacheAndReturn(cacheKey, window.moment().add(value, unit).toDate());
    }

    // ============================================================
    // LEVEL 2.5: DATE RANGES (from Monday to Friday)
    // ============================================================
    // Check "from Monday to Friday"
    const rangeMatch = cleanedText.match(this.regexDateRange);
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
        return this.cacheAndReturn(cacheKey, startMoment.toDate());
    }

    // ============================================================
    // LEVEL 3: WEEKDAYS (next friday...)
    // ============================================================
    // First check "next Monday at 3pm"
    const weekWithTimeMatch = cleanedText.match(this.regexWeekdayWithTime);
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
            return this.cacheAndReturn(cacheKey, timeResult);
        }
        
        // If time parsing fails, return just the date
        return this.cacheAndReturn(cacheKey, m.toDate());
    }
    
    // Then check simple expressions "next Monday"
    const weekMatch = cleanedText.match(this.regexWeekday);
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
        return this.cacheAndReturn(cacheKey, m.toDate());
    }

    // ============================================================
    // LEVEL 4: THE REST (Chrono-node Library + Fallback)
    // ============================================================
    // -- Handling "Next Month" / "Next Year" generic cases (not handled by Regex) --
    // Note: "Next Week" is now handled by getParsedDateRange to generate a date list
    // Check this BEFORE calling chrono-node to ensure correct behavior
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const nextDateMatch = cleanedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));

    if (nextDateMatch) {
        const period = nextDateMatch[2].toLowerCase();
        // Check if it's "week" - if yes, let getParsedDateRange handle it
        let isNextWeek = false;
        for (const lang of this.languages) {
            const weekVariants = t('week', lang).toLowerCase().split('|').map(w => w.trim());
            if (weekVariants.includes(period)) {
                isNextWeek = true;
                break;
            }
        }
        // If it's "next week", let getParsedDateRange handle it (continue to chrono-node)
        if (!isNextWeek) {
            // Check if it's "month" or "year" in all languages
            for (const lang of this.languages) {
                const monthVariants = t('month', lang).toLowerCase().split('|').map(w => w.trim());
                if (monthVariants.includes(period)) {
                    // Next month -> 1st of next month
                    return this.cacheAndReturn(cacheKey, window.moment().add(1, 'months').startOf('month').toDate());
                }
                const yearVariants = t('year', lang).toLowerCase().split('|').map(w => w.trim());
                if (yearVariants.includes(period)) {
                    // Next year -> January 1st of next year
                    return this.cacheAndReturn(cacheKey, window.moment().add(1, 'years').startOf('year').toDate());
                }
            }
        }
    }
    
    if (!this.chronos || this.chronos.length === 0) return this.cacheAndReturn(cacheKey, new Date());
    
    // We use the "Best Score" technique to choose between EN and FR
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = new Date();
    
    // Standard library call with forced forwardDate
    const chronoResult = this.getParsedDateResult(selectedText, referenceDate, { 
      locale,
      forwardDate: true 
    } as ParsingOption);
    return this.cacheAndReturn(cacheKey, chronoResult);
  }

  /**
   * Parses a natural language date range string and returns a range result.
   * 
   * Supports various range expressions:
   * - Weekday ranges: "from Monday to Friday"
   * - Week ranges: "next week" (returns all days of next week)
   * - Works in all enabled languages with native translations
   * 
   * @param selectedText - Natural language date range string (e.g., "from Monday to Friday", "next week")
   * @param weekStartPreference - Day of week to consider as week start
   * @returns NLDRangeResult object with start/end dates and date list, or null if not a range
   * 
   * @example
   * ```typescript
   * const parser = new NLDParser(['en', 'fr']);
   * const range = parser.getParsedDateRange("from Monday to Friday", "monday");
   * if (range) {
   *   console.log(range.dateList?.length); // 5 (Monday through Friday)
   * }
   * ```
   */
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
    
    // Check "next week" as range (both "next week" and "week next" for languages like French)
    const nextPattern = Array.from(this.prefixKeywords.next).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    // First try "next week" pattern
    let nextWeekMatch = selectedText.match(new RegExp(`(${nextPattern})\\s+([\\w]+)`, 'i'));
    let periodIndex = 2; // Index of period in match array
    if (!nextWeekMatch) {
      // Try reverse pattern "week next" for languages like French
      for (const lang of this.languages) {
        const weekVariants = t('week', lang).toLowerCase().split('|').map(w => w.trim());
        const weekPattern = weekVariants.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        nextWeekMatch = selectedText.match(new RegExp(`(${weekPattern})\\s+(${nextPattern})`, 'i'));
        if (nextWeekMatch) {
          periodIndex = 1; // Period is now at index 1
          break;
        }
      }
    }
    if (nextWeekMatch) {
      const period = nextWeekMatch[periodIndex].toLowerCase();
      for (const lang of this.languages) {
        const weekVariants = t('week', lang).toLowerCase().split('|').map(w => w.trim());
        if (weekVariants.includes(period)) {
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
      } catch (e) {
        logger.warn('Chrono parsing error in getParsedDateResult', {
          text,
          error: e instanceof Error ? e.message : String(e),
        });
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
        logger.warn('Chrono parsing error in getParsedResult', {
          text,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return bestResults;
  }

  // --- TIME DETECTION (FOR DISPLAY) ---
  /**
   * Checks if a text string contains a time component.
   * 
   * Detects various time expressions:
   * - Explicit times: "at 3pm", "at 15:00", "à 15h"
   * - Time in relative expressions: "in 2 hours", "dans 2 heures"
   * - Works with all enabled languages
   * 
   * @param text - Text string to check for time component
   * @returns true if a time component is detected, false otherwise
   * 
   * @example
   * ```typescript
   * const parser = new NLDParser(['en', 'fr']);
   * parser.hasTimeComponent("next Monday at 3pm"); // true
   * parser.hasTimeComponent("tomorrow"); // false
   * parser.hasTimeComponent("in 2 hours"); // true
   * ```
   */
  hasTimeComponent(text: string): boolean {
    return this.timeDetector.hasTimeComponent(text);
  }

  // --- CACHE STATISTICS (FOR MONITORING) ---
  /**
   * Retourne les statistiques du cache de parsing
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.maxSizeLimit,
    };
  }
}