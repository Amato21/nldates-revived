import { App, PluginSettingTab, Setting } from "obsidian";
import NaturalLanguageDates from "./main";
import { getLocaleWeekStart } from "./utils";

export type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";

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

  modalToggleTime: boolean;
  modalToggleLink: boolean;
  modalMomentFormat: string;

  // Smart suggestions
  enableSmartSuggestions: boolean;
  enableHistorySuggestions: boolean;
  enableContextSuggestions: boolean;
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

  english: true,  // Synchronisé avec languages: ["en"]
  japanese: false,
  french: false,
  german: false,
  portuguese: false,
  dutch: false,
  spanish: false,
  italian: false,

  modalToggleTime: false,
  modalToggleLink: false,
  modalMomentFormat: "YYYY-MM-DD HH:mm",

  // Smart suggestions
  enableSmartSuggestions: true,
  enableHistorySuggestions: true,
  enableContextSuggestions: true,
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
    const localizedWeekdays = window.moment.weekdays();
    const localeWeekStart = getLocaleWeekStart();

    containerEl.empty();

    new Setting(containerEl).setHeading().setName("Natural language dates");

    new Setting(containerEl).setHeading().setName("Parser settings");

    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Output format for parsed dates")
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("YYYY-MM-DD")
          .setValue(this.plugin.settings.format)
          .onChange(async (value) => {
            this.plugin.settings.format = value || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Week starts on")
      .setDesc("Which day to consider as the start of the week")
      .addDropdown((dropdown) => {
        dropdown.addOption("locale-default", `Locale default (${String(localeWeekStart)})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
        dropdown.onChange(async (value: DayOfWeek) => {
          this.plugin.settings.weekStart = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setHeading().setName("Language settings");

    this.createLanguageSetting(containerEl, "English", "english", "en");
    this.createLanguageSetting(containerEl, "Japanese", "japanese", "ja");
    this.createLanguageSetting(containerEl, "French", "french", "fr");
    this.createLanguageSetting(containerEl, "German", "german", "de", "partially supported");
    this.createLanguageSetting(containerEl, "Portuguese", "portuguese", "pt", "partially supported");
    this.createLanguageSetting(containerEl, "Dutch", "dutch", "nl", "under development");
    this.createLanguageSetting(containerEl, "Spanish", "spanish", "es");
    this.createLanguageSetting(containerEl, "Italian", "italian", "it");

    new Setting(containerEl).setHeading().setName("Hotkey formatting settings");

    new Setting(containerEl)
      .setName("Time format")
      .setDesc("Format for the hotkeys that include the current time")
      .addMomentFormat((text) =>
        text
          .setDefaultFormat("HH:mm")
          .setValue(this.plugin.settings.timeFormat)
          .onChange(async (value) => {
            this.plugin.settings.timeFormat = value || "HH:mm";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Separator")
      .setDesc("Separator between date and time for entries that have both")
      .addText((text) =>
        text
          .setPlaceholder("Separator is empty")
          .setValue(this.plugin.settings.separator)
          .onChange(async (value) => {
            this.plugin.settings.separator = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Date autosuggest");

    new Setting(containerEl)
      .setName("Enable date autosuggest")
      .setDesc(
        `Input dates with natural language. Open the suggest menu with ${this.plugin.settings.autocompleteTriggerPhrase}`
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
      .setName("Add dates as link?")
      .setDesc(
        "If enabled, dates created via autosuggest will be wrapped in [[wikilinks]]"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autosuggestToggleLink)
          .onChange(async (value) => {
            this.plugin.settings.autosuggestToggleLink = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Trigger phrase")
      .setDesc("Character(s) that will cause the date autosuggest to open")
      .addMomentFormat((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.autocompleteTriggerPhrase)
          .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
          .onChange(async (value) => {
            this.plugin.settings.autocompleteTriggerPhrase = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Smart suggestions");

    new Setting(containerEl)
      .setName("Enable smart suggestions")
      .setDesc(
        "Enable intelligent suggestions based on your usage history and document context"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSmartSuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableSmartSuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("History-based suggestions")
      .setDesc(
        "Learn from your frequently used date patterns and prioritize them in suggestions"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableHistorySuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableHistorySuggestions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Context-based suggestions")
      .setDesc(
        "Suggest dates based on dates already present in the current document"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableContextSuggestions)
          .onChange(async (value) => {
            this.plugin.settings.enableContextSuggestions = value;
            await this.plugin.saveSettings();
          })
      );
  }

  protected createLanguageSetting(containerEl: HTMLElement, text: string, settingKey: keyof NLDSettings, code: string, note?: string) : Setting {
    note = note ? ` (${note})` : "";
    return new Setting(containerEl)
      .setName(text)
      .setDesc(`Whether to parse ${text} or not` + note)
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
      this.plugin.settings.languages.remove(code);
    }
  }
}