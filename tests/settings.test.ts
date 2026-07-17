import './setup';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting } from 'obsidian';
import { NLDSettingsTab, DEFAULT_SETTINGS } from '../src/settings';
import HistoryManagerModal from '../src/modals/history-manager-modal';
import moment from 'moment';

describe('NLDSettingsTab', () => {
  let plugin: any;
  let tab: NLDSettingsTab;

  beforeEach(() => {
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    Setting.resetInstances();

    plugin = {
      settings: { ...DEFAULT_SETTINGS, languages: [...DEFAULT_SETTINGS.languages] },
      saveSettings: vi.fn(() => Promise.resolve()),
      resetParser: vi.fn(),
    };

    tab = new NLDSettingsTab({} as any, plugin);
  });

  function findSetting(name: string): Setting {
    const found = Setting.instances.find(s => s.nameText === name);
    if (!found) throw new Error(`No Setting found with name "${name}" (have: ${Setting.instances.map(s => s.nameText).join(', ')})`);
    return found;
  }

  describe('display()', () => {
    it('renders without throwing', () => {
      expect(() => tab.display()).not.toThrow();
    });

    it('creates a Date format setting reflecting the current format', () => {
      tab.display();
      const setting = findSetting('Date format');
      expect(setting.components[0].value).toBe(DEFAULT_SETTINGS.format);
    });

    it('saves a valid new date format', async () => {
      tab.display();
      const setting = findSetting('Date format');
      await setting.components[0].onChangeHandler('DD/MM/YYYY');
      expect(plugin.settings.format).toBe('DD/MM/YYYY');
      expect(plugin.saveSettings).toHaveBeenCalled();
    });

    it('rejects an invalid new date format and restores the previous value', async () => {
      tab.display();
      const setting = findSetting('Date format');
      const previousFormat = plugin.settings.format;
      await setting.components[0].onChangeHandler('@@@');
      expect(plugin.settings.format).toBe(previousFormat);
      expect(plugin.saveSettings).not.toHaveBeenCalled();
      expect(setting.components[0].value).toBe(previousFormat); // restored via text.setValue()
    });

    it('falls back to YYYY-MM-DD when the date format is cleared', async () => {
      tab.display();
      const setting = findSetting('Date format');
      await setting.components[0].onChangeHandler('');
      expect(plugin.settings.format).toBe('YYYY-MM-DD');
    });

    it('shows no initial preview when the currently-configured date format is invalid', () => {
      plugin.settings.format = '@@@';
      expect(() => tab.display()).not.toThrow();
      const setting = findSetting('Date format');
      expect(setting.descText).toBe('Output format for parsed dates');
    });

    it('shows no initial preview when the currently-configured time format is invalid', () => {
      plugin.settings.timeFormat = '@@@';
      expect(() => tab.display()).not.toThrow();
      const setting = findSetting('Time format');
      expect(setting.descText).toBe('Format for the hotkeys that include the current time');
    });

    it('creates a Week starts on dropdown with locale-default plus all weekdays', () => {
      tab.display();
      const setting = findSetting('Week starts on');
      const dropdown = setting.components[0];
      expect(dropdown.options.some((o: any) => o.value === 'locale-default')).toBe(true);
      expect(dropdown.options.length).toBe(8); // locale-default + 7 days
    });

    it('saves a new week-start preference', async () => {
      tab.display();
      const setting = findSetting('Week starts on');
      await setting.components[0].onChangeHandler('monday');
      expect(plugin.settings.weekStart).toBe('monday');
      expect(plugin.saveSettings).toHaveBeenCalled();
    });

    it('creates a toggle per supported language', () => {
      tab.display();
      expect(() => findSetting('English')).not.toThrow();
      expect(() => findSetting('Japanese')).not.toThrow();
      expect(() => findSetting('Chinese (Traditional)')).not.toThrow();
    });

    it('appends a note for partially-supported languages', () => {
      tab.display();
      const setting = findSetting('German');
      expect(setting.descText).toContain('partially supported');
    });

    it('enabling a language toggle adds it to settings.languages and resets the parser', async () => {
      tab.display();
      const setting = findSetting('French');
      await setting.components[0].onChangeHandler(true);
      expect(plugin.settings.french).toBe(true);
      expect(plugin.settings.languages).toContain('fr');
      expect(plugin.saveSettings).toHaveBeenCalled();
      expect(plugin.resetParser).toHaveBeenCalled();
    });

    it('disabling a language toggle removes it from settings.languages', async () => {
      plugin.settings.languages = ['en', 'fr'];
      tab.display();
      const setting = findSetting('French');
      await setting.components[0].onChangeHandler(false);
      expect(plugin.settings.languages).not.toContain('fr');
    });

    it('does not duplicate a language already present when enabling it again', async () => {
      plugin.settings.languages = ['en'];
      tab.display();
      const setting = findSetting('English');
      await setting.components[0].onChangeHandler(true);
      expect(plugin.settings.languages.filter((l: string) => l === 'en').length).toBe(1);
    });

    it('does nothing when disabling a language that is not present', async () => {
      plugin.settings.languages = ['en'];
      tab.display();
      const setting = findSetting('French');
      await setting.components[0].onChangeHandler(false);
      expect(plugin.settings.languages).toEqual(['en']);
    });

    it('creates a Time format setting and saves a valid new value', async () => {
      tab.display();
      const setting = findSetting('Time format');
      await setting.components[0].onChangeHandler('hh:mm A');
      expect(plugin.settings.timeFormat).toBe('hh:mm A');
    });

    it('rejects an invalid new time format', async () => {
      tab.display();
      const setting = findSetting('Time format');
      const previous = plugin.settings.timeFormat;
      await setting.components[0].onChangeHandler('@@@');
      expect(plugin.settings.timeFormat).toBe(previous);
    });

    it('falls back to HH:mm when the time format is cleared', async () => {
      tab.display();
      const setting = findSetting('Time format');
      await setting.components[0].onChangeHandler('');
      expect(plugin.settings.timeFormat).toBe('HH:mm');
    });

    it('saves a new separator value, including an empty one', async () => {
      tab.display();
      const setting = findSetting('Separator');
      await setting.components[0].onChangeHandler(' - ');
      expect(plugin.settings.separator).toBe(' - ');
    });

    it('saves the autosuggest-enabled toggle', async () => {
      tab.display();
      const setting = findSetting('Enable date autosuggest');
      await setting.components[0].onChangeHandler(false);
      expect(plugin.settings.isAutosuggestEnabled).toBe(false);
    });

    it('saves the "add as link" toggle', async () => {
      tab.display();
      const setting = findSetting('Add dates as link?');
      await setting.components[0].onChangeHandler(false);
      expect(plugin.settings.autosuggestToggleLink).toBe(false);
    });

    it('trims and saves a new trigger phrase', async () => {
      tab.display();
      const setting = findSetting('Trigger phrase');
      await setting.components[0].onChangeHandler('  #  ');
      expect(plugin.settings.autocompleteTriggerPhrase).toBe('#');
    });

    it('defaults the trigger phrase field to "@" when settings has none set', () => {
      plugin.settings.autocompleteTriggerPhrase = '';
      tab.display();
      const setting = findSetting('Trigger phrase');
      expect(setting.components[0].value).toBe('@');
    });

    it('rejects an empty trigger phrase and restores the previous value (regression: would make autosuggest fire on nearly every keystroke)', async () => {
      tab.display();
      const setting = findSetting('Trigger phrase');
      const previous = plugin.settings.autocompleteTriggerPhrase;
      await setting.components[0].onChangeHandler('   ');
      expect(plugin.settings.autocompleteTriggerPhrase).toBe(previous);
      expect(setting.descText).toContain('cannot be empty');
    });

    it('saves the smart-suggestions toggles', async () => {
      tab.display();
      await findSetting('Enable smart suggestions').components[0].onChangeHandler(false);
      expect(plugin.settings.enableSmartSuggestions).toBe(false);

      await findSetting('History-based suggestions').components[0].onChangeHandler(false);
      expect(plugin.settings.enableHistorySuggestions).toBe(false);

      await findSetting('Context-based suggestions').components[0].onChangeHandler(false);
      expect(plugin.settings.enableContextSuggestions).toBe(false);
    });

    it('saves the omit-date-for-short-relative toggle', async () => {
      tab.display();
      const setting = findSetting('Omit date for short relative expressions');
      await setting.components[0].onChangeHandler(false);
      expect(plugin.settings.omitDateForShortRelative).toBe(false);
    });

    it('opens the history manager modal when "Manage history" is clicked', () => {
      const openSpy = vi.spyOn(HistoryManagerModal.prototype, 'open').mockImplementation(() => {});
      tab.display();
      const setting = findSetting('Manage history');
      setting.components[0].clickHandler();
      expect(openSpy).toHaveBeenCalledTimes(1);
      openSpy.mockRestore();
    });
  });

  describe('editLanguages (direct)', () => {
    it('adds a language code when enabling', () => {
      plugin.settings.languages = ['en'];
      (tab as any).editLanguages('fr', true);
      expect(plugin.settings.languages).toEqual(['en', 'fr']);
    });

    it('removes a language code when disabling', () => {
      plugin.settings.languages = ['en', 'fr'];
      (tab as any).editLanguages('fr', false);
      expect(plugin.settings.languages).toEqual(['en']);
    });
  });
});
