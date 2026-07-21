import { App, Modal, Setting } from "obsidian";
import { generateMarkdownLink, getLocaleWeekStart, validateMomentFormat, getActiveEditor } from "../utils";
import type NaturalLanguageDates from "../main";
import { DEFAULT_SETTINGS } from "../settings";
import t from "../lang/helper";
import moment from "../window-moment";

type Moment = import("moment").Moment;

export default class DatePickerModal extends Modal {
  plugin: NaturalLanguageDates;
  private selectedDate: Moment;
  private currentMonth: Moment;
  private calendarEl: HTMLElement | null = null;
  private quickButtonsEl: HTMLElement | null = null;
  private previewEl: HTMLElement | null = null;
  private dateInputEl: HTMLInputElement | null = null;
  private isDarkMode: boolean;
  private themeObserver: MutationObserver | null = null;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
  private updateSelectedDateFn: ((date: Moment) => void) | null = null;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
    // Normalized to midnight: this is a date picker, not a time picker, and
    // nothing in the UI lets the user set a time-of-day. Carrying the real
    // current wall-clock time here (moment()) meant that opening the modal
    // and immediately inserting produced whatever the clock happened to
    // read, not a clean date -- and getDateStr() below formats *some*
    // moment with a format string that includes "HH:mm" by default.
    this.selectedDate = moment().startOf("day");
    this.currentMonth = moment();
    // Détecter le mode sombre
    this.isDarkMode = activeDocument.body.classList.contains("theme-dark");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("nld-date-picker-modal");

    // Ajouter les styles pour le mode sombre
    if (this.isDarkMode) {
      contentEl.addClass("nld-dark-mode");
    }

    let momentFormat = this.plugin.settings.modalMomentFormat;
    let insertAsLink = this.plugin.settings.modalToggleLink;
    let dateInput = "";

    // Strips the trailing "|" that marks "keep as alias" (see shouldIncludeAlias
    // below) -- shared so the input's onChange handler and getDateStr() agree
    // on exactly what text gets parsed/cached.
    const stripAliasSuffix = (text: string): string =>
      text.endsWith("|") ? text.slice(0, -1) : text;

    let cachedManualParse: { input: string; moment: Moment } | null = null;

    // Parses manually-typed text via the NLP parser, caching the result.
    // Called from both the input's onChange handler (to validate/update the
    // calendar selection) and getDateStr() (to build the preview/output) --
    // without the cache, typing a single character invoked
    // plugin.parseDate() 2-3 times (onChange's own validation call, then
    // updateSelectedDate -> updatePreview -> getDateStr, plus onChange's
    // trailing updatePreview() call), which matters since NLP parsing isn't
    // free.
    const parseManualInput = (cleanText: string): Moment => {
      if (cachedManualParse && cachedManualParse.input === cleanText) {
        return cachedManualParse.moment;
      }
      const parsedMoment = this.plugin.parseDate(cleanText).moment;
      cachedManualParse = { input: cleanText, moment: parsedMoment };
      return parsedMoment;
    };

    const getDateStr = () => {
      const shouldIncludeAlias = dateInput.endsWith("|");
      const cleanDateInput = stripAliasSuffix(dateInput);

      // Valider le format avant utilisation
      const formatValidation = validateMomentFormat(momentFormat);
      const formatToUse = formatValidation.valid ? momentFormat : DEFAULT_SETTINGS.modalMomentFormat;

      // Only round-trip through the NLP parser when the user actually typed
      // something in the manual field -- that's free-form text that may
      // genuinely include a time (e.g. "today at 3pm") and needs parsing.
      // this.selectedDate (calendar clicks, quick-select buttons) is
      // already a resolved, correctly-timed moment with nothing left to
      // parse: re-deriving it by formatting to a bare "YYYY-MM-DD" string
      // and feeding that back into the NLP parser silently lost whatever
      // time-of-day this.selectedDate actually had, and chrono-node defaults
      // a date given with no time component to noon -- so every calendar
      // click or quick-button pick previously inserted "12:00" regardless
      // of the actual selection.
      const momentToFormat = cleanDateInput
        ? parseManualInput(cleanDateInput)
        : this.selectedDate;

      let parsedDateString = momentToFormat.isValid()
        ? momentToFormat.format(formatToUse)
        : "";

      if (insertAsLink) {
        parsedDateString = generateMarkdownLink(
          this.app,
          parsedDateString,
          shouldIncludeAlias ? cleanDateInput : undefined
        );
      }

      return parsedDateString;
    };

    const updatePreview = () => {
      if (this.previewEl) {
        this.previewEl.setText(getDateStr());
      }
    };

    // syncInput controls whether the raw text field gets overwritten with
    // the formatted date. Calendar clicks/quick buttons/keyboard nav want
    // that (it's how the field reflects the selection), but the field's own
    // onChange handler must NOT sync itself while the user is still typing
    // into it -- getDateStr()/updatePreview() already show a live preview
    // of the parsed result separately, without touching what's being typed.
    const updateSelectedDate = (date: Moment, syncInput = true) => {
      this.selectedDate = date.clone();
      if (syncInput && this.dateInputEl) {
        this.dateInputEl.value = date.format("YYYY-MM-DD");
      }
      updatePreview();
      this.renderCalendar();
    };

    // Stocker la fonction pour qu'elle soit accessible depuis renderCalendar
    this.updateSelectedDateFn = updateSelectedDate;

    // Container principal
    const container = contentEl.createDiv("nld-date-picker-container");

    // Section des boutons rapides
    this.quickButtonsEl = container.createDiv("nld-quick-buttons");
    this.renderQuickButtons(updateSelectedDate);

    // Section du calendrier
    const calendarSection = container.createDiv("nld-calendar-section");
    
    // Navigation du calendrier
    const navEl = calendarSection.createDiv("nld-calendar-nav");
    const prevMonthBtn = navEl.createEl("button", {
      cls: "nld-nav-btn",
      text: "‹",
      attr: { "aria-label": "Mois précédent" }
    });
    
    const monthYearEl = navEl.createDiv("nld-month-year");
    
    const nextMonthBtn = navEl.createEl("button", {
      cls: "nld-nav-btn",
      text: "›",
      attr: { "aria-label": "Mois suivant" }
    });

    prevMonthBtn.addEventListener("click", () => {
      this.currentMonth.subtract(1, "month");
      this.renderCalendar();
      this.updateMonthYearDisplay(monthYearEl);
    });

    nextMonthBtn.addEventListener("click", () => {
      this.currentMonth.add(1, "month");
      this.renderCalendar();
      this.updateMonthYearDisplay(monthYearEl);
    });

    // Sélecteur d'année (dropdown)
    const yearSelect = navEl.createEl("select", { cls: "nld-year-select" });
    const currentYear = this.currentMonth.year();
    for (let year = currentYear - 10; year <= currentYear + 10; year++) {
      const option = yearSelect.createEl("option", { text: String(year), value: String(year) });
      if (year === currentYear) {
        option.selected = true;
      }
    }
    yearSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentMonth.year(parseInt(target.value));
      this.renderCalendar();
      this.updateMonthYearDisplay(monthYearEl);
    });

    // Sélecteur de mois (dropdown)
    const monthSelect = navEl.createEl("select", { cls: "nld-month-select" });
    const monthNames = moment.months();
    monthNames.forEach((month, index) => {
      const option = monthSelect.createEl("option", { text: month, value: String(index) });
      if (index === this.currentMonth.month()) {
        option.selected = true;
      }
    });
    monthSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentMonth.month(parseInt(target.value));
      this.renderCalendar();
      this.updateMonthYearDisplay(monthYearEl);
    });

    this.updateMonthYearDisplay(monthYearEl);

    // Calendrier
    this.calendarEl = calendarSection.createDiv("nld-calendar");
    this.renderCalendar();

    // Section de saisie manuelle
    const inputSection = container.createDiv("nld-input-section");
    const dateInputEl = new Setting(inputSection)
      .setName("Date")
      .setDesc("")
      .addText((textEl) => {
        textEl.setPlaceholder("Today");
        textEl.setValue(this.selectedDate.format("YYYY-MM-DD"));
        this.dateInputEl = textEl.inputEl;

        textEl.onChange((value) => {
          dateInput = value;
          if (value) {
            const parsedMoment = parseManualInput(stripAliasSuffix(value));
            if (parsedMoment.isValid()) {
              // updateSelectedDate() already calls updatePreview() itself;
              // an unconditional call below on top of this would just
              // re-run getDateStr() (and, before parseManualInput()'s
              // caching, re-invoke the NLP parser) for no reason.
              updateSelectedDate(parsedMoment, false);
              return;
            }
          }
          updatePreview();
        });

        window.setTimeout(() => textEl.inputEl.focus(), 10);
      });
    this.previewEl = dateInputEl.descEl;
    updatePreview();

    // Options de format
    const formatSetting = new Setting(inputSection)
      .setName("Date format")
      .setDesc("Moment format to be used")
      .addMomentFormat((momentEl) => {
        momentEl.setPlaceholder("YYYY-MM-DD HH:mm");
        momentEl.setValue(momentFormat);
        momentEl.onChange((value) => {
          const validated = validateMomentFormat(value.trim() || "YYYY-MM-DD HH:mm");
          if (validated.valid) {
            momentFormat = value.trim() || "YYYY-MM-DD HH:mm";
            this.plugin.settings.modalMomentFormat = momentFormat;
            void this.plugin.saveSettings();
            updatePreview();
            // Mettre à jour la description avec la prévisualisation
            formatSetting.setDesc(`Moment format to be used${validated.preview ? ` (Preview: ${validated.preview})` : ""}`);
          } else {
            // Afficher l'erreur dans la description
            formatSetting.setDesc(`Moment format to be used - ⚠️ ${validated.error || "Format invalide"}`);
            // Ne pas sauvegarder le format invalide, restaurer le précédent
            momentEl.setValue(momentFormat);
          }
        });
      });
    
    // Afficher la prévisualisation initiale
    const initialValidation = validateMomentFormat(momentFormat);
    if (initialValidation.valid && initialValidation.preview) {
      formatSetting.setDesc(`Moment format to be used (Preview: ${initialValidation.preview})`);
    }

    new Setting(inputSection)
      .setName("Add as link?")
      .addToggle((toggleEl) => {
        toggleEl.setValue(this.plugin.settings.modalToggleLink).onChange((value) => {
          insertAsLink = value;
          this.plugin.settings.modalToggleLink = insertAsLink;
          void this.plugin.saveSettings();
          updatePreview();
        });
      });

    // Boutons d'action
    inputSection.createDiv("modal-button-container", (buttonContainerEl) => {
      buttonContainerEl
        .createEl("button", { attr: { type: "button" }, text: "Never mind" })
        .addEventListener("click", () => this.close());
      buttonContainerEl.createEl("button", {
        attr: { type: "button" },
        cls: "mod-cta",
        text: "Insert date",
      }).addEventListener("click", () => {
        this.insertDate(getDateStr());
      });
    });

    // Raccourcis clavier
    this.keyboardHandler = this.createKeyboardHandler(prevMonthBtn, nextMonthBtn, updateSelectedDate);
    this.contentEl.addEventListener("keydown", this.keyboardHandler);

    // Observer les changements de thème
    this.setupThemeObserver();
  }

  private renderQuickButtons(updateSelectedDate: (date: Moment) => void): void {
    if (!this.quickButtonsEl) return;

    this.quickButtonsEl.empty();
    this.quickButtonsEl.createDiv({ cls: "nld-quick-buttons-label", text: "Quick select:" });

    const primaryLang = this.plugin.settings.languages[0] || "en";
    
    // Fonction helper pour obtenir la première variante d'une traduction
    const getFirstVariant = (key: string): string => {
      const translation = t(key, primaryLang);
      if (translation === "NOTFOUND") {
        return key;
      }
      // Prendre la première variante si plusieurs (séparées par |)
      return translation.split("|")[0].trim();
    };

    // .startOf("day") on every option: without it these carried the real
    // current wall-clock time (e.g. clicking "Tomorrow" at 14:32 selected
    // tomorrow at 14:32, not a clean date), inconsistent with calendar-grid
    // clicks (already midnight-based) and liable to the same "unexpected
    // time baked into the output" confusion as the getDateStr() bug above.
    const quickOptions = [
      {
        label: getFirstVariant("today"),
        moment: moment().startOf("day")
      },
      {
        label: getFirstVariant("tomorrow"),
        moment: moment().add(1, "day").startOf("day")
      },
      {
        label: getFirstVariant("yesterday"),
        moment: moment().subtract(1, "day").startOf("day")
      },
      {
        label: `${getFirstVariant("next")} ${getFirstVariant("week")}`,
        moment: moment().add(1, "week").startOf("day")
      },
      {
        label: `${getFirstVariant("next")} ${getFirstVariant("month")}`,
        moment: moment().add(1, "month").startOf("day")
      },
      {
        label: `${getFirstVariant("next")} ${getFirstVariant("year")}`,
        moment: moment().add(1, "year").startOf("day")
      },
    ];

    const buttonsContainer = this.quickButtonsEl.createDiv("nld-quick-buttons-grid");

    quickOptions.forEach((option) => {
      const button = buttonsContainer.createEl("button", {
        cls: "nld-quick-btn",
        text: option.label,
      });

      button.addEventListener("click", () => {
        updateSelectedDate(option.moment);
        this.currentMonth = option.moment.clone();
        this.renderCalendar();
      });
    });
  }

  private renderCalendar(): void {
    if (!this.calendarEl) return;

    this.calendarEl.empty();

    // En-têtes des jours de la semaine
    const weekStart = this.plugin.settings.weekStart === "locale-default"
      ? getLocaleWeekStart()
      : this.plugin.settings.weekStart;
    
    const weekStartIndex = weekStart === "sunday" ? 0 : 1;
    const weekdays = moment.weekdaysShort();
    const orderedWeekdays = [
      ...weekdays.slice(weekStartIndex),
      ...weekdays.slice(0, weekStartIndex),
    ];

    const headerRow = this.calendarEl.createDiv("nld-calendar-header");
    orderedWeekdays.forEach((day) => {
      const dayHeader = headerRow.createDiv("nld-calendar-day-header");
      dayHeader.setText(day);
    });

    // Grille du calendrier
    const grid = this.calendarEl.createDiv("nld-calendar-grid");

    const startOfMonth = this.currentMonth.clone().startOf("month");
    const endOfMonth = this.currentMonth.clone().endOf("month");
    
    // Calculer le début de la semaine selon les préférences
    const startDate = startOfMonth.clone();
    const dayOfWeek = startDate.day();
    const diff = dayOfWeek - weekStartIndex;
    if (diff < 0) {
      startDate.subtract(7 + diff, "days");
    } else {
      startDate.subtract(diff, "days");
    }
    
    // Calculer la fin de la semaine
    const endDate = endOfMonth.clone();
    const endDayOfWeek = endDate.day();
    const endDiff = (6 + weekStartIndex - endDayOfWeek) % 7;
    if (endDiff > 0) {
      endDate.add(endDiff, "days");
    }

    const today = moment();
    const currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate, "day")) {
      // Capturer la date actuelle dans une variable locale pour éviter les problèmes de closure
      const dateForThisDay = currentDate.clone();
      const dayEl = grid.createDiv("nld-calendar-day");
      const dayNumber = dateForThisDay.date();

      // Style selon le type de jour
      if (dateForThisDay.isSame(today, "day")) {
        dayEl.addClass("nld-today");
      }
      if (dateForThisDay.isSame(this.selectedDate, "day")) {
        dayEl.addClass("nld-selected");
      }
      if (!dateForThisDay.isSame(this.currentMonth, "month")) {
        dayEl.addClass("nld-other-month");
      }

      const dayNumberEl = dayEl.createDiv("nld-day-number");
      dayNumberEl.setText(String(dayNumber));

      // Événement de clic
      dayEl.addEventListener("click", () => {
        if (this.updateSelectedDateFn) {
          this.updateSelectedDateFn(dateForThisDay);
        }
      });

      currentDate.add(1, "day");
    }
  }

  private updateMonthYearDisplay(monthYearEl: HTMLElement): void {
    monthYearEl.empty();
    const monthName = this.currentMonth.format("MMMM");
    const year = this.currentMonth.format("YYYY");
    const monthSpan = monthYearEl.createSpan();
    monthSpan.setText(monthName);
    const spaceSpan = monthYearEl.createSpan();
    spaceSpan.setText(" ");
    const yearSpan = monthYearEl.createSpan();
    yearSpan.setText(year);
  }

  private createKeyboardHandler(
    prevMonthBtn: HTMLElement,
    nextMonthBtn: HTMLElement,
    updateSelectedDate: (date: Moment) => void
  ): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      // Éviter les raccourcis si on est dans un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          prevMonthBtn.click();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextMonthBtn.click();
          break;
        case "ArrowUp":
          e.preventDefault();
          this.currentMonth.subtract(1, "month");
          this.renderCalendar();
          break;
        case "ArrowDown":
          e.preventDefault();
          this.currentMonth.add(1, "month");
          this.renderCalendar();
          break;
        case "Home":
          e.preventDefault();
          updateSelectedDate(moment().startOf("day"));
          this.currentMonth = moment();
          this.renderCalendar();
          break;
        case "Escape":
          e.preventDefault();
          this.close();
          break;
      }
    };
  }

  private setupThemeObserver(): void {
    // Observer les changements de classe pour détecter le changement de thème
    this.themeObserver = new MutationObserver(() => {
      const wasDarkMode = this.isDarkMode;
      this.isDarkMode = activeDocument.body.classList.contains("theme-dark");

      if (wasDarkMode !== this.isDarkMode && this.contentEl) {
        if (this.isDarkMode) {
          this.contentEl.addClass("nld-dark-mode");
        } else {
          this.contentEl.removeClass("nld-dark-mode");
        }
      }
    });

    this.themeObserver.observe(activeDocument.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private insertDate(dateStr: string): void {
    const activeEditor = getActiveEditor(this.app.workspace);
    if (!activeEditor) {
      return;
    }
    this.close();
    activeEditor.replaceSelection(dateStr);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Nettoyer les event listeners
    if (this.keyboardHandler) {
      contentEl.removeEventListener("keydown", this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Nettoyer l'observer de thème
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }
}
