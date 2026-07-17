import { Chrono, ParsedResult, ParsingOption } from "chrono-node";
import getChronos from "./chrono";
import { logger } from "./logger";
import { TimeDetector } from "./time-detector";
import { LRUCache } from "./lru-cache";
import { TranslationCollector } from "./translation-collector";
import moment from "./window-moment";

import { DayOfWeek } from "./settings";
import {
  getLocaleWeekStart,
  getWeekNumber,
  ORDINAL_NUMBER_PATTERN,
  parseOrdinalNumberPattern,
  describeError,
} from "./utils";


// Type alias for Moment from the moment library bundled with Obsidian
// Using the type from the moment library types since moment is bundled with Obsidian
// The moment package is bundled with Obsidian, but the Moment type is not exported from obsidian module
type Moment = import("moment").Moment;

type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

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
  regexWeekdayOnly: RegExp; // For "wednesday" (without prefix)
  regexDateRange: RegExp; // For "from Monday to Friday"
  regexOrdinalOfMonth: RegExp; // For "the 15th of next month"
  regexLastDayOfMonth: RegExp; // For "last day of month"
  regexWeekdayOfMonth: RegExp; // For "first Monday of month"
  // For suffix languages that put the quantifier/unit before the "later" marker
  // instead of an "in" prefix (e.g. Chinese "2天後" = "2 days" + "後" = "later").
  regexRelativeSuffix: RegExp | null;
  regexRelativeCombinedSuffix: RegExp | null; // For "2週和3天後" (2 weeks and 3 days later)
  // Mirror of regexRelativeSuffix for the PAST direction (e.g. Portuguese
  // "3 dias atrás" = "3 days" + "atrás" = "ago").
  regexAgoSuffix: RegExp | null;
  
  // Keywords for all languages
  immediateKeywords: Set<string>;
  prefixKeywords: { this: Set<string>; next: Set<string>; last: Set<string> };
  timeUnitMap: Map<string, TimeUnit>;
  
  // Cache for parsed dates (LRU avec limite de 500 entrées)
  private cache: LRUCache<string, Date>;
  private cacheDay: number; // Day of year for cache invalidation
  private readonly MAX_CACHE_SIZE = 500;
  
  // Collects/caches translations across all active languages and builds
  // regex alternations from them (see translation-collector.ts)
  private tc: TranslationCollector;

  // Time detector
  private timeDetector: TimeDetector;

  constructor(languages: string[]) {
    this.languages = languages;
    this.chronos = getChronos(languages);
    this.tc = new TranslationCollector(languages);
    this.initializeRegex();
    this.initializeKeywords();
    this.cache = new LRUCache<string, Date>(this.MAX_CACHE_SIZE);
    this.cacheDay = this.getDayOfYear();
    
    // Initialize time detector
    this.timeDetector = new TimeDetector({
      languages: this.languages,
      chronos: this.chronos,
      regexRelative: this.regexRelative,
      regexRelativeCombined: this.regexRelativeCombined,
      regexWeekday: this.regexWeekday,
      regexWeekdayWithTime: this.regexWeekdayWithTime,
    });
  }

  // Initializes dynamic regex from translations
  private initializeRegex(): void {
    const inWords = this.tc.collectWords("in");
    const nextWords = this.tc.collectWords("next");
    const lastWords = this.tc.collectWords("last");
    const thisWords = this.tc.collectWords("this");
    const andWords = this.tc.collectWords("and");
    const atWords = this.tc.collectWords("at");
    const fromWords = this.tc.collectWords("from");
    const toWords = this.tc.collectWords("to");

    // Collect weekdays (lowercased) across all languages, plus the common
    // English abbreviations (mon/tue/...) which aren't part of the dictionary.
    const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdays = weekdayKeys.flatMap(key => this.tc.collectWords(key, { lowercase: true }));
    if (this.languages.includes('en')) {
      weekdays.push('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
    }

    // Collect time units (minute/hour/day/week/month/year) across all languages
    const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
    const timeUnits = timeUnitKeys.flatMap(key => this.tc.collectWords(key));

    const inPattern = this.tc.buildAlternation(inWords);
    const prefixPattern = this.tc.buildAlternation([...thisWords, ...nextWords, ...lastWords]);
    const weekdayPattern = this.tc.buildAlternation(weekdays);
    const timeUnitPattern = this.tc.buildAlternation(timeUnits);
    const andPattern = this.tc.buildAlternation(andWords);
    const atPattern = this.tc.buildAlternation(atWords);
    const fromPattern = this.tc.buildAlternation(fromWords);
    const toPattern = this.tc.buildAlternation(toWords);

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
    // Uses \s* (not \s+) between prefix and weekday so languages without spaces
    // between words (e.g. Chinese "下一個星期一") still match.
    this.regexWeekday = new RegExp(
      `^\\s*(${prefixPattern})\\s*(${weekdayPattern})\\s*$`,
      'i'
    );

    // Regex for "next Monday at 3pm" - captures day and time
    this.regexWeekdayWithTime = new RegExp(
      `^\\s*(${prefixPattern})\\s*(${weekdayPattern})\\s+(?:${atPattern})\\s+(.+)$`,
      'i'
    );

    // Regex for simple weekday without prefix (e.g., "wednesday", "friday")
    this.regexWeekdayOnly = new RegExp(
      `^\\s*(${weekdayPattern})\\s*$`,
      'i'
    );

    // Regex for "from Monday to Friday" - captures two weekdays
    this.regexDateRange = new RegExp(
      `^\\s*(?:${fromPattern})\\s*(${weekdayPattern})\\s*(?:${toPattern})\\s*(${weekdayPattern})\\s*$`,
      'i'
    );

    const ofPattern = this.tc.buildAlternationFor("of");
    const firstPattern = this.tc.buildAlternationFor("first");

    // Regex for "the 15th of next month" or "le 15 du mois prochain"
    // Pattern: (optional "the"/"le"/"der") (ordinal number like "15th", "15ème", "15.") "of"/"du"/"des" (next/last/this) (month)
    // Also handles French inversion: "le 15 du mois prochain" (month before prefix)
    // Also handles German: "der 15. des nächsten Monats" (prefix between "of" and month)
    // Using ORDINAL_NUMBER_PATTERN from utils.ts for ordinal matching
    this.regexOrdinalOfMonth = new RegExp(
      `^\\s*(?:the|le|der|das|el|il|o|de|het)?\\s*(${ORDINAL_NUMBER_PATTERN})\\s+(?:${ofPattern})\\s+(?:(${prefixPattern})\\s+)?(${timeUnitPattern})(?:\\s+(${prefixPattern}))?\\s*$`,
      'i'
    );

    // Regex for "last day of month" or "dernier jour du mois"
    const dayPattern = this.tc.buildAlternationFor("day");

    // Make prefix optional - "last day of month" without prefix means "this month"
    // "last" here is an adjective modifying "day", not a temporal prefix
    // Also handle French inversion: "dernier jour du mois prochain" (month before prefix)
    // Pattern: (optional prefix) "last" (day word) "of" (optional prefix) (month) (optional prefix after month)
    // Reuse lastWords collected above (line 148-150)
    const lastAdjectivePattern = this.tc.buildAlternation(lastWords);
    
    this.regexLastDayOfMonth = new RegExp(
      `^\\s*(?:(${prefixPattern})\\s+)?(${lastAdjectivePattern})\\s+(${dayPattern})\\s+(?:${ofPattern})\\s+(?:(${prefixPattern})\\s+)?(${timeUnitPattern})(?:\\s+(${prefixPattern}))?\\s*$`,
      'i'
    );

    // Regex for "first Monday of month" or "premier lundi du mois" or "last Monday of month"
    // Also handle French inversion: "premier lundi du mois prochain" (month before prefix)
    this.regexWeekdayOfMonth = new RegExp(
      `^\\s*(${firstPattern}|${prefixPattern})\\s+(${weekdayPattern})\\s+(?:${ofPattern})\\s+(?:(${prefixPattern})\\s+)?(${timeUnitPattern})(?:\\s+(${prefixPattern}))?\\s*$`,
      'i'
    );

    // Suffix-style languages (e.g. Chinese "2天後"/"2天后", Japanese "2日後") put
    // the "later" marker after the number and unit instead of using an "in"
    // prefix. Each language can list its marker(s) explicitly under the
    // "later" key (e.g. Chinese "後|后" for both scripts); this key is never
    // used for display/interpolation, only for this matching, so it's safe to
    // list multiple script variants with "|" the same way weekday/prefix words
    // do. The "indays" template itself must stay a single form since it's
    // also used verbatim in autosuggest labels, and templates with
    // %{timeDelta} don't get split on "|" like plain word lists do.
    //
    // Languages that don't define "later" fall back to inferring the marker
    // from their "indays" template (e.g. "%{timeDelta}天後" -> marker "後"),
    // so this still works for any language authored without the extra key.
    const suffixMarkers = new Set<string>();
    for (const lang of this.languages) {
      const laterWord = this.tc.translate('later', lang);
      if (laterWord && laterWord !== 'NOTFOUND') {
        for (const marker of laterWord.split('|').map(w => w.trim()).filter(w => w)) {
          suffixMarkers.add(marker);
        }
        continue;
      }

      const template = this.tc.translate('indays', lang);
      if (!template || template === 'NOTFOUND' || template.indexOf('%{timeDelta}') !== 0) {
        continue;
      }
      const remainder = template.slice('%{timeDelta}'.length);
      const dayWord = this.tc.translate('day', lang);
      if (!dayWord || dayWord === 'NOTFOUND') continue;
      const unitUsed = dayWord.split('|').map(w => w.trim()).filter(w => w).find(v => remainder.startsWith(v));
      if (!unitUsed) continue;
      const marker = remainder.slice(unitUsed.length).trim();
      if (marker) suffixMarkers.add(marker);
    }

    if (suffixMarkers.size > 0) {
      const suffixPattern = this.tc.buildAlternation(Array.from(suffixMarkers));
      this.regexRelativeSuffix = new RegExp(
        `^\\s*(\\d+)\\s*(${timeUnitPattern})\\s*(?:${suffixPattern})\\s*$`,
        'i'
      );
      this.regexRelativeCombinedSuffix = new RegExp(
        `^\\s*(\\d+)\\s*(${timeUnitPattern})\\s*(?:${andPattern})\\s*(\\d+)\\s*(${timeUnitPattern})\\s*(?:${suffixPattern})\\s*$`,
        'i'
      );
    } else {
      this.regexRelativeSuffix = null;
      this.regexRelativeCombinedSuffix = null;
    }

    // Suffix-style PAST languages (e.g. Portuguese "3 dias atrás" = "3 days"
    // + "atrás" = "ago"), the past-direction mirror of the "later" mechanism
    // above. Unlike "later", there's no template to infer this marker from
    // (the daysago template already has its own %{timeDelta}-prefix form, "há
    // %{timeDelta} dias", which doesn't imply a suffix variant also exists),
    // so languages must opt in explicitly via the "agosuffix" key.
    const agoSuffixMarkers = new Set<string>();
    for (const lang of this.languages) {
      const agoSuffixWord = this.tc.translate('agosuffix', lang);
      if (agoSuffixWord && agoSuffixWord !== 'NOTFOUND') {
        for (const marker of agoSuffixWord.split('|').map(w => w.trim()).filter(w => w)) {
          agoSuffixMarkers.add(marker);
        }
      }
    }

    if (agoSuffixMarkers.size > 0) {
      const agoSuffixPattern = this.tc.buildAlternation(Array.from(agoSuffixMarkers));
      this.regexAgoSuffix = new RegExp(
        `^\\s*(\\d+)\\s*(${timeUnitPattern})\\s*(?:${agoSuffixPattern})\\s*$`,
        'i'
      );
    } else {
      this.regexAgoSuffix = null;
    }
  }

  // Initializes keywords for fast detection
  private initializeKeywords(): void {
    this.immediateKeywords = new Set(
      ['now', 'today', 'tomorrow', 'yesterday'].flatMap(key => this.tc.collectWords(key, { lowercase: true }))
    );
    this.prefixKeywords = {
      this: new Set(this.tc.collectWords("this", { lowercase: true })),
      next: new Set(this.tc.collectWords("next", { lowercase: true })),
      last: new Set(this.tc.collectWords("last", { lowercase: true })),
    };

    // Time units with mapping to Moment.js units
    const unitMappings: { key: string; momentUnit: TimeUnit }[] = [
      { key: 'minute', momentUnit: 'minutes' },
      { key: 'hour', momentUnit: 'hours' },
      { key: 'day', momentUnit: 'days' },
      { key: 'week', momentUnit: 'weeks' },
      { key: 'month', momentUnit: 'months' },
      { key: 'year', momentUnit: 'years' },
    ];
    this.timeUnitMap = new Map();
    for (const mapping of unitMappings) {
      for (const word of this.tc.collectWords(mapping.key, { lowercase: true })) {
        this.timeUnitMap.set(word, mapping.momentUnit);
      }
    }
  }

  // --- UTILITY FUNCTION: DAY NAME → NUMERIC INDEX CONVERSION ---
  // Converts day names from all languages to numeric indices (0-6)
  // Moment.js uses: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  private getDayOfWeekIndex(dayName: string): number {
    const normalized = dayName.toLowerCase();

    // English day names/abbreviations, always available regardless of active languages
    const dayMap: { [key: string]: number } = {
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
    dayKeys.forEach((key, i) => {
      for (const variant of this.tc.collectWords(key, { lowercase: true })) {
        dayMap[variant] = i;
      }
    });

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
    // Nettoyer les caractères spéciaux en fin de chaîne (ex: "tomorrow!!!")
    const cleanedText = selectedText.trim().replace(/[!?.]+$/, '');
    const text = cleanedText.toLowerCase();

    // "now"/"today", "X ago", and "in X units" all resolve relative to the
    // exact current instant (not just the current day), so caching them at
    // the cache's day-sized granularity would return a stale time on every
    // call after the first within that day (e.g. "in 20 minutes" or "now"
    // always returning the first result they ever produced that day).
    // Always compute these fresh, bypassing the cache entirely.
    // "tomorrow"/"yesterday" resolve to a specific calendar day like the
    // other cached expressions below, so they stay on the cached path
    // (handled by tryImmediateKeywords further down).
    const nowWords = this.tc.collectWords('now', { lowercase: true });
    const todayWords = this.tc.collectWords('today', { lowercase: true });
    const volatileResult =
      (nowWords.includes(text) || todayWords.includes(text) ? new Date() : null) ??
      this.tryPastExpressions(text, cleanedText) ??
      this.tryRelativeCalculation(cleanedText);
    if (volatileResult) return volatileResult;

    // Vérifier si le jour a changé pour invalider le cache
    const currentDay = this.getDayOfYear();
    if (currentDay !== this.cacheDay) {
      this.cache.clear();
      this.cacheDay = currentDay;
    }

    // Générer la clé du cache avec le texte nettoyé pour que "tomorrow" et "tomorrow!!!" utilisent la même clé
    const cacheKey = this.generateCacheKey(cleanedText, weekStartPreference);

    // Vérifier le cache avant de parser
    const cachedDate = this.cache.get(cacheKey);
    if (cachedDate) {
      // Créer une nouvelle instance de Date pour éviter les références partagées
      return new Date(cachedDate.getTime());
    }

    // Each try*() method below returns null when it doesn't recognize the
    // input, letting the next level have a shot -- same LEVEL 1-4 order this
    // file has always used, just split into named, independently readable
    // methods instead of one function that used to run ~570 lines.
    const result =
      this.tryImmediateKeywords(text) ??
      this.tryDateRangeShortcut(cleanedText) ??
      this.tryWeekdays(cleanedText) ??
      this.tryOrdinalOfMonth(cleanedText) ??
      this.tryLastDayOfMonth(cleanedText) ??
      this.tryWeekdayOfMonth(cleanedText) ??
      this.tryNextPeriodShortcut(cleanedText) ??
      this.chronoFallback(selectedText, weekStartPreference);

    return this.cacheAndReturn(cacheKey, result);
  }

  // ============================================================
  // LEVEL 1: IMMEDIATE KEYWORDS (Speed and Precision)
  // ============================================================
  private tryImmediateKeywords(text: string): Date | null {
    if (!this.immediateKeywords.has(text)) return null;

    if (this.tc.collectWords('now', { lowercase: true }).includes(text)) {
      return new Date();
    }
    if (this.tc.collectWords('today', { lowercase: true }).includes(text)) {
      return new Date();
    }
    if (this.tc.collectWords('tomorrow', { lowercase: true }).includes(text)) {
      return moment().add(1, 'days').toDate();
    }
    if (this.tc.collectWords('yesterday', { lowercase: true }).includes(text)) {
      return moment().subtract(1, 'days').toDate();
    }
    return null;
  }

  // ============================================================
  // LEVEL 1.5: PAST EXPRESSIONS (2 days ago, il y a 3 min)
  // ============================================================
  private tryPastExpressions(text: string, cleanedText: string): Date | null {
    // Check for "ago" expressions in English (e.g., "2 days ago"). Unlike
    // every other unit-capturing regex in this file, this one captures the
    // unit generically (\w+, not restricted to known translated words), so
    // guessUnit()'s abbreviation-guessing fallback is genuinely reachable
    // here for units no enabled language's dictionary recognizes.
    const agoMatch = text.match(/^(\d+)\s+(\w+)\s+ago$/i);
    if (agoMatch) {
      const value = parseInt(agoMatch[1]);
      const unitStr = agoMatch[2].toLowerCase().trim();
      const unit = this.guessUnit(unitStr);
      return moment().subtract(value, unit).toDate();
    }

    // Check for past expressions in all languages (e.g., "il y a 3 minutes", "vor 2 Stunden", etc.)
    for (const lang of this.languages) {
      const minutesAgoPattern = this.tc.translate("minutesago", lang);
      const hoursAgoPattern = this.tc.translate("hoursago", lang);
      const daysAgoPattern = this.tc.translate("daysago", lang);
      const weeksAgoPattern = this.tc.translate("weeksago", lang);
      const monthsAgoPattern = this.tc.translate("monthsago", lang);

      const patterns = [
        { pattern: minutesAgoPattern, unit: 'minutes' as const },
        { pattern: hoursAgoPattern, unit: 'hours' as const },
        { pattern: daysAgoPattern, unit: 'days' as const },
        { pattern: weeksAgoPattern, unit: 'weeks' as const },
        { pattern: monthsAgoPattern, unit: 'months' as const },
      ];

      for (const { pattern, unit } of patterns) {
        const regex = this.buildAgoRegex(pattern);
        if (regex) {
          const match = cleanedText.match(regex);
          if (match) {
            const value = parseInt(match[1]);
            return moment().subtract(value, unit).toDate();
          }
        }
      }
    }

    // Suffix-style past expressions, e.g. Portuguese "3 dias atrás" (3 days ago)
    const agoSuffixMatch = this.regexAgoSuffix ? cleanedText.match(this.regexAgoSuffix) : null;
    if (agoSuffixMatch) {
      const value = parseInt(agoSuffixMatch[1]);
      const unitStr = agoSuffixMatch[2].toLowerCase().trim();
      const unit = this.guessUnit(unitStr);
      return moment().subtract(value, unit).toDate();
    }

    return null;
  }

  // Converts an "X ago" translation template into a matching regex.
  // Example: "il y a %{timeDelta} minutes" -> "il y a (\d+) minutes"
  // Example: "через %{timeDelta} минут|минуту|минуты назад" (Russian
  // grammatical forms) -> "через (\d+) (?:минут|минуту|минуты) назад"
  // Example: "%{timeDelta}天前" (Chinese, no spaces) -> "(\d+)天前"
  private buildAgoRegex(pattern: string): RegExp | null {
    if (!pattern || pattern === "NOTFOUND") return null;

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Placeholder swapped in before escaping and back out afterwards, so
    // %{timeDelta} becomes a real capture group instead of being mangled by
    // escaping its own inserted "(\d+)", and so it still works when embedded
    // in a token with no surrounding whitespace (e.g. Chinese "%{timeDelta}天前").
    const PLACEHOLDER = '\u0000TIMEDELTA\u0000';

    const regexStr = pattern
      .split(/\s+/)
      .map(token => {
        const withPlaceholder = token.replace(/%\{timeDelta\}/g, PLACEHOLDER);
        // "|" inside a token means multiple grammatical forms of the same
        // word (e.g. Russian "минут|минуту|минуты"): turn it into an
        // alternation instead of escaping it into a literal pipe.
        if (withPlaceholder.includes('|')) {
          const alternatives = withPlaceholder
            .split('|')
            .map(alt => escapeRegex(alt).split(PLACEHOLDER).join('(\\d+)'));
          return `(?:${alternatives.join('|')})`;
        }
        return escapeRegex(withPlaceholder).split(PLACEHOLDER).join('(\\d+)');
      })
      .join('\\s+');

    return new RegExp(`^${regexStr}$`, 'i');
  }

  // Shared abbreviation-guessing fallback for unit words that aren't in any
  // enabled language's dictionary. Only reachable from callers whose regex
  // captures the unit generically (the hardcoded English "ago" regex above,
  // and the multi-unit "in X and Y" split below) -- regexRelative and the
  // suffix regexes restrict their capture group to already-known words, so
  // this fallback can never fire for them (verified empirically before the
  // dead branches that used to sit in those paths were removed).
  private guessUnit(unitStr: string): TimeUnit {
    const mapped = this.timeUnitMap.get(unitStr);
    if (mapped) {
      return mapped;
    }
    if (unitStr.startsWith('h')) return 'hours';
    else if (unitStr.startsWith('d') || unitStr.startsWith('j')) return 'days';
    else if (unitStr.startsWith('w') || unitStr.startsWith('s')) return 'weeks';
    else if (unitStr === 'm' || unitStr.startsWith('min')) return 'minutes';
    else if (unitStr.startsWith('mo') || unitStr === 'M' || unitStr.startsWith('mois')) return 'months';
    else if (unitStr.startsWith('y') || unitStr.startsWith('a')) return 'years';
    return 'days';
  }

  // ============================================================
  // LEVEL 2: RELATIVE CALCULATION (in 2 minutes, in 1 year...)
  // ============================================================
  private tryRelativeCalculation(cleanedText: string): Date | null {
    // First check combinations "in 2 weeks and 3 days" or multiple combinations
    // Try to parse multiple combinations like "in 1 year and 2 months and 3 weeks and 4 days"
    let hasMultiUnits = false;
    const totalMoment = moment();

    // Try to match all "X unit" patterns after "in"
    const inPatterns = Array.from(new Set(this.languages.map(l => this.tc.translate("in", l)).filter(v => v !== "NOTFOUND").flatMap(v => v.split("|"))));
    const andPatterns = Array.from(new Set(this.languages.map(l => this.tc.translate("and", l)).filter(v => v !== "NOTFOUND").flatMap(v => v.split("|"))));

    const inRegex = new RegExp(`^(${this.tc.buildAlternation(inPatterns)})\\s+`, 'i');
    const andRegex = new RegExp(`\\s+(${this.tc.buildAlternation(andPatterns)})\\s+`, 'gi');

    if (cleanedText.match(inRegex)) {
      const withoutIn = cleanedText.replace(inRegex, '');
      const parts = withoutIn.split(andRegex).filter(p => p && !andPatterns.some(a => a.toLowerCase() === p.trim().toLowerCase()));

      if (parts.length >= 2) {
        // Multiple units detected (2 or more)
        for (const part of parts) {
          const unitMatch = part.trim().match(/^(\d+)\s+([^\s]+)$/i);
          if (unitMatch) {
            const value = parseInt(unitMatch[1]);
            const unitStr = unitMatch[2].toLowerCase().trim();
            totalMoment.add(value, this.guessUnit(unitStr));
            hasMultiUnits = true;
          }
        }
        if (hasMultiUnits) {
          return totalMoment.toDate();
        }
      }
    }

    // Suffix-style combinations, e.g. Chinese "2週和3天後" (2 weeks and 3 days later)
    const relCombinedSuffixMatch = this.regexRelativeCombinedSuffix ? cleanedText.match(this.regexRelativeCombinedSuffix) : null;
    if (relCombinedSuffixMatch) {
      const value1 = parseInt(relCombinedSuffixMatch[1]);
      const unitStr1 = relCombinedSuffixMatch[2].toLowerCase().trim();
      const value2 = parseInt(relCombinedSuffixMatch[3]);
      const unitStr2 = relCombinedSuffixMatch[4].toLowerCase().trim();

      const unit1 = this.guessUnit(unitStr1);
      const unit2 = this.guessUnit(unitStr2);

      return moment().add(value1, unit1).add(value2, unit2).toDate();
    }

    // Then check simple expressions "in 2 minutes"
    const relMatch = cleanedText.match(this.regexRelative);
    if (relMatch) {
      const value = parseInt(relMatch[1]);
      const unitStr = relMatch[2].toLowerCase().trim();

      // unitStr is guaranteed to be a registered key here: regexRelative's
      // unit capture group is built from this.tc.collectWords() for the same
      // six keys that populate timeUnitMap, so a successful regex match
      // already implies a hit -- the fallback below is unreachable.
      const unit = this.timeUnitMap.get(unitStr) ?? this.guessUnit(unitStr);

      // MomentJS handles year transitions perfectly
      return moment().add(value, unit).toDate();
    }

    // Suffix-style simple expressions, e.g. Chinese "2天後" (2 days later)
    const relSuffixMatch = this.regexRelativeSuffix ? cleanedText.match(this.regexRelativeSuffix) : null;
    if (relSuffixMatch) {
      const value = parseInt(relSuffixMatch[1]);
      const unitStr = relSuffixMatch[2].toLowerCase().trim();
      const unit = this.guessUnit(unitStr);
      return moment().add(value, unit).toDate();
    }

    return null;
  }

  // ============================================================
  // LEVEL 2.5: DATE RANGES (from Monday to Friday)
  // ============================================================
  // Returns just the start date, for getParsedDate()'s single-Date contract
  // -- see getParsedDateRange() for the full range with a date list.
  private tryDateRangeShortcut(cleanedText: string): Date | null {
    const rangeMatch = cleanedText.match(this.regexDateRange);
    if (!rangeMatch) return null;

    const startDayName = rangeMatch[1].toLowerCase();
    const m = moment();
    const startDayIndex = this.getDayOfWeekIndex(startDayName);

    const startMoment = moment().day(startDayIndex);
    if (startMoment.isBefore(m, 'day')) {
      startMoment.add(1, 'week');
    }

    return startMoment.toDate();
  }

  // ============================================================
  // LEVEL 3: WEEKDAYS (next friday...)
  // ============================================================
  private tryWeekdays(cleanedText: string): Date | null {
    // First check "next Monday at 3pm"
    const weekWithTimeMatch = cleanedText.match(this.regexWeekdayWithTime);
    if (weekWithTimeMatch) {
      const prefix = weekWithTimeMatch[1].toLowerCase();
      const dayName = weekWithTimeMatch[2].toLowerCase();
      const timePart = weekWithTimeMatch[3].trim();

      const m = moment();
      const dayIndex = this.getDayOfWeekIndex(dayName);

      if (this.prefixKeywords.this.has(prefix)) {
        m.day(dayIndex);
      } else if (this.prefixKeywords.next.has(prefix)) {
        m.add(1, 'weeks').day(dayIndex);
      } else if (this.prefixKeywords.last.has(prefix)) {
        // Pour "last/dernier <jour>", on cible toujours la semaine précédente
        m.day(dayIndex).subtract(1, 'week');
      }

      // Parse time with chrono-node. getParsedDateResult returns null
      // (rather than a "now" placeholder) when nothing matched, so a time
      // part chrono-node can't parse (e.g. "next Monday at zzqqxx") falls
      // back to the already-computed weekday date below, instead of
      // silently discarding it in favor of the actual current date/time.
      const timeResult = this.getParsedDateResult(timePart, m.toDate());
      if (timeResult) {
        return timeResult;
      }

      // If time parsing fails, return just the date
      return m.toDate();
    }

    // Then check simple expressions "next Monday"
    const weekMatch = cleanedText.match(this.regexWeekday);
    if (weekMatch) {
      const prefix = weekMatch[1].toLowerCase();
      const dayName = weekMatch[2].toLowerCase();

      const m = moment();
      const dayIndex = this.getDayOfWeekIndex(dayName);

      if (this.prefixKeywords.this.has(prefix)) {
        m.day(dayIndex);
      } else if (this.prefixKeywords.next.has(prefix)) {
        m.add(1, 'weeks').day(dayIndex);
      } else if (this.prefixKeywords.last.has(prefix)) {
        // Pour "last/dernier <jour>", on cible toujours la semaine précédente
        m.day(dayIndex).subtract(1, 'week');
      }
      return m.toDate();
    }

    // Check for weekday without prefix (e.g., "wednesday", "friday")
    // This should be interpreted as "next [day]" or "this [day]" if today
    const weekOnlyMatch = cleanedText.match(this.regexWeekdayOnly);
    if (weekOnlyMatch) {
      const dayName = weekOnlyMatch[1].toLowerCase();
      const m = moment();
      const dayIndex = this.getDayOfWeekIndex(dayName);

      m.day(dayIndex);
      // If the day is in the past (before today), move to next week
      if (m.isBefore(moment(), 'day')) {
        m.add(1, 'week');
      }
      return m.toDate();
    }

    return null;
  }

  // ============================================================
  // LEVEL 3.5a: "the Xth of next month" / "the Nth of next year"
  // ============================================================
  private tryOrdinalOfMonth(cleanedText: string): Date | null {
    const ordinalOfMonthMatch = cleanedText.match(this.regexOrdinalOfMonth);
    if (!ordinalOfMonthMatch) return null;

    const ordinalStr = ordinalOfMonthMatch[1].trim();
    // Groups: [1]=ordinal, [2]=prefix before month (optional), [3]=month, [4]=prefix after month (optional, for French)
    const prefixBefore = ordinalOfMonthMatch[2]?.toLowerCase() || '';
    const periodStr = ordinalOfMonthMatch[3]?.toLowerCase() || '';
    const prefixAfter = ordinalOfMonthMatch[4]?.toLowerCase() || '';

    // Use prefix after month if present (French inversion), otherwise prefix before
    const prefix = prefixAfter || prefixBefore;

    // Parse ordinal number (e.g., "15th" -> 15, "first" -> 1)
    const dayNumber = parseOrdinalNumberPattern(ordinalStr);

    // Determine which period (month/year) to target
    const targetMoment = moment();
    const isMonth = this.tc.collectWords('month', { lowercase: true }).includes(periodStr);
    const isYear = !isMonth && this.tc.collectWords('year', { lowercase: true }).includes(periodStr);

    if (isMonth) {
      if (prefix && this.prefixKeywords.next.has(prefix)) {
        targetMoment.add(1, 'months').startOf('month');
      } else if (prefix && this.prefixKeywords.last.has(prefix)) {
        targetMoment.subtract(1, 'months').startOf('month');
      } else {
        // "this"/no prefix both mean "this month"
        targetMoment.startOf('month');
      }

      // Set the day of month (clamp to valid range)
      const daysInMonth = targetMoment.daysInMonth();
      const targetDay = Math.min(dayNumber, daysInMonth);
      targetMoment.date(targetDay);
    } else if (isYear) {
      if (prefix && this.prefixKeywords.next.has(prefix)) {
        targetMoment.add(1, 'years').startOf('year');
      } else if (prefix && this.prefixKeywords.last.has(prefix)) {
        targetMoment.subtract(1, 'years').startOf('year');
      } else {
        targetMoment.startOf('year');
      }

      // For year, interpret as day of year (1-365/366)
      const daysInYear = targetMoment.isLeapYear() ? 366 : 365;
      const targetDayOfYear = Math.min(dayNumber, daysInYear);
      targetMoment.dayOfYear(targetDayOfYear);
    }

    return targetMoment.toDate();
  }

  // ============================================================
  // LEVEL 3.5b: "last day of month" / "dernier jour du mois"
  // ============================================================
  private tryLastDayOfMonth(cleanedText: string): Date | null {
    const lastDayOfMonthMatch = cleanedText.match(this.regexLastDayOfMonth);
    if (!lastDayOfMonthMatch) return null;

    // Groups: [1]=prefix before "last" (optional), [2]="last", [3]=day, [4]=prefix before month (optional), [5]=month, [6]=prefix after month (optional, for French)
    const prefixBefore = lastDayOfMonthMatch[1]?.toLowerCase() || '';
    const periodStr = lastDayOfMonthMatch[5]?.toLowerCase() || '';
    const prefixAfter = lastDayOfMonthMatch[6]?.toLowerCase() || '';
    const prefixBeforeMonth = lastDayOfMonthMatch[4]?.toLowerCase() || '';

    // Use prefix after month if present (French inversion), otherwise prefix before month, otherwise prefix before "last"
    const prefix = prefixAfter || prefixBeforeMonth || prefixBefore;

    const targetMoment = moment();
    const isMonth = this.tc.collectWords('month', { lowercase: true }).includes(periodStr);
    if (!isMonth) return null;

    if (prefix && this.prefixKeywords.next.has(prefix)) {
      targetMoment.add(1, 'months').endOf('month');
    } else if (prefix && this.prefixKeywords.last.has(prefix)) {
      targetMoment.subtract(1, 'months').endOf('month');
    } else {
      // "this"/no prefix both mean "this month"
      targetMoment.endOf('month');
    }

    return targetMoment.toDate();
  }

  // ============================================================
  // LEVEL 3.5c: "first Monday of month" / "last Friday of next month"
  // ============================================================
  private tryWeekdayOfMonth(cleanedText: string): Date | null {
    const weekdayOfMonthMatch = cleanedText.match(this.regexWeekdayOfMonth);
    if (!weekdayOfMonthMatch) return null;

    // Groups: [1]=first/prefix, [2]=weekday, [3]=prefix before month (optional), [4]=month, [5]=prefix after month (optional, for French)
    const prefixOrFirst = weekdayOfMonthMatch[1].toLowerCase();
    const dayName = weekdayOfMonthMatch[2].toLowerCase();
    const prefixBeforeMonth = weekdayOfMonthMatch[3]?.toLowerCase() || '';
    const periodStr = weekdayOfMonthMatch[4]?.toLowerCase() || '';
    const prefixAfter = weekdayOfMonthMatch[5]?.toLowerCase() || '';

    // Use prefix after month if present (French inversion), otherwise prefix before month, otherwise prefixOrFirst
    const monthPrefix = prefixAfter || prefixBeforeMonth;

    const dayIndex = this.getDayOfWeekIndex(dayName);
    const isFirst = this.tc.collectWords("first", { lowercase: true }).includes(prefixOrFirst);
    const isMonth = this.tc.collectWords('month', { lowercase: true }).includes(periodStr);
    if (!isMonth) return null;

    const isLast = !isFirst && this.prefixKeywords.last.has(prefixOrFirst);
    let targetMoment = moment();

    if (isFirst) {
      // First weekday of month
      if (monthPrefix && this.prefixKeywords.next.has(monthPrefix)) {
        targetMoment.add(1, 'months').startOf('month');
      } else if (monthPrefix && this.prefixKeywords.last.has(monthPrefix)) {
        targetMoment.subtract(1, 'months').startOf('month');
      } else {
        targetMoment.startOf('month');
      }

      // Find the first occurrence of the weekday in the target month
      const firstDayOfMonth = targetMoment.clone().startOf('month');
      const firstWeekdayIndex = firstDayOfMonth.day();
      const daysToAdd = (dayIndex - firstWeekdayIndex + 7) % 7;
      targetMoment = firstDayOfMonth.add(daysToAdd, 'days');
    } else if (isLast) {
      // Last weekday of month
      if (monthPrefix && this.prefixKeywords.next.has(monthPrefix)) {
        targetMoment.add(1, 'months').endOf('month');
      } else if (monthPrefix && this.prefixKeywords.last.has(monthPrefix)) {
        targetMoment.subtract(1, 'months').endOf('month');
      } else {
        // "this"/no prefix both mean "this month"
        targetMoment.endOf('month');
      }

      // Find the last occurrence of the weekday by going to end of month and working backwards
      const lastDayOfMonth = targetMoment.clone().endOf('month');
      const lastWeekdayIndex = lastDayOfMonth.day();
      const daysToSubtract = (lastWeekdayIndex - dayIndex + 7) % 7;
      targetMoment = lastDayOfMonth.subtract(daysToSubtract, 'days');
    } else {
      // Prefix-based (next/this) - default to first
      if (monthPrefix && this.prefixKeywords.next.has(monthPrefix)) {
        targetMoment.add(1, 'months').startOf('month');
      } else {
        // "this"/no prefix both mean "this month"
        targetMoment.startOf('month');
      }

      // Find the first occurrence of the weekday in the target month
      const firstDayOfMonth = targetMoment.clone().startOf('month');
      const firstWeekdayIndex = firstDayOfMonth.day();
      const daysToAdd = (dayIndex - firstWeekdayIndex + 7) % 7;
      targetMoment = firstDayOfMonth.add(daysToAdd, 'days');
    }

    return targetMoment.toDate();
  }

  // ============================================================
  // LEVEL 4a: "next month" / "next year" shortcut (before falling to chrono-node)
  // ============================================================
  // Note: "next week" is intentionally NOT handled here -- it's left to
  // getParsedDateRange() to generate a full date list, so that case falls
  // through to the chrono-node fallback instead.
  private tryNextPeriodShortcut(cleanedText: string): Date | null {
    // Uses \s* (not \s+) so this also matches languages without spaces between
    // words (e.g. Chinese "下一個星期"). The period is matched against the known
    // week/month/year words directly (not a generic \S+/\w+ capture): otherwise a
    // shorter word that is a prefix of a longer one (e.g. French "prochain" vs
    // "prochaine") can match first and leave the remaining letters to be
    // mis-captured as the period.
    const nextPattern = this.tc.buildAlternation(Array.from(this.prefixKeywords.next));
    const periodWordsAll = ['week', 'month', 'year'].flatMap(key => this.tc.collectWords(key));
    const periodPatternAll = this.tc.buildAlternation(periodWordsAll);
    const nextDateMatch = cleanedText.match(new RegExp(`(${nextPattern})\\s*(${periodPatternAll})`, 'i'));
    if (!nextDateMatch) return null;

    const period = nextDateMatch[2].toLowerCase();
    const isNextWeek = this.tc.collectWords('week', { lowercase: true }).includes(period);
    if (isNextWeek) return null;

    if (this.tc.collectWords('month', { lowercase: true }).includes(period)) {
      return moment().add(1, 'months').startOf('month').toDate();
    }
    if (this.tc.collectWords('year', { lowercase: true }).includes(period)) {
      return moment().add(1, 'years').startOf('year').toDate();
    }
    return null;
  }

  // ============================================================
  // LEVEL 4b: THE REST (chrono-node library, final fallback)
  // ============================================================
  private chronoFallback(selectedText: string, weekStartPreference: DayOfWeek): Date {
    if (!this.chronos || this.chronos.length === 0) return new Date();

    // We use the "Best Score" technique to choose between EN and FR
    const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
    const locale = { weekStart: getWeekNumber(weekStart) };
    const referenceDate = new Date();

    // Standard library call with forced forwardDate
    const chronoResult = this.getParsedDateResult(selectedText, referenceDate, {
      locale,
      forwardDate: true
    } as ParsingOption);
    // Nothing matched anywhere: this is the final fallback level, so (per
    // this method's documented contract) fall back to the current date.
    return chronoResult ?? new Date();
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
    // Check "from Monday to Friday"
    const rangeMatch = selectedText.match(this.regexDateRange);
    if (rangeMatch) {
      const startDayName = rangeMatch[1].toLowerCase();
      const endDayName = rangeMatch[2].toLowerCase();
      
      const m = moment();
      const startDayIndex = this.getDayOfWeekIndex(startDayName);
      const endDayIndex = this.getDayOfWeekIndex(endDayName);
      
      // Find next start day
      const startMoment = moment().day(startDayIndex);
      if (startMoment.isBefore(m, 'day')) {
        startMoment.add(1, 'week');
      }
      
      // Find next end day (must be after or equal to start day)
      let endMoment = moment().day(endDayIndex);
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
      const currentMoment = startMoment.clone();
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
    // Uses \s* (not \s+) so this also matches languages without spaces between
    // words (e.g. Chinese "下一個星期"). The period is matched against the known
    // "week" words directly (not a generic \S+/\w+ capture): otherwise a shorter
    // word that is a prefix of a longer one (e.g. French "prochain" vs "prochaine")
    // can match first and leave the remaining letters to be mis-captured as the period.
    const nextPattern = this.tc.buildAlternation(Array.from(this.prefixKeywords.next));
    const weekPatternAll = this.tc.buildAlternationFor('week');
    // First try "next week" pattern
    let nextWeekMatch = selectedText.match(new RegExp(`(${nextPattern})\\s*(${weekPatternAll})`, 'i'));
    let periodIndex = 2; // Index of period in match array
    if (!nextWeekMatch) {
      // Try reverse pattern "week next" for languages like French
      nextWeekMatch = selectedText.match(new RegExp(`(${weekPatternAll})\\s*(${nextPattern})`, 'i'));
      if (nextWeekMatch) {
        periodIndex = 1; // Period is now at index 1
      }
    }
    if (nextWeekMatch) {
      const period = nextWeekMatch[periodIndex].toLowerCase();
      if (this.tc.collectWords('week', { lowercase: true }).includes(period)) {
        // Next week -> return from Monday to Sunday of next week
        const weekStart = weekStartPreference === "locale-default" ? getLocaleWeekStart() : weekStartPreference;
        const weekStartIndex = this.getDayOfWeekIndex(String(weekStart));

        const startMoment = moment().add(1, 'weeks').day(weekStartIndex);
        const endMoment = startMoment.clone().add(6, 'days');

        const format = "YYYY-MM-DD";
        const startFormatted = startMoment.format(format);
        const endFormatted = endMoment.format(format);

        // Generate list of all dates in range
        const dateList: Moment[] = [];
        const currentMoment = startMoment.clone();
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

    return null;
  }

  // --- UTILITY FUNCTION: WHO HAS THE BEST SCORE? ---
  // Returns null (rather than a "now" placeholder) when chrono-node found no
  // match, so callers can tell "nothing parsed" apart from "parsed to right
  // now" and fall back accordingly instead of silently accepting a bogus
  // current-date/time result.
  getParsedDateResult(text: string, referenceDate?: Date, option?: ParsingOption): Date | null {
    if (!this.chronos || this.chronos.length === 0) return null;
    let bestResult: ParsedResult | null = null;
    let bestScore = 0;

    for (const c of this.chronos) {
      try {
        const results = c.parse(text, referenceDate, option);
        // chrono can return several disjoint matches for one string (e.g.
        // "today in 3 minutes" -> ["today", "in 3 minutes"], parsed as two
        // independent candidates, neither containing the other). Comparing
        // every candidate's score -- not just results[0] -- means the more
        // specific/informative one wins instead of always picking whichever
        // chrono happened to list first, which silently discarded "in 3
        // minutes" and returned the current time unmodified.
        for (const match of results) {
          if (match.text.length > bestScore) {
            bestScore = match.text.length;
            bestResult = match;
          }
        }
      } catch (e) {
        logger.warn('Chrono parsing error in getParsedDateResult', {
          text,
          error: describeError(e),
        });
      }
    }
    return bestResult ? bestResult.start.date() : null;
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
          error: describeError(e),
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