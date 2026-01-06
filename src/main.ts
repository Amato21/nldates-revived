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
import { getOrCreateDailyNote, parseTruthy } from "./utils";
import { DateFormatter } from "./date-formatter";
import HistoryManager from "./history-manager";
import ContextAnalyzer from "./context-analyzer";
import { logger } from "./logger";
import { NLDParseError, ErrorCodes } from "./errors";

export default class NaturalLanguageDates extends Plugin {
  public parser: NLDParser;
  public settings: NLDSettings;
  public historyManager: HistoryManager;
  public contextAnalyzer: ContextAnalyzer;

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
        this.app.notifications.create({
          msg: 'Natural Language Dates: Failed to initialize with selected languages. Using English as fallback.',
          duration: 5000,
        });
      } catch (fallbackError) {
        logger.error('Failed to initialize parser even with English fallback', { error: fallbackError });
        this.app.notifications.create({
          msg: 'Natural Language Dates: Critical error - parser initialization failed. Please restart Obsidian.',
          duration: 10000,
        });
      }
    }
    
    // Reset context patterns when languages change
    if (this.contextAnalyzer) {
      this.contextAnalyzer.resetPatterns();
    }
  }

  onunload(): void {
    // Plugin unloaded
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

  /*
    @param dateString: A string that contains a date in natural language, e.g. today, tomorrow, next week
    @param format: A string that contains the formatting string for a Moment
    @returns NLDResult: An object containing the date, a cloned Moment and the formatted string.
  */
  parse(dateString: string, format: string): NLDResult {
    if (!this.parser) {
      // Parser not yet initialized, initialize it now
      this.resetParser();
    }
    const date = this.parser.getParsedDate(dateString, this.settings.weekStart);
    const formattedString = DateFormatter.format(date, format);
    if (formattedString === "Invalid date") {
      logger.debug("Input date can't be parsed by nldates", { dateString });
    }

    return {
      formattedString,
      date,
      moment: window.moment(date),
    };
  }

  /*
    @param dateString: A string that contains a date in natural language, e.g. today, tomorrow, next week
    @returns NLDResult: An object containing the date, a cloned Moment and the formatted string.
  */
  parseDate(dateString: string): NLDResult {
    // 1. Ask the parser if time is detected
    const hasTime = this.parser.hasTimeComponent(dateString);
    let formatToUse = this.settings.format;

    // 2. If time is detected...
    if (hasTime) {
      const timeFormat = this.settings.timeFormat || "HH:mm";
      
      // TIP: Here we format "Date TIME."
      // But BEWARE: it is the "date-suggest.ts" file that will add the [[ ]].
      // If we don't touch date-suggest, it will make [[Date Time]].
      // To make [[Date]] Time, we have to be clever.
      
      formatToUse = `${formatToUse} ${timeFormat}`;
    }

    const result = this.parse(dateString, formatToUse);
    return result;
  }

  /*
    @param dateString: A string that contains a date range in natural language, e.g. "from Monday to Friday", "next week"
    @returns NLDRangeResult | null: An object containing the date range, or null if not a range
  */
  parseDateRange(dateString: string): import("./parser").NLDRangeResult | null {
    if (!this.parser) {
      this.resetParser();
    }
    return this.parser.getParsedDateRange(dateString, this.settings.weekStart);
  }

  parseTime(dateString: string): NLDResult {
    return this.parse(dateString, this.settings.timeFormat);
  }

  hasTimeComponent(text: string): boolean {
    if (!this.parser) {
      this.resetParser();
    }
    return this.parser.hasTimeComponent(text);
  }

  async actionHandler(params: ObsidianProtocolData): Promise<void> {
    const { workspace } = this.app;

    const date = this.parseDate(params.day);
    const newPane = parseTruthy(params.newPane || "yes");

    if (date.moment.isValid()) {
      const dailyNote = await getOrCreateDailyNote(date.moment);
      await workspace.getLeaf(newPane).openFile(dailyNote);
    }
  }
}