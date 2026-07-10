import { App, Editor, EditorRange, EditorPosition, normalizePath, TFile, MarkdownView, Workspace } from "obsidian";
import {
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";

import { DayOfWeek } from "./settings";
import { DateFormatter } from "./date-formatter";
import { TranslationCollector } from "./translation-collector";

// Type alias for Moment from the moment library bundled with Obsidian
// Using the type from the moment library types since moment is bundled with Obsidian
// The moment package is bundled with Obsidian, but the Moment type is not exported from obsidian module
type Moment = import("moment").Moment;

const daysOfWeek: Omit<DayOfWeek, "locale-default">[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export default function getWordBoundaries(editor: Editor): EditorRange {
  const cursor = editor.getCursor();

    const pos = editor.posToOffset(cursor);
    const editorWithCM = editor as Editor & { cm: { state: { wordAt: (pos: number) => { from: number; to: number } } } };
    const word = editorWithCM.cm.state.wordAt(pos);
    const wordStart = editor.offsetToPos(word.from);
    const wordEnd = editor.offsetToPos(word.to);
    return {
      from: wordStart,
      to: wordEnd,
    };
}

export function getSelectedText(editor: Editor): string {
  if (editor.somethingSelected()) {
    return editor.getSelection();
  } else {
    const wordBoundaries = getWordBoundaries(editor);
    // Select the word at cursor position to enable text replacement
    // This is necessary for the date parsing commands to work correctly
    editor.setSelection(wordBoundaries.from, wordBoundaries.to);
    return editor.getSelection();
  }
}

export function adjustCursor(
  editor: Editor,
  cursor: EditorPosition,
  newStr: string,
  oldStr: string
): void {
  const cursorOffset = newStr.length - oldStr.length;
  editor.setCursor({
    line: cursor.line,
    ch: cursor.ch + cursorOffset,
  });
}

/**
 * Wrapper pour compatibilité avec le code existant
 * @deprecated Utiliser DateFormatter.format() directement
 */
export function getFormattedDate(date: Date, format: string): string {
  return DateFormatter.format(date, format);
}

export function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function parseTruthy(flag: string): boolean {
  return ["y", "yes", "1", "t", "true"].indexOf(flag.toLowerCase()) >= 0;
}

/**
 * Valide un format Moment.js et retourne un résultat avec prévisualisation
 * @param format - Le format Moment.js à valider
 * @returns Un objet contenant valid (booléen), error (optionnel), preview (optionnel)
 */
export function validateMomentFormat(format: string): { valid: boolean; error?: string; preview?: string } {
  if (!format || typeof format !== 'string') {
    return { valid: false, error: "Le format ne peut pas être vide" };
  }

  // Limiter la longueur du format pour éviter les attaques
  const MAX_FORMAT_LENGTH = 100;
  if (format.length > MAX_FORMAT_LENGTH) {
    return { valid: false, error: `Le format ne peut pas dépasser ${MAX_FORMAT_LENGTH} caractères` };
  }

  try {
    const testDate = window.moment();
    const formatted = testDate.format(format);
    
    // Vérifier que le format produit quelque chose de valide
    if (!formatted || formatted === format) {
      return { valid: false, error: "Format invalide ou non reconnu" };
    }
    
    // Vérifier que le format ne contient pas de caractères dangereux
    // Moment.js utilise des caractères spéciaux, mais on veut éviter les injections
    // Les formats Moment.js valides contiennent principalement des lettres, chiffres et caractères de ponctuation
    const dangerousPattern = /[<>"'`]/;
    if (dangerousPattern.test(format)) {
      return { valid: false, error: "Le format contient des caractères non autorisés" };
    }
    
    return { valid: true, preview: formatted };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Erreur lors de la validation du format" };
  }
}

/**
 * Sanitize et valide une entrée utilisateur pour éviter les injections
 * @param input - L'entrée à sanitizer
 * @param maxLength - Longueur maximale autorisée (défaut: 200)
 * @returns L'entrée sanitizée ou null si invalide
 */
export function sanitizeInput(input: string | undefined | null, maxLength = 200): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Limiter la longueur
  const trimmed = input.trim().substring(0, maxLength);
  
  if (trimmed.length === 0) {
    return null;
  }

  // Rejeter les caractères de contrôle et les caractères sans usage légitime dans une
  // expression de date en langage naturel (ex: "<", ">", "`"). On n'utilise pas de whitelist
  // de scripts car les dates en langage naturel utilisent des lettres de toutes les langues
  // supportées (latin, cyrillique, japonais, chinois...), ainsi que l'apostrophe
  // (ex: "Aujourd'hui" en français, "П'ятниці" en ukrainien).
  const invalidCharsPattern = /[<>`\u0000-\u001F\u007F-\u009F]/;

  if (invalidCharsPattern.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Valide un paramètre URI pour éviter les injections
 * @param param - Le paramètre à valider
 * @param maxLength - Longueur maximale autorisée (défaut: 100)
 * @returns Le paramètre validé ou null si invalide
 */
export function validateUriParam(param: string | undefined | null, maxLength = 100): string | null {
  return sanitizeInput(param, maxLength);
}

export function getWeekNumber(dayOfWeek: Omit<DayOfWeek, "locale-default">): number {
  return daysOfWeek.indexOf(dayOfWeek);
}

export function getLocaleWeekStart(): Omit<DayOfWeek, "locale-default"> {
  const localeData = window.moment.localeData() as { _week?: { dow: number } };
  const startOfWeek = localeData._week?.dow ?? 0;
  return daysOfWeek[startOfWeek];
}

export function generateMarkdownLink(app: App, subpath: string, alias?: string) {
  const vaultWithConfig = app.vault as typeof app.vault & { getConfig: (key: string) => boolean };
  const useMarkdownLinks = vaultWithConfig.getConfig("useMarkdownLinks");
  const path = normalizePath(subpath);

  if (useMarkdownLinks) {
    if (alias) {
      return `[${alias}](${path.replace(/ /g, "%20")})`;
    } else {
      return `[${subpath}](${path})`;
    }
  } else {
    if (alias) {
      return `[[${path}|${alias}]]`;
    } else {
      return `[[${path}]]`;
    }
  }
}

export async function getOrCreateDailyNote(date: Moment): Promise<TFile | null> {
  // Borrowed from the Slated plugin:
  // https://github.com/tgrosinger/slated-obsidian/blob/main/src/vault.ts#L17
  const desiredNote = getDailyNote(date, getAllDailyNotes());
  if (desiredNote) {
    return desiredNote;
  }
  return createDailyNote(date);
}

// Source `chrono`:
// https://github.com/wanasit/chrono/blob/47f11da6b656cd5cb61f246e8cca706983208ded/src/utils/pattern.ts#L8
// Copyright (c) 2014, Wanasit Tanakitrungruang
type DictionaryLike = string[] | { [word: string]: unknown } | Map<string, unknown>;

function extractTerms(dictionary: DictionaryLike): string[] {
  let keys: string[];
  if (dictionary instanceof Array) {
    keys = [...dictionary];
  } else if (dictionary instanceof Map) {
    keys = Array.from(dictionary.keys());
  } else {
    keys = Object.keys(dictionary);
  }

  return keys;
}
function matchAnyPattern(dictionary: DictionaryLike): string {
  const joinedTerms = extractTerms(dictionary)
    .sort((a, b) => b.length - a.length)
    .join("|")
    .replace(/\./g, "\\.");

  return `(?:${joinedTerms})`;
}

const ORDINAL_WORD_DICTIONARY: { [word: string]: number } = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
  "thirty-first": 31,
};

export const ORDINAL_NUMBER_PATTERN = `(?:${matchAnyPattern(
  ORDINAL_WORD_DICTIONARY
)}|[0-9]{1,2}(?:st|nd|rd|th|ème|ème|er|e|er|e|\\.)?)`;

export function parseOrdinalNumberPattern(match: string): number {
  let num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY[num] !== undefined) {
    return ORDINAL_WORD_DICTIONARY[num];
  }

  // Remove ordinal suffixes: st, nd, rd, th, ème, er, e, and trailing dot
  num = num.replace(/(?:st|nd|rd|th|ème|er|e|\.)$/i, "");
  return parseInt(num);
}

/**
 * Détermine si une expression temporelle relative courte (minutes/heures) devrait omettre la date
 * car elle reste dans la même journée (aujourd'hui)
 * @param text - Le texte de l'expression temporelle (ex: "dans 15 min", "in 2 hours", "30分鐘後")
 * @param languages - Les langues supportées pour détecter les patterns
 * @returns true si c'est une expression relative courte qui reste aujourd'hui
 */
export function shouldOmitDateForShortRelative(text: string, languages: string[]): boolean {
  const lowerText = text.toLowerCase().trim();
  const tc = new TranslationCollector(languages);

  const inPattern = tc.buildAlternationFor("in");
  const minutePattern = tc.buildAlternationFor("minute");
  const hourPattern = tc.buildAlternationFor("hour");
  // Suffix-style languages (e.g. Chinese "30分鐘後") mark "later" instead of
  // prefixing with "in"; see translation-collector.ts / parser.ts for why this
  // is a separate key from the day/hour/minute word lists.
  const laterPattern = tc.buildAlternationFor("later");

  const shortRelativePatterns: RegExp[] = [];

  // Prefix style: "in X minutes"/"dans X min"/...
  if (inPattern) {
    if (minutePattern) {
      shortRelativePatterns.push(new RegExp(`^(?:${inPattern})\\s+\\d+\\s+(?:${minutePattern})`, 'i'));
    }
    if (hourPattern) {
      shortRelativePatterns.push(new RegExp(`^(?:${inPattern})\\s+\\d+\\s+(?:${hourPattern})`, 'i'));
    }
  }

  // Suffix style: "X minutes" + "later" marker, e.g. Chinese "30分鐘後"
  if (laterPattern) {
    if (minutePattern) {
      shortRelativePatterns.push(new RegExp(`^\\d+\\s*(?:${minutePattern})\\s*(?:${laterPattern})$`, 'i'));
    }
    if (hourPattern) {
      shortRelativePatterns.push(new RegExp(`^\\d+\\s*(?:${hourPattern})\\s*(?:${laterPattern})$`, 'i'));
    }
  }

  return shortRelativePatterns.some(pattern => pattern.test(lowerText));
}

/**
 * Obtient l'éditeur actif de manière flexible, compatible avec QuickAdd et autres plugins
 * Essaie plusieurs méthodes pour trouver l'éditeur actif
 * @param workspace - L'instance Workspace d'Obsidian
 * @returns L'éditeur actif ou null si aucun n'est trouvé
 */
export function getActiveEditor(workspace: Workspace): Editor | null {
  // Méthode 1: Utiliser activeEditor si disponible (Obsidian récent)
  const workspaceWithActiveEditor = workspace as typeof workspace & { activeEditor?: { editor?: Editor } };
  if (workspaceWithActiveEditor.activeEditor?.editor) {
    return workspaceWithActiveEditor.activeEditor.editor;
  }

  // Méthode 2: Utiliser getActiveViewOfType(MarkdownView) (méthode standard)
  const activeView = workspace.getActiveViewOfType(MarkdownView);
  if (activeView?.editor) {
    return activeView.editor;
  }

  // Méthode 3: Chercher dans tous les leafs pour trouver un éditeur actif
  // Utile pour QuickAdd et autres plugins qui créent des éditeurs personnalisés
  const activeLeaf = workspace.activeLeaf;
  if (activeLeaf) {
    const view = activeLeaf.view;
    // Vérifier si la vue a un éditeur
    const viewWithEditor = view as typeof view & { editor?: Editor };
    if (viewWithEditor.editor) {
      return viewWithEditor.editor;
    }
  }

  // Méthodes 4 et 5: Parcourir tous les leafs markdown, en préférant celui qui
  // a le focus, sinon le premier éditeur disponible en dernier recours.
  let firstAvailableEditor: Editor | null = null;
  for (const leaf of workspace.getLeavesOfType("markdown")) {
    const view = leaf.view;
    if (view instanceof MarkdownView && view.editor) {
      const editorEl = (view.editor as Editor & { cm?: { hasFocus?: () => boolean } }).cm;
      if (editorEl?.hasFocus?.()) {
        return view.editor;
      }
      firstAvailableEditor = firstAvailableEditor ?? view.editor;
    }
  }

  return firstAvailableEditor;
}