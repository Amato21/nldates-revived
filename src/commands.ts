import { adjustCursor, getSelectedText, shouldOmitDateForShortRelative, getActiveEditor } from "./utils";
import NaturalLanguageDates from "./main";
import t from "./lang/helper";
import moment from "./window-moment";

export function getParseCommand(plugin: NaturalLanguageDates, mode: string): void {
  const { workspace } = plugin.app;
  const editor = getActiveEditor(workspace);

  // L'éditeur pourrait ne pas être disponible (par exemple dans une vue non-markdown)
  if (!editor) {
    return;
  }
  const selectedText = getSelectedText(editor);
  // Captured after getSelectedText(): when nothing was selected, that call
  // expands the selection to the word at the cursor, which moves where the
  // selection actually ends. Capturing the cursor beforehand would anchor
  // adjustCursor()'s offset math to the pre-expansion position instead of
  // the edge of the text that's about to be replaced.
  const cursor = editor.getCursor("to");

  // Vérifier d'abord si c'est une plage de dates
  const dateRange = plugin.parseDateRange(selectedText);
  if (dateRange) {
    // C'est une plage de dates
    let newStr = "";
    
    // Si on a une liste de dates, générer une liste de liens au lieu d'une plage
    if (dateRange.dateList && dateRange.dateList.length > 0) {
      const dateLinks = dateRange.dateList.map(m => {
        const formatted = m.format(plugin.settings.format);
        if (mode == "replace") {
          return `[[${formatted}]]`;
        } else if (mode == "link") {
          return `[${formatted}](${formatted})`;
        } else {
          // "clean" and "time" both resolve to the plain formatted date here:
          // each dateList entry is a whole calendar day with no parsed time
          // component, so "time" for a range means the same as "clean" (see
          // the identical mode == "time" case in the non-list branch below).
          return formatted;
        }
      });
      newStr = dateLinks.join(', ');
    } else {
      // Fallback vers l'ancien comportement (plage)
      const startFormatted = dateRange.startMoment.format(plugin.settings.format);
      const endFormatted = dateRange.endMoment.format(plugin.settings.format);
      
      // Obtenir la traduction de "to" selon la langue principale
      const primaryLang = plugin.settings.languages[0] || 'en';
      const toTranslation = t("to", primaryLang).split('|')[0]; // Prendre la première variante
      
      if (mode == "replace") {
        // Générer des liens pour la plage : [[start]] to [[end]]
        newStr = `[[${startFormatted}]] ${toTranslation} [[${endFormatted}]]`;
      } else if (mode == "link") {
        // Lien Markdown standard
        newStr = `[${selectedText}](${dateRange.formattedString})`;
      } else if (mode == "clean") {
        // Texte brut sans lien
        newStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
      } else if (mode == "time") {
        // Pas d'heure pour les plages
        newStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
      }
    }
    
    editor.replaceSelection(newStr);
    adjustCursor(editor, cursor, newStr, selectedText);
    editor.focus();
    return;
  }

  // Sinon, traiter comme une date normale
  const date = plugin.parseDate(selectedText);

  if (!date.moment.isValid()) {
    // Do nothing
    editor.setCursor({
      line: cursor.line,
      ch: cursor.ch,
    });
    return;
  }

  // --- MODIFICATION INTELLIGENTE V0.9 ---
  // On vérifie si une heure est présente dans le texte sélectionné
  const hasTime = plugin.hasTimeComponent(selectedText);

  // --- OPTIMISATION : Omettre la date pour expressions relatives courtes aujourd'hui ---
  const isToday = date.moment.isSame(moment(), 'day');
  const isRelativeShortTerm = shouldOmitDateForShortRelative(selectedText, plugin.settings.languages);
  const shouldOmitDate = plugin.settings.omitDateForShortRelative && isToday && isRelativeShortTerm && hasTime;

  let newStr = "";

  if (mode == "replace") {
    // C'est le mode par défaut (Create Link)
    if (hasTime) {
        if (shouldOmitDate) {
            // CAS OPTIMISÉ : Juste l'heure pour "dans X min/heures" aujourd'hui
            const timePart = date.moment.format(plugin.settings.timeFormat || "HH:mm");
            newStr = timePart;
        } else {
            // CAS HYBRIDE : [[Date]] Heure
            const datePart = date.moment.format(plugin.settings.format);
            // Si l'utilisateur n'a pas mis de format d'heure, on force HH:mm par sécurité
            const timePart = date.moment.format(plugin.settings.timeFormat || "HH:mm");
            
            newStr = `[[${datePart}]] ${timePart}`;
        }
    } else {
        // CAS CLASSIQUE : [[Date]]
        newStr = `[[${date.formattedString}]]`;
    }
  } else if (mode == "link") {
    // Lien Markdown standard [texte](date)
    newStr = `[${selectedText}](${date.formattedString})`;
  } else if (mode == "clean") {
    // Texte brut sans lien
    newStr = `${date.formattedString}`;
  } else if (mode == "time") {
    // Juste l'heure
    const time = plugin.parseTime(selectedText);
    newStr = `${time.formattedString}`;
  }

  editor.replaceSelection(newStr);
  adjustCursor(editor, cursor, newStr, selectedText);
  editor.focus();
}

export function insertMomentCommand(
  plugin: NaturalLanguageDates,
  date: Date,
  format: string
) {
  const { workspace } = plugin.app;
  const editor = getActiveEditor(workspace);

  if (editor) {
    editor.replaceSelection(moment(date).format(format));
  }
}

export function getNowCommand(plugin: NaturalLanguageDates): void {
  const format = `${plugin.settings.format}${plugin.settings.separator}${plugin.settings.timeFormat}`;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentDateCommand(plugin: NaturalLanguageDates): void {
  const format = plugin.settings.format;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}

export function getCurrentTimeCommand(plugin: NaturalLanguageDates): void {
  const format = plugin.settings.timeFormat;
  const date = new Date();
  insertMomentCommand(plugin, date, format);
}