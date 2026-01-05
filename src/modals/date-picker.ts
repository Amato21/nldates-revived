import { App, MarkdownView, Modal, Setting } from "obsidian";
import { generateMarkdownLink } from "src/utils";
import { getLocaleWeekStart } from "src/utils";
import type NaturalLanguageDates from "../main";
import { DayOfWeek } from "../settings";
import t from "../lang/helper";

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

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.plugin = plugin;
    this.selectedDate = window.moment();
    this.currentMonth = window.moment();
    // Détecter le mode sombre
    this.isDarkMode = document.body.classList.contains("theme-dark");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("nld-date-picker-modal");

    // Injecter les styles CSS
    this.injectStyles();

    // Ajouter les styles pour le mode sombre
    if (this.isDarkMode) {
      contentEl.addClass("nld-dark-mode");
    }

    let momentFormat = this.plugin.settings.modalMomentFormat;
    let insertAsLink = this.plugin.settings.modalToggleLink;
    let dateInput = "";

    const getDateStr = () => {
      let cleanDateInput = dateInput;
      let shouldIncludeAlias = false;

      if (dateInput.endsWith("|")) {
        shouldIncludeAlias = true;
        cleanDateInput = dateInput.slice(0, -1);
      }

      // Utiliser la date sélectionnée dans le calendrier si disponible
      const dateToParse = cleanDateInput || this.selectedDate.format("YYYY-MM-DD");
      const parsedDate = this.plugin.parseDate(dateToParse);
      let parsedDateString = parsedDate.moment.isValid()
        ? parsedDate.moment.format(momentFormat)
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

    const updateSelectedDate = (date: Moment) => {
      this.selectedDate = date.clone();
      if (this.dateInputEl) {
        this.dateInputEl.value = date.format("YYYY-MM-DD");
      }
      updatePreview();
      this.renderCalendar();
    };

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
    const monthNames = window.moment.months();
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
            const parsed = this.plugin.parseDate(value);
            if (parsed.moment.isValid()) {
              updateSelectedDate(parsed.moment);
            }
          }
          updatePreview();
        });

        window.setTimeout(() => textEl.inputEl.focus(), 10);
      });
    this.previewEl = dateInputEl.descEl;
    updatePreview();

    // Options de format
    new Setting(inputSection)
      .setName("Date format")
      .setDesc("Moment format to be used")
      .addMomentFormat((momentEl) => {
        momentEl.setPlaceholder("YYYY-MM-DD HH:mm");
        momentEl.setValue(momentFormat);
        momentEl.onChange((value) => {
          momentFormat = value.trim() || "YYYY-MM-DD HH:mm";
          this.plugin.settings.modalMomentFormat = momentFormat;
          void this.plugin.saveSettings();
          updatePreview();
        });
      });

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
    this.quickButtonsEl.createEl("div", { cls: "nld-quick-buttons-label", text: "Quick select:" });

    const primaryLang = this.plugin.settings.languages[0] || "en";
    const quickOptions = [
      { key: "today", moment: window.moment() },
      { key: "tomorrow", moment: window.moment().add(1, "day") },
      { key: "yesterday", moment: window.moment().subtract(1, "day") },
      { key: "next week", moment: window.moment().add(1, "week") },
      { key: "next month", moment: window.moment().add(1, "month") },
      { key: "next year", moment: window.moment().add(1, "year") },
    ];

    const buttonsContainer = this.quickButtonsEl.createDiv("nld-quick-buttons-grid");

    quickOptions.forEach((option) => {
      const label = t(option.key.replace(" ", ""), primaryLang);
      const button = buttonsContainer.createEl("button", {
        cls: "nld-quick-btn",
        text: label !== "NOTFOUND" ? label : option.key,
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
    const weekdays = window.moment.weekdaysShort();
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
    let startDate = startOfMonth.clone();
    const dayOfWeek = startDate.day();
    const diff = dayOfWeek - weekStartIndex;
    if (diff < 0) {
      startDate.subtract(7 + diff, "days");
    } else {
      startDate.subtract(diff, "days");
    }
    
    // Calculer la fin de la semaine
    let endDate = endOfMonth.clone();
    const endDayOfWeek = endDate.day();
    const endDiff = (6 + weekStartIndex - endDayOfWeek) % 7;
    if (endDiff > 0) {
      endDate.add(endDiff, "days");
    }

    const today = window.moment();
    let currentDate = startDate.clone();

    while (currentDate.isSameOrBefore(endDate, "day")) {
      const dayEl = grid.createDiv("nld-calendar-day");
      const dayNumber = currentDate.date();

      // Style selon le type de jour
      if (currentDate.isSame(today, "day")) {
        dayEl.addClass("nld-today");
      }
      if (currentDate.isSame(this.selectedDate, "day")) {
        dayEl.addClass("nld-selected");
      }
      if (!currentDate.isSame(this.currentMonth, "month")) {
        dayEl.addClass("nld-other-month");
      }

      const dayNumberEl = dayEl.createDiv("nld-day-number");
      dayNumberEl.setText(String(dayNumber));

      // Événement de clic
      dayEl.addEventListener("click", () => {
        this.selectedDate = currentDate.clone();
        if (this.dateInputEl) {
          this.dateInputEl.value = this.selectedDate.format("YYYY-MM-DD");
        }
        this.renderCalendar();
        if (this.previewEl) {
          const getDateStr = () => {
            const parsedDate = this.plugin.parseDate(this.selectedDate.format("YYYY-MM-DD"));
            let parsedDateString = parsedDate.moment.isValid()
              ? parsedDate.moment.format(this.plugin.settings.modalMomentFormat)
              : "";

            if (this.plugin.settings.modalToggleLink) {
              parsedDateString = generateMarkdownLink(
                this.app,
                parsedDateString,
                undefined
              );
            }
            return parsedDateString;
          };
          this.previewEl.setText(getDateStr());
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
          updateSelectedDate(window.moment());
          this.currentMonth = window.moment();
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
      this.isDarkMode = document.body.classList.contains("theme-dark");
      
      if (wasDarkMode !== this.isDarkMode && this.contentEl) {
        if (this.isDarkMode) {
          this.contentEl.addClass("nld-dark-mode");
        } else {
          this.contentEl.removeClass("nld-dark-mode");
        }
      }
    });

    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private insertDate(dateStr: string): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }
    const activeEditor = activeView.editor;
    this.close();
    activeEditor.replaceSelection(dateStr);
  }

  private injectStyles(): void {
    // Vérifier si les styles sont déjà injectés
    if (document.getElementById("nld-date-picker-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "nld-date-picker-styles";
    style.textContent = `
      .nld-date-picker-modal {
        --nld-primary: var(--interactive-accent);
        --nld-bg: var(--background-primary);
        --nld-text: var(--text-normal);
        --nld-border: var(--background-modifier-border);
        --nld-hover: var(--background-modifier-hover);
        --nld-selected: var(--interactive-accent);
        --nld-today: var(--text-accent);
      }

      .nld-date-picker-modal.nld-dark-mode {
        --nld-bg: var(--background-primary);
        --nld-text: var(--text-normal);
        --nld-border: var(--background-modifier-border);
        --nld-hover: var(--background-modifier-hover);
      }

      .nld-date-picker-container {
        padding: 0.5rem;
      }

      /* Boutons rapides */
      .nld-quick-buttons {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--nld-border);
      }

      .nld-quick-buttons-label {
        font-size: 0.85rem;
        color: var(--nld-text);
        margin-bottom: 0.75rem;
        font-weight: 500;
      }

      .nld-quick-buttons-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
      }

      .nld-quick-btn {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--nld-border);
        background: var(--nld-bg);
        color: var(--nld-text);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
      }

      .nld-quick-btn:hover {
        background: var(--nld-hover);
        border-color: var(--nld-primary);
      }

      .nld-quick-btn:active {
        transform: scale(0.98);
      }

      /* Section calendrier */
      .nld-calendar-section {
        margin-bottom: 1.5rem;
      }

      /* Navigation */
      .nld-calendar-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
        gap: 0.5rem;
      }

      .nld-nav-btn {
        width: 2rem;
        height: 2rem;
        border: 1px solid var(--nld-border);
        background: var(--nld-bg);
        color: var(--nld-text);
        border-radius: 4px;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .nld-nav-btn:hover {
        background: var(--nld-hover);
        border-color: var(--nld-primary);
      }

      .nld-month-year {
        flex: 1;
        text-align: center;
        font-weight: 600;
        font-size: 1.1rem;
        color: var(--nld-text);
      }

      .nld-year-select,
      .nld-month-select {
        padding: 0.4rem 0.6rem;
        border: 1px solid var(--nld-border);
        background: var(--nld-bg);
        color: var(--nld-text);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
      }

      .nld-year-select:hover,
      .nld-month-select:hover {
        border-color: var(--nld-primary);
      }

      /* Calendrier */
      .nld-calendar {
        border: 1px solid var(--nld-border);
        border-radius: 6px;
        padding: 0.75rem;
        background: var(--nld-bg);
      }

      .nld-calendar-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
        margin-bottom: 0.5rem;
      }

      .nld-calendar-day-header {
        text-align: center;
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--nld-text);
        padding: 0.5rem 0;
      }

      .nld-calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
      }

      .nld-calendar-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
      }

      .nld-calendar-day:hover {
        background: var(--nld-hover);
        border-color: var(--nld-border);
      }

      .nld-calendar-day.nld-selected {
        background: var(--nld-selected);
        color: white;
        border-color: var(--nld-selected);
        font-weight: 600;
      }

      .nld-calendar-day.nld-today {
        border: 2px solid var(--nld-today);
        font-weight: 600;
      }

      .nld-calendar-day.nld-today.nld-selected {
        border-color: var(--nld-selected);
      }

      .nld-calendar-day.nld-other-month {
        opacity: 0.4;
      }

      .nld-day-number {
        font-size: 0.9rem;
      }

      /* Section input */
      .nld-input-section {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--nld-border);
      }

      /* Responsive */
      @media (max-width: 500px) {
        .nld-quick-buttons-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
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

    // Nettoyer les styles
    const stylesEl = document.getElementById("nld-date-picker-styles");
    if (stylesEl) {
      stylesEl.remove();
    }
  }
}
