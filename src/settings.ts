import { App, PluginSettingTab, Setting } from "obsidian";
import NaturalLanguageDates from "./main";
import { getLocaleWeekStart, validateMomentFormat } from "./utils";
import moment from "./window-moment";
import HistoryManagerModal from "./modals/history-manager-modal";
import { tUI, detectUILanguage } from "./lang/ui/helper";

/**
 * Day of the week type for week start preference.
 * Can be a specific day or "locale-default" to use the system locale.
 */
export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";

/**
 * Plugin settings interface.
 * Contains all configuration options for the Natural Language Dates plugin.
 */
export interface NLDSettings {
  autosuggestToggleLink: boolean;
  autocompleteTriggerPhrase: string;
  isAutosuggestEnabled: boolean;

  format: string;
  timeFormat: string;
  separator: string;
  weekStart: DayOfWeek;
  languages: string[];

  english: boolean;
  japanese: boolean;
  french: boolean;
  german: boolean;
  portuguese: boolean;
  dutch: boolean;
  spanish: boolean;
  italian: boolean;
  russian: boolean;
  ukrainian: boolean;
  chinese: boolean;
  korean: boolean;

  modalToggleLink: boolean;
  // Date-only: the Date Picker deliberately never surfaces a time -- there's
  // no time-of-day control anywhere in that modal's UI, so a format
  // including time tokens would only ever display a meaningless constant
  // (the picked date normalized to midnight). Use the "Insert the current
  // date and time" command, or type a full expression into the autosuggest,
  // for anything that actually needs a time.
  modalMomentFormat: string;

  // Periodic-note formats (optional, all default to ""): when an expression
  // resolves to a whole week/month/quarter/year (e.g. "next week", "Q3",
  // "this quarter") instead of a single day, use this format instead of the
  // daily "format" setting above -- for linking to Periodic Notes-style
  // weekly/monthly/quarterly/yearly notes. Leave empty to keep using the
  // daily format (and, for weeks specifically, the existing "next week"
  // multi-day-link behavior) unchanged.
  weekFormat: string;
  monthFormat: string;
  quarterFormat: string;
  yearFormat: string;

  // Smart suggestions
  enableSmartSuggestions: boolean;
  enableHistorySuggestions: boolean;
  enableContextSuggestions: boolean;

  // Smart date formatting
  omitDateForShortRelative: boolean;
}

export const DEFAULT_SETTINGS: NLDSettings = {
  autosuggestToggleLink: true,
  autocompleteTriggerPhrase: "@",
  isAutosuggestEnabled: true,

  format: "YYYY-MM-DD",
  timeFormat: "HH:mm",
  separator: " ",
  weekStart: "locale-default",
  languages: ["en"],

  english: true,  // Synchronized with languages: ["en"]
  japanese: false,
  french: false,
  german: false,
  portuguese: false,
  dutch: false,
  spanish: false,
  italian: false,
  russian: false,
  ukrainian: false,
  chinese: false,
  korean: false,

  modalToggleLink: false,
  modalMomentFormat: "YYYY-MM-DD",

  weekFormat: "",
  monthFormat: "",
  quarterFormat: "",
  yearFormat: "",

  // Smart suggestions
  enableSmartSuggestions: true,
  enableHistorySuggestions: true,
  enableContextSuggestions: true,

  // Smart date formatting
  omitDateForShortRelative: true,
};

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export class NLDSettingsTab extends PluginSettingTab {
  plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const localizedWeekdays = moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();
    // Picked up fresh every time the settings tab is (re)opened: the UI
    // follows Obsidian's own interface language automatically, with no
    // setting of its own. See detectUILanguage()'s own comment for why this
    // doesn't update live while the tab stays open (it doesn't need to --
    // display() reruns whenever the tab is reopened) and why command names
    // in main.ts (set once at onload, unlike this) need a restart to follow
    // a language change made mid-session.
    const lang = detectUILanguage();

    containerEl.empty();

    new Setting(containerEl).setHeading().setName(tUI("heading_main", lang));

    new Setting(containerEl).setHeading().setName(tUI("heading_parser_settings", lang));

    const dateFormatDesc = tUI("date_format_desc", lang);
    const dateFormatSetting = new Setting(containerEl)
      .setName(tUI("date_format_name", lang))
      .setDesc(dateFormatDesc)
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("YYYY-MM-DD")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            const validated = validateMomentFormat(value || "YYYY-MM-DD", lang);
            if (validated.valid) {
              this.plugin.settings.format = value || "YYYY-MM-DD";
              await this.plugin.saveSettings();
              // Mettre à jour la description avec la prévisualisation.
              // validateMomentFormat()'s contract guarantees preview is set
              // whenever valid is true, so the generic-fallback below is
              // unreachable with real data.
              dateFormatSetting.setDesc(validated.preview ? tUI("preview_template", lang, { desc: dateFormatDesc, preview: validated.preview }) : dateFormatDesc);
            } else {
              // Afficher l'erreur dans la description. Every invalid-format
              // return from validateMomentFormat() always sets error, so the
              // generic-fallback below is unreachable with real data.
              dateFormatSetting.setDesc(tUI("error_template", lang, { desc: dateFormatDesc, error: validated.error || tUI("generic_invalid_format", lang) }));
              // Ne pas sauvegarder le format invalide, restaurer le précédent
              text.setValue(this.plugin.settings.format);
            }
          })
      );

    // Afficher la prévisualisation initiale
    const initialValidation = validateMomentFormat(this.plugin.settings.format, lang);
    if (initialValidation.valid && initialValidation.preview) {
      dateFormatSetting.setDesc(tUI("preview_template", lang, { desc: dateFormatDesc, preview: initialValidation.preview }));
    }

    new Setting(containerEl)
      .setName(tUI("week_starts_on_name", lang))
      .setDesc(tUI("week_starts_on_desc", lang))
      .addDropdown((dropdown) => {
        dropdown.addOption("locale-default", tUI("locale_default_option", lang, { day: String(localeWeekStart) }));
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
        dropdown.onChange(async (value: DayOfWeek) => {
          this.plugin.settings.weekStart = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setHeading().setName(tUI("heading_language_settings", lang));

    // Language *names* here are shown as each language's own endonym
    // (e.g. "Français", "日本語") rather than translated into the current
    // UI language -- the same way most multilingual software lists
    // languages, and avoids needing a separate translation of "English"/
    // "French"/etc. into all 12 UI languages on top of the 12 UI languages
    // themselves.
    this.createLanguageSetting(containerEl, lang, "English", "english", "en");
    this.createLanguageSetting(containerEl, lang, "日本語", "japanese", "ja");
    this.createLanguageSetting(containerEl, lang, "Français", "french", "fr");
    this.createLanguageSetting(containerEl, lang, "Deutsch", "german", "de", "note_partially_supported");
    this.createLanguageSetting(containerEl, lang, "Português", "portuguese", "pt", "note_partially_supported");
    this.createLanguageSetting(containerEl, lang, "Nederlands", "dutch", "nl", "note_under_development");
    this.createLanguageSetting(containerEl, lang, "Español", "spanish", "es");
    this.createLanguageSetting(containerEl, lang, "Italiano", "italian", "it");
    this.createLanguageSetting(containerEl, lang, "Русский", "russian", "ru");
    this.createLanguageSetting(containerEl, lang, "Українська", "ukrainian", "uk");
    this.createLanguageSetting(containerEl, lang, "繁體中文", "chinese", "zh.hant", "note_partially_supported");
    this.createLanguageSetting(containerEl, lang, "한국어", "korean", "ko", "note_partially_supported");

    new Setting(containerEl).setHeading().setName(tUI("heading_hotkey_formatting", lang));

    const timeFormatDesc = tUI("time_format_desc", lang);
    const timeFormatSetting = new Setting(containerEl)
      .setName(tUI("time_format_name", lang))
      .setDesc(timeFormatDesc)
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("HH:mm")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value) => {
            const validated = validateMomentFormat(value || "HH:mm", lang);
            if (validated.valid) {
              this.plugin.settings.timeFormat = value || "HH:mm";
              await this.plugin.saveSettings();
              // Mettre à jour la description avec la prévisualisation (see
              // the date-format setting above: the generic-fallback here is
              // similarly unreachable given validateMomentFormat()'s contract).
              timeFormatSetting.setDesc(validated.preview ? tUI("preview_template", lang, { desc: timeFormatDesc, preview: validated.preview }) : timeFormatDesc);
            } else {
              // Afficher l'erreur dans la description (unreachable fallback,
              // same reasoning as the date-format setting above).
              timeFormatSetting.setDesc(tUI("error_template", lang, { desc: timeFormatDesc, error: validated.error || tUI("generic_invalid_format", lang) }));
              // Ne pas sauvegarder le format invalide, restaurer le précédent
              text.setValue(this.plugin.settings.timeFormat);
            }
          })
      );

    // Afficher la prévisualisation initiale
    const initialTimeValidation = validateMomentFormat(this.plugin.settings.timeFormat, lang);
    if (initialTimeValidation.valid && initialTimeValidation.preview) {
      timeFormatSetting.setDesc(tUI("preview_template", lang, { desc: timeFormatDesc, preview: initialTimeValidation.preview }));
    }

    new Setting(containerEl)
      .setName(tUI("separator_name", lang))
      .setDesc(tUI("separator_desc", lang))
      .addText((text) =>
        text
          .setPlaceholder(tUI("separator_placeholder", lang))
          .setValue(this.plugin.settings.separator)
          .onChange(async (value) => {
            this.plugin.settings.separator = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName(tUI("heading_date_autosuggest", lang));

    new Setting(containerEl)
      .setName(tUI("enable_autosuggest_name", lang))
      .setDesc(
        tUI("enable_autosuggest_desc", lang, { trigger: this.plugin.settings.autocompleteTriggerPhrase })
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isAutosuggestEnabled)
          .onChange(async (value) => {
            this.plugin.settings.isAutosuggestEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(tUI("add_as_link_name", lang))
      .setDesc(tUI("add_as_link_desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autosuggestToggleLink)
          .onChange(async (value) => {
            this.plugin.settings.autosuggestToggleLink = value;
            await this.plugin.saveSettings();
          })
      );

    const triggerPhraseDesc = tUI("trigger_phrase_desc", lang);
    const triggerPhraseSetting = new Setting(containerEl)
      .setName(tUI("trigger_phrase_name", lang))
      .setDesc(triggerPhraseDesc)
      .addMomentFormat((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.autocompleteTriggerPhrase)
          .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.autocompleteTriggerPhrase = trimmed;
              await this.plugin.saveSettings();
              triggerPhraseSetting.setDesc(triggerPhraseDesc);
            } else {
              // An empty trigger phrase makes onTrigger()'s
              // query.startsWith(triggerPhrase) always true, so the
              // autosuggest popup would fire on virtually every keystroke.
              // Refuse to save it, matching the Date/Time format fields above.
              triggerPhraseSetting.setDesc(tUI("error_template", lang, { desc: triggerPhraseDesc, error: tUI("trigger_phrase_empty_error", lang) }));
              text.setValue(this.plugin.settings.autocompleteTriggerPhrase || "@");
            }
          })
      );

    new Setting(containerEl).setHeading().setName(tUI("heading_smart_suggestions", lang));

    new Setting(containerEl)
      .setName(tUI("enable_smart_suggestions_name", lang))
      .setDesc(tUI("enable_smart_suggestions_desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSmartSuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableSmartSuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(tUI("history_based_name", lang))
      .setDesc(tUI("history_based_desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableHistorySuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableHistorySuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(tUI("context_based_name", lang))
      .setDesc(tUI("context_based_desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableContextSuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableContextSuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(tUI("manage_history_name", lang))
      .setDesc(tUI("manage_history_desc", lang))
      .addButton((button) =>
        button
          .setButtonText(tUI("manage_history_button", lang))
          .onClick(() => {
            new HistoryManagerModal(this.app, this.plugin).open();
          })
      );

    new Setting(containerEl).setHeading().setName(tUI("heading_date_formatting", lang));

    new Setting(containerEl)
      .setName(tUI("omit_date_name", lang))
      .setDesc(tUI("omit_date_desc", lang))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.omitDateForShortRelative)
          .onChange(async (value) => {
            this.plugin.settings.omitDateForShortRelative = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName(tUI("heading_periodic_notes", lang));

    this.createPeriodicFormatSetting(containerEl, lang, tUI("week_format_name", lang), "weekFormat", "GGGG-[W]WW", "next week");
    this.createPeriodicFormatSetting(containerEl, lang, tUI("month_format_name", lang), "monthFormat", "YYYY-MM", "next month");
    this.createPeriodicFormatSetting(containerEl, lang, tUI("quarter_format_name", lang), "quarterFormat", "YYYY-[Q]Q", "next quarter, Q3");
    this.createPeriodicFormatSetting(containerEl, lang, tUI("year_format_name", lang), "yearFormat", "YYYY", "next year");
  }

  protected createPeriodicFormatSetting(
    containerEl: HTMLElement,
    lang: string,
    name: string,
    settingKey: "weekFormat" | "monthFormat" | "quarterFormat" | "yearFormat",
    placeholder: string,
    // Deliberately left untranslated: these are literal example *input*
    // expressions (what the user would type), not UI prose -- translating
    // them per UI language would mean claiming they parse correctly in that
    // language specifically, which hasn't been verified (see CLAUDE.md's
    // rule on verifying anything touching parsing/autosuggest across
    // languages before claiming it works).
    examples: string
  ): Setting {
    const baseDesc = tUI("periodic_format_desc", lang, { examples });

    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(baseDesc)
      .addMomentFormat((text) =>
        text
          .setPlaceholder(placeholder)
          .setValue(this.plugin.settings[settingKey])
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              this.plugin.settings[settingKey] = "";
              await this.plugin.saveSettings();
              setting.setDesc(baseDesc);
              return;
            }
            const validated = validateMomentFormat(trimmed, lang);
            if (validated.valid) {
              this.plugin.settings[settingKey] = trimmed;
              await this.plugin.saveSettings();
              setting.setDesc(validated.preview ? tUI("preview_template", lang, { desc: baseDesc, preview: validated.preview }) : baseDesc);
            } else {
              setting.setDesc(tUI("error_template", lang, { desc: baseDesc, error: validated.error || tUI("generic_invalid_format", lang) }));
              text.setValue(this.plugin.settings[settingKey]);
            }
          })
      );

    if (this.plugin.settings[settingKey]) {
      const initialValidation = validateMomentFormat(this.plugin.settings[settingKey], lang);
      if (initialValidation.valid && initialValidation.preview) {
        setting.setDesc(tUI("preview_template", lang, { desc: baseDesc, preview: initialValidation.preview }));
      }
    }

    return setting;
  }

  protected createLanguageSetting(containerEl: HTMLElement, lang: string, text: string, settingKey: keyof NLDSettings, code: string, noteKey?: string) : Setting {
    const note = noteKey ? ` (${tUI(noteKey, lang)})` : "";
    return new Setting(containerEl)
      .setName(text)
      .setDesc(tUI("language_toggle_desc", lang, { language: text }) + note)
      .addToggle(l =>
        l
          .setValue(this.plugin.settings[settingKey] as boolean)
          .onChange(async (v) => {
            (this.plugin.settings[settingKey] as boolean) = v;
            this.editLanguages(code, v);
            await this.plugin.saveSettings();
            this.plugin.resetParser();
          }));
  }

  protected editLanguages(code: string, enabled: boolean): void {
    if (enabled) {
      if (!this.plugin.settings.languages.includes(code)) {
        this.plugin.settings.languages.push(code);
      }
    } else {
      const index = this.plugin.settings.languages.indexOf(code);
      if (index > -1) {
        this.plugin.settings.languages.splice(index, 1);
      }
    }
  }
}