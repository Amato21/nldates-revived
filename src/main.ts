import { MarkdownView, ObsidianProtocolData, Plugin } from "obsidian";

import DatePickerModal from "./modals/date-picker";
import NLDParser, { NLDResult } from "./parser";
import { NLDSettingsTab, NLDSettings, DEFAULT_SETTINGS } from "./settings";
import DateSuggest from "./suggest/date-suggest";
import {
  getParseCommand,
  getCurrentDateCommand,
  getCurrentTimeCommand,
  getNowCommand,
} from "./commands";
import { getFormattedDate, getOrCreateDailyNote, parseTruthy, validateUriParam, validateMomentFormat } from "./utils";
import HistoryManager from "./history-manager";
import ContextAnalyzer from "./context-analyzer";
import { logger } from "./logger";
import { NLDParseError, ErrorCodes } from "./errors";

export default class NaturalLanguageDates extends Plugin {
  public parser: NLDParser;
  public settings: NLDSettings;
  public historyManager: HistoryManager;
  public contextAnalyzer: ContextAnalyzer;
  private memoryMonitoringInterval: number | null = null;
  private readonly MEMORY_MONITORING_INTERVAL = 600000; // Toutes les 10 minutes

  async onload(): Promise<void> {
    await this.loadSettings();
    
    // Initialize parser immediately (no need to wait for onLayoutReady)
    this.resetParser();

    // Initialize smart suggestion managers
    this.historyManager = new HistoryManager(this);
    this.contextAnalyzer = new ContextAnalyzer(this.app, this);
    
    // Initialize history asynchronously
    this.historyManager.initialize().catch(err => {
      logger.error("Error initializing history", { error: err });
    });

    this.addCommand({
      id: "nlp-dates",
      name: "Parse natural language date",
      callback: () => getParseCommand(this, "replace"),
    });

    this.addCommand({
      id: "nlp-dates-link",
      name: "Parse natural language date (as link)",
      callback: () => getParseCommand(this, "link"),
    });

    this.addCommand({
      id: "nlp-date-clean",
      name: "Parse natural language date (as plain text)",
      callback: () => getParseCommand(this, "clean"),
    });

    this.addCommand({
      id: "nlp-parse-time",
      name: "Parse natural language time",
      callback: () => getParseCommand(this, "time"),
    });

    this.addCommand({
      id: "nlp-now",
      name: "Insert the current date and time",
      callback: () => getNowCommand(this),
    });

    this.addCommand({
      id: "nlp-today",
      name: "Insert the current date",
      callback: () => getCurrentDateCommand(this),
    });

    this.addCommand({
      id: "nlp-time",
      name: "Insert the current time",
      callback: () => getCurrentTimeCommand(this),
    });

    this.addCommand({
      id: "nlp-picker",
      name: "Date picker",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        }
        new DatePickerModal(this.app, this).open();
      },
    });

    this.addSettingTab(new NLDSettingsTab(this.app, this));
    this.registerObsidianProtocolHandler("nldates", this.actionHandler.bind(this));
    this.registerEditorSuggest(new DateSuggest(this.app, this));

    // Démarrer le monitoring de la mémoire
    this.startMemoryMonitoring();
  }

  resetParser(): void {
    try {
      this.parser = new NLDParser(this.settings.languages);
      logger.debug("Parser initialized successfully", { languages: this.settings.languages });
    } catch (error) {
      const parseError = error instanceof NLDParseError 
        ? error 
        : new NLDParseError(
            'Failed to initialize parser',
            ErrorCodes.PARSER_INIT_FAILED,
            'error',
            { originalError: error, languages: this.settings.languages }
          );
      
      logger.error('Failed to initialize parser', {
        code: parseError.code,
        error: parseError.message,
        context: parseError.context,
      });
      
      // Create parser with English as default in case of error to prevent plugin from crashing completely
      try {
        this.parser = new NLDParser(['en']);
        logger.info('Parser initialized with English fallback');
        
        // Notifier l'utilisateur uniquement pour les erreurs critiques
        const appWithNotifications = this.app as typeof this.app & { notifications: { create: (options: { msg: string; duration: number }) => void } };
        if (appWithNotifications.notifications) {
          appWithNotifications.notifications.create({
            msg: 'Natural Language Dates: Failed to initialize with selected languages. Using English as fallback.',
            duration: 5000,
          });
        }
      } catch (fallbackError) {
        logger.error('Failed to initialize parser even with English fallback', { error: fallbackError });
        const appWithNotifications = this.app as typeof this.app & { notifications: { create: (options: { msg: string; duration: number }) => void } };
        if (appWithNotifications.notifications) {
          appWithNotifications.notifications.create({
            msg: 'Natural Language Dates: Critical error - parser initialization failed. Please restart Obsidian.',
            duration: 10000,
          });
        }
      }
    }
    
    // Reset context patterns when languages change
    if (this.contextAnalyzer) {
      this.contextAnalyzer.resetPatterns();
    }
  }

  onunload(): void {
    // Arrêter le monitoring de la mémoire
    this.stopMemoryMonitoring();
    
    // Nettoyer les ressources
    if (this.contextAnalyzer) {
      this.contextAnalyzer.destroy();
    }
    if (this.historyManager) {
      this.historyManager.destroy();
    }
  }

  /**
   * Démarre le monitoring périodique de l'utilisation mémoire
   */
  private startMemoryMonitoring(): void {
    // Logger les statistiques toutes les 10 minutes
    this.memoryMonitoringInterval = window.setInterval(() => {
      this.logMemoryUsage();
    }, this.MEMORY_MONITORING_INTERVAL);
    
    // Logger immédiatement au démarrage
    this.logMemoryUsage();
  }

  /**
   * Arrête le monitoring de la mémoire
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryMonitoringInterval !== null) {
      window.clearInterval(this.memoryMonitoringInterval);
      this.memoryMonitoringInterval = null;
    }
  }

  /**
   * Log les statistiques d'utilisation mémoire des caches
   */
  private logMemoryUsage(): void {
    try {
      const stats: {
        parsingCache?: { size: number; maxSize: number };
        contextCache?: { size: number; maxSize: number };
        history?: { size: number; maxSize: number };
      } = {};

      // Statistiques du cache de parsing
      if (this.parser) {
        stats.parsingCache = this.parser.getCacheStats();
      }

      // Statistiques du cache de contexte
      if (this.contextAnalyzer) {
        stats.contextCache = this.contextAnalyzer.getCacheStats();
      }

      // Statistiques de l'historique
      if (this.historyManager) {
        this.historyManager.getHistory().then(history => {
          stats.history = {
            size: Object.keys(history).length,
            maxSize: 100, // MAX_HISTORY_SIZE
          };
          
          logger.debug("Utilisation mémoire des caches", stats);
        }).catch(err => {
          logger.warn("Impossible de récupérer les statistiques de l'historique", { error: err });
          // Logger quand même les autres statistiques
          if (Object.keys(stats).length > 0) {
            logger.debug("Utilisation mémoire des caches", stats);
          }
        });
      } else {
        if (Object.keys(stats).length > 0) {
          logger.debug("Utilisation mémoire des caches", stats);
        }
      }
    } catch (error) {
      logger.warn("Erreur lors du monitoring de la mémoire", { error });
    }
  }

  async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    
    // Ensure languages is not empty (use default values if necessary)
    if (!this.settings.languages || this.settings.languages.length === 0) {
      this.settings.languages = [...DEFAULT_SETTINGS.languages];
    }
    
    // Synchronize flags with languages array if necessary
    this.syncLanguageFlags();
  }

  // Synchronizes language flags (english, french, etc.) with languages array
  private syncLanguageFlags(): void {
    const languageMap: { [key: string]: keyof NLDSettings } = {
      'en': 'english',
      'ja': 'japanese',
      'fr': 'french',
      'de': 'german',
      'pt': 'portuguese',
      'nl': 'dutch',
      'es': 'spanish',
      'it': 'italian',
    };
    
    // Reset all flags
    this.settings.english = false;
    this.settings.japanese = false;
    this.settings.french = false;
    this.settings.german = false;
    this.settings.portuguese = false;
    this.settings.dutch = false;
    this.settings.spanish = false;
    this.settings.italian = false;
    
    // Enable flags corresponding to languages in array
    for (const lang of this.settings.languages) {
      const flagKey = languageMap[lang];
      if (flagKey) {
        (this.settings[flagKey] as boolean) = true;
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Parses a natural language date string and formats it according to the specified format.
   * 
   * This is the core parsing method that accepts a custom format string.
   * The input is validated and sanitized before parsing.
   * 
   * @param dateString - Natural language date string (e.g., "today", "tomorrow", "in 2 days", "next Monday")
   * @param format - Moment.js format string (e.g., "YYYY-MM-DD", "DD/MM/YYYY", "MMMM Do, YYYY")
   * @returns NLDResult object containing the formatted string, Date object, and Moment object
   * 
   * @example
   * ```typescript
   * const result = plugin.parse("tomorrow", "YYYY-MM-DD");
   * console.log(result.formattedString); // "2025-01-06"
   * 
   * const result2 = plugin.parse("next Monday", "dddd, MMMM Do");
   * console.log(result2.formattedString); // "Monday, January 6th"
   * ```
   */
  parse(dateString: string, format: string): NLDResult {
    if (!this.parser) {
      // Parser not yet initialized, initialize it now
      this.resetParser();
    }

    // Valider le format avant utilisation
    const formatValidation = validateMomentFormat(format);
    if (!formatValidation.valid) {
      logger.warn("Invalid format in parse()", { format, error: formatValidation.error });
      // Utiliser le format par défaut en cas d'erreur
      format = DEFAULT_SETTINGS.format;
    }

    // Valider et sanitizer l'entrée utilisateur
    const sanitizedInput = validateUriParam(dateString, 200);
    if (!sanitizedInput) {
      logger.warn("Invalid input in parse()", { dateString });
      // Retourner une date invalide plutôt que de planter
      const invalidDate = new Date(NaN);
      return {
        formattedString: "Invalid date",
        date: invalidDate,
        moment: window.moment(invalidDate),
      };
    }

    const date = this.parser.getParsedDate(sanitizedInput, this.settings.weekStart);
    const formattedString = getFormattedDate(date, format);
    if (formattedString === "Invalid date") {
      logger.debug("Input date can't be parsed by nldates", { dateString: sanitizedInput });
    }

    return {
      formattedString,
      date,
      moment: window.moment(date),
    };
  }

  /**
   * Parses a natural language date string using the plugin's configured date format.
   * 
   * Automatically detects if the input contains a time component and includes it in the output.
   * Uses the format from plugin settings (default: "YYYY-MM-DD").
   * 
   * @param dateString - Natural language date string (e.g., "today", "tomorrow", "next Monday at 3pm")
   * @returns NLDResult object with formatted string using configured format
   * 
   * @example
   * ```typescript
   * // If settings.format is "YYYY-MM-DD" and settings.timeFormat is "HH:mm"
   * const result = plugin.parseDate("tomorrow");
   * console.log(result.formattedString); // "2025-01-06"
   * 
   * const result2 = plugin.parseDate("next Monday at 3pm");
   * console.log(result2.formattedString); // "2025-01-06 15:00"
   * ```
   */
  parseDate(dateString: string): NLDResult {
    // Valider et sanitizer l'entrée utilisateur
    const sanitizedInput = validateUriParam(dateString, 200);
    if (!sanitizedInput) {
      logger.warn("Invalid input in parseDate()", { dateString });
      const invalidDate = new Date(NaN);
      return {
        formattedString: "Invalid date",
        date: invalidDate,
        moment: window.moment(invalidDate),
      };
    }

    // Valider le format de date
    const dateFormatValidation = validateMomentFormat(this.settings.format);
    if (!dateFormatValidation.valid) {
      logger.warn("Invalid date format in settings", { format: this.settings.format, error: dateFormatValidation.error });
      // Utiliser le format par défaut
      this.settings.format = DEFAULT_SETTINGS.format;
    }

    // 1. Ask the parser if time is detected
    const hasTime = this.parser.hasTimeComponent(sanitizedInput);
    let formatToUse = this.settings.format;

    // 2. If time is detected...
    if (hasTime) {
      const timeFormat = this.settings.timeFormat || "HH:mm";
      
      // Valider le format de temps
      const timeFormatValidation = validateMomentFormat(timeFormat);
      if (!timeFormatValidation.valid) {
        logger.warn("Invalid time format in settings", { format: timeFormat, error: timeFormatValidation.error });
        // Utiliser le format par défaut
        formatToUse = `${this.settings.format} ${DEFAULT_SETTINGS.timeFormat}`;
      } else {
        // TIP: Here we format "Date TIME."
        // But BEWARE: it is the "date-suggest.ts" file that will add the [[ ]].
        // If we don't touch date-suggest, it will make [[Date Time]].
        // To make [[Date]] Time, we have to be clever.
        
        formatToUse = `${formatToUse} ${timeFormat}`;
      }
    }

    const result = this.parse(sanitizedInput, formatToUse);
    return result;
  }

  /**
   * Parses a natural language date range string.
   * 
   * Supports various range expressions:
   * - Weekday ranges: "from Monday to Friday" / "de lundi à vendredi"
   * - Week ranges: "next week" / "semaine prochaine" (returns all days of the week)
   * 
   * The result includes a list of all dates in the range for easy iteration.
   * 
   * @param dateString - Natural language date range string
   * @returns NLDRangeResult object with start/end dates and date list, or null if not a range
   * 
   * @example
   * ```typescript
   * const range = plugin.parseDateRange("from Monday to Friday");
   * if (range) {
   *   console.log(range.startDate); // Date for Monday
   *   console.log(range.endDate); // Date for Friday
   *   console.log(range.dateList?.length); // 5
   *   
   *   // Iterate over all dates in range
   *   range.dateList?.forEach(date => {
   *     console.log(date.format("YYYY-MM-DD"));
   *   });
   * }
   * ```
   */
  parseDateRange(dateString: string): import("./parser").NLDRangeResult | null {
    if (!this.parser) {
      this.resetParser();
    }

    // Valider et sanitizer l'entrée utilisateur
    const sanitizedInput = validateUriParam(dateString, 200);
    if (!sanitizedInput) {
      logger.warn("Invalid input in parseDateRange()", { dateString });
      return null;
    }

    return this.parser.getParsedDateRange(sanitizedInput, this.settings.weekStart);
  }

  /**
   * Parses a natural language time string using the plugin's configured time format.
   * 
   * Extracts only the time component from the input and formats it according to settings.
   * Uses the time format from plugin settings (default: "HH:mm").
   * 
   * @param dateString - Natural language time string (e.g., "now", "in 2 hours", "at 3pm")
   * @returns NLDResult object with formatted time string
   * 
   * @example
   * ```typescript
   * // If settings.timeFormat is "HH:mm"
   * const result = plugin.parseTime("in 2 hours");
   * console.log(result.formattedString); // "17:30" (if current time is 15:30)
   * 
   * const result2 = plugin.parseTime("at 3pm");
   * console.log(result2.formattedString); // "15:00"
   * ```
   */
  parseTime(dateString: string): NLDResult {
    // Valider et sanitizer l'entrée utilisateur
    const sanitizedInput = validateUriParam(dateString, 200);
    if (!sanitizedInput) {
      logger.warn("Invalid input in parseTime()", { dateString });
      const invalidDate = new Date(NaN);
      return {
        formattedString: "Invalid date",
        date: invalidDate,
        moment: window.moment(invalidDate),
      };
    }

    // Valider le format de temps
    const timeFormatValidation = validateMomentFormat(this.settings.timeFormat);
    if (!timeFormatValidation.valid) {
      logger.warn("Invalid time format in settings", { format: this.settings.timeFormat, error: timeFormatValidation.error });
      // Utiliser le format par défaut
      return this.parse(sanitizedInput, DEFAULT_SETTINGS.timeFormat);
    }

    return this.parse(sanitizedInput, this.settings.timeFormat);
  }

  /**
   * Checks if a text string contains a time component.
   * 
   * Useful for determining whether to include time formatting in the output.
   * Detects various time expressions in all enabled languages.
   * 
   * @param text - Text string to check for time component
   * @returns true if a time component is detected, false otherwise
   * 
   * @example
   * ```typescript
   * plugin.hasTimeComponent("next Monday at 3pm"); // true
   * plugin.hasTimeComponent("tomorrow"); // false
   * plugin.hasTimeComponent("in 2 hours"); // true
   * plugin.hasTimeComponent("dans 2 heures"); // true (French)
   * ```
   */
  hasTimeComponent(text: string): boolean {
    if (!this.parser) {
      this.resetParser();
    }
    return this.parser.hasTimeComponent(text);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    // Valider et sanitizer les paramètres URI pour éviter les injections
    const day = validateUriParam(params.day, 100);
    if (!day) {
      logger.warn("Invalid day parameter in URI", { day: params.day });
      return;
    }

    const date = this.parseDate(day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      await workspace.getLeaf(newPane).openFile(dailyNote);
    }
  }
}