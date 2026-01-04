import { App, MarkdownView, Editor } from "obsidian";
import type NaturalLanguageDates from "./main";
import t from "./lang/helper";

const CONTEXT_LINES = 10; // Number of lines to analyze before and after cursor
const MAX_DATES_TO_EXTRACT = 10; // Maximum number of dates to extract from context

export interface ContextInfo {
  datesInContext: string[]; // Dates found in context (detected natural formats)
  title?: string; // Titre de la note
  tags: string[]; // Tags de la note
}

export default class ContextAnalyzer {
  private app: App;
  private plugin: NaturalLanguageDates;
  private cache: Map<string, ContextInfo> = new Map(); // Temporary cache per file
  private cacheTimeout: number = 5000; // 5 second cache
  
  // Regex patterns for date detection (dynamically generated)
  private datePatterns: RegExp[] = [];

  constructor(app: App, plugin: NaturalLanguageDates) {
    this.app = app;
    this.plugin = plugin;
    this.initializeDatePatterns();
  }

  /**
   * Initializes regex patterns for date detection in all enabled languages
   */
  private initializeDatePatterns(): void {
    const languages = this.plugin.settings.languages;
    
    // Collect all words from all enabled languages
    const weekdays: string[] = [];
    const todayWords: string[] = [];
    const tomorrowWords: string[] = [];
    const yesterdayWords: string[] = [];
    const inWords: string[] = [];
    const nextWords: string[] = [];
    const lastWords: string[] = [];
    const timeUnits: string[] = [];

    for (const lang of languages) {
      // Weekdays
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of days) {
        const dayWord = t(day, lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          weekdays.push(...dayWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }

      // Common temporal words
      const todayWord = t("today", lang);
      if (todayWord && todayWord !== "NOTFOUND") {
        todayWords.push(...todayWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const tomorrowWord = t("tomorrow", lang);
      if (tomorrowWord && tomorrowWord !== "NOTFOUND") {
        tomorrowWords.push(...tomorrowWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const yesterdayWord = t("yesterday", lang);
      if (yesterdayWord && yesterdayWord !== "NOTFOUND") {
        yesterdayWords.push(...yesterdayWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // "in" for relative expressions
      const inWord = t("in", lang);
      if (inWord && inWord !== "NOTFOUND") {
        inWords.push(...inWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // "next" and "last"
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWords.push(...nextWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWords.push(...lastWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // Time units
      const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
      for (const unitKey of timeUnitKeys) {
        const unitWord = t(unitKey, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          timeUnits.push(...unitWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }
    }

    // Escape special characters for regex
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create regex patterns
    this.datePatterns = [];

    // Pattern 1: Weekdays
    if (weekdays.length > 0) {
      const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
      // Use \b for word boundaries (works for most languages)
      this.datePatterns.push(new RegExp(`\\b(${weekdayPattern})\\b`, 'gi'));
    }

    // Pattern 2: Common temporal words (today, tomorrow, yesterday)
    const timeWords = [...todayWords, ...tomorrowWords, ...yesterdayWords];
    if (timeWords.length > 0) {
      const timeWordPattern = [...new Set(timeWords.map(escapeRegex))].join('|');
      this.datePatterns.push(new RegExp(`\\b(${timeWordPattern})\\b`, 'gi'));
    }

    // Pattern 3: Relative expressions "in X days/weeks/months"
    if (inWords.length > 0 && timeUnits.length > 0) {
      const inPattern = [...new Set(inWords.map(escapeRegex))].join('|');
      const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
      this.datePatterns.push(new RegExp(`\\b(${inPattern})\\s+\\d+\\s+(${timeUnitPattern})\\b`, 'gi'));
    }

    // Pattern 4: Expressions "next/last weekday/week/month/year"
    const prefixWords = [...nextWords, ...lastWords];
    if (prefixWords.length > 0) {
      const prefixPattern = [...new Set(prefixWords.map(escapeRegex))].join('|');
      
      // For weekdays
      if (weekdays.length > 0) {
        const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
        this.datePatterns.push(new RegExp(`\\b(${prefixPattern})\\s+(${weekdayPattern})\\b`, 'gi'));
      }
      
      // For time units
      if (timeUnits.length > 0) {
        const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
        this.datePatterns.push(new RegExp(`\\b(${prefixPattern})\\s+(${timeUnitPattern})\\b`, 'gi'));
      }
    }
  }

  /**
   * Resets patterns (to be called when languages change)
   */
  resetPatterns(): void {
    this.initializeDatePatterns();
    this.clearCache(); // Clear cache because patterns have changed
  }

  /**
   * Analyzes context around cursor synchronously (uses cache)
   */
  analyzeContextSync(editor: Editor, cursorLine: number): ContextInfo {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return { datesInContext: [], tags: [] };
    }

    const file = activeView.file;
    if (!file) {
      return { datesInContext: [], tags: [] };
    }

    // Check cache (with timeout)
    const cacheKey = `${file.path}-${cursorLine}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const context: ContextInfo = {
      datesInContext: [],
      tags: [],
    };

    try {
      // Extract tags from metadata
      const metadata = this.app.metadataCache.getFileCache(file);
      if (metadata) {
        if (metadata.tags) {
          context.tags = metadata.tags.map(tag => tag.tag);
        }

        // Extract title from frontmatter or first heading
        if (metadata.frontmatter?.title) {
          context.title = metadata.frontmatter.title;
        } else if (metadata.headings && metadata.headings.length > 0) {
          context.title = metadata.headings[0].heading;
        }
      }

      // Analyze context around cursor
      const content = editor.getValue();
      const lines = content.split("\n");
      
      const startLine = Math.max(0, cursorLine - CONTEXT_LINES);
      const endLine = Math.min(lines.length - 1, cursorLine + CONTEXT_LINES);
      
      const contextLines = lines.slice(startLine, endLine + 1);
      const contextText = contextLines.join("\n");

      // Extract dates from context
      context.datesInContext = this.extractDatesFromContext(contextText);

      // Cache (with periodic cleanup)
      this.cache.set(cacheKey, context);
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.cacheTimeout);

    } catch (error) {
      console.error("Error analyzing context:", error);
    }

    return context;
  }

  /**
   * Analyzes context around cursor in current document (async, for compatibility)
   */
  async analyzeContext(editor: Editor, cursorLine: number): Promise<ContextInfo> {
    return this.analyzeContextSync(editor, cursorLine);
  }

  /**
   * Normalizes an extracted date by capitalizing the first letter
   * Example: "demain" -> "Demain", "lundi prochain" -> "Lundi prochain"
   */
  private normalizeDate(dateStr: string): string {
    if (!dateStr || dateStr.length === 0) {
      return dateStr;
    }
    
    const trimmed = dateStr.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }
    
    // Capitalize first letter (handles Unicode characters)
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  /**
   * Extracts potential date expressions from text
   * Uses dynamic multi-language patterns to detect natural dates
   */
  private extractDatesFromContext(text: string): string[] {
    const dates: string[] = [];
    const seen = new Set<string>();

    // Use dynamically generated patterns for all enabled languages
    for (const pattern of this.datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          // For case-insensitive languages (like Japanese), toLowerCase() doesn't change anything
          const normalized = match.toLowerCase().trim();
          if (!seen.has(normalized) && dates.length < MAX_DATES_TO_EXTRACT) {
            seen.add(normalized);
            // Normalize with first letter capitalized (or leave as is for Japanese)
            dates.push(this.normalizeDate(match.trim()));
          }
        }
      }
    }

    return dates;
  }

  /**
   * Clears cache (can be called periodically)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
