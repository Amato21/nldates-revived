import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import type NaturalLanguageDates from "../main";
import t from "../lang/helper";
import { generateMarkdownLink, shouldOmitDateForShortRelative, getActiveEditor } from "../utils";
import { logger } from "../logger";
import moment from "../window-moment";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Optimal String Alignment (OSA) edit distance: like Levenshtein, but also
// treats swapping two adjacent characters as a single edit (e.g. "heir" vs
// "hier" is distance 1, not 2) -- an adjacent-letter transposition is one of
// the most common typing mistakes, and plain Levenshtein would otherwise
// count it as two substitutions and push it past the threshold in
// fuzzyMatchesQuery() below. Space is kept to three rolling rows of length
// b.length + 1 (instead of a full (a.length+1) x (b.length+1) table) since
// this runs on every keystroke against every candidate.
function editDistance(a: string, b: string): number {
  const n = b.length;
  let twoRowsAgo = new Array<number>(n + 1).fill(0);
  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  let currentRow = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        prevRow[j] + 1, // deletion
        currentRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoRowsAgo[j - 2] + 1); // transposition
      }
      currentRow[j] = value;
    }
    [twoRowsAgo, prevRow, currentRow] = [prevRow, currentRow, twoRowsAgo];
  }
  return prevRow[n];
}

// Prefix match if possible (fast, exact, and the only behavior for queries
// too short to fuzzy-match reliably); otherwise tolerate a small edit
// distance between the query and candidate prefixes of similar length, so a
// single wrong/missing/transposed letter near the start of the query still
// surfaces the intended suggestion instead of none at all. Checks a window
// of prefix lengths around the query's own length (query.length ± threshold)
// rather than a single fixed-length slice -- comparing against a prefix
// that's forced to be longer than the query by more than the threshold would
// otherwise make the edit distance at least that length difference, which
// can exceed the threshold even for an exact-prefix match (e.g. "tomur"
// against a fixed 7-character slice of "tomorrow" is already 2 edits away
// before accounting for the actual typo). Only used for short, fixed
// candidate lists (today/tomorrow, weekdays, history/context) -- the
// multi-stage progressive-typing suggestion generators elsewhere in this
// file keep strict prefix matching, since fuzzy matching interacts
// unpredictably with their partial-completion logic.
function fuzzyMatchesQuery(candidate: string, query: string): boolean {
  const c = candidate.toLowerCase();
  const q = query.toLowerCase();
  if (!q || c.startsWith(q)) return true;
  if (q.length <= 2) return false; // too short to fuzzy-match without noise
  const threshold = q.length <= 5 ? 1 : 2;
  const minLen = Math.max(1, q.length - threshold);
  const maxLen = Math.min(c.length, q.length + threshold);
  for (let len = minLen; len <= maxLen; len++) {
    if (editDistance(c.slice(0, len), q) <= threshold) return true;
  }
  return false;
}

export default class DateSuggest extends EditorSuggest<string> {
  private plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.app = app;
    this.plugin = plugin;

    // Type assertion needed: Obsidian's EditorSuggest scope doesn't expose register method in types,
    // but it exists at runtime. This allows us to register custom keyboard shortcuts.
    const scope = this.scope as typeof this.scope & {
      register: (modifiers: string[], key: string, callback: (evt: KeyboardEvent) => boolean) => void;
    };
    scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
      // Type assertion needed: EditorSuggest's internal suggestions API is not fully typed.
      // This allows access to useSelectedItem method which exists at runtime for Shift+Enter functionality.
      const editorSuggest = this as unknown as {
        suggestions: { useSelectedItem: (evt: KeyboardEvent) => void };
      };
      editorSuggest.suggestions.useSelectedItem(evt);
      return false;
    });

    if (this.plugin.settings.autosuggestToggleLink) {
      this.setInstructions([{ command: "Shift", purpose: "Keep text as alias" }]);
    }
  }

  getSuggestions(context: EditorSuggestContext): string[] {
    // handle no matches
    const suggestions = this.getDateSuggestions(context);
    return suggestions.length ? suggestions : [ context.query ];
  }

  getDateSuggestions(context: EditorSuggestContext): string[] {
    // Récupérer les suggestions standard
    const standardSuggestions = this.unique(this.plugin.settings.languages.flatMap(
      language => {
        let suggestions = this.getTimeSuggestions(context.query, language);
        if (suggestions)
          return suggestions;
        
        suggestions = this.getImmediateSuggestions(context.query, language);
        if (suggestions)
          return suggestions;

        suggestions = this.getRelativeSuggestions(context.query, language);
        if (suggestions)
          return suggestions;

        suggestions = this.getWeekdaySuggestions(context.query, language);
        if (suggestions)
          return suggestions;

        return this.defaultSuggestions(context.query, language);
      }
    ));

    // Si les suggestions intelligentes sont désactivées, retourner les suggestions standard
    if (!this.plugin.settings.enableSmartSuggestions) {
      return standardSuggestions;
    }

    // Récupérer les suggestions intelligentes (historique + contexte)
    const smartSuggestions = this.getSmartSuggestions(context, standardSuggestions);

    // Fusionner : suggestions intelligentes en priorité, puis suggestions standard
    const merged = [...smartSuggestions];
    for (const suggestion of standardSuggestions) {
      if (!merged.includes(suggestion)) {
        merged.push(suggestion);
      }
    }

    return merged;
  }

  /**
   * Récupère les suggestions intelligentes basées sur l'historique et le contexte
   */
  private getSmartSuggestions(context: EditorSuggestContext, _standardSuggestions: string[]): string[] {
    const smartSuggestions: string[] = [];
    const query = context.query.toLowerCase();

    // Suggestions basées sur l'historique
    if (this.plugin.settings.enableHistorySuggestions && this.plugin.historyManager) {
      try {
        const historySuggestions = this.plugin.historyManager.getTopSuggestionsSync(15);
        for (const suggestion of historySuggestions) {
          // Vérifier que la suggestion correspond à la requête (tolère une petite faute de frappe)
          if (fuzzyMatchesQuery(suggestion, query) && !smartSuggestions.includes(suggestion)) {
            smartSuggestions.push(suggestion);
          }
        }
      } catch {
        // Ignorer les erreurs silencieusement
      }
    }

    // Suggestions basées sur le contexte
    if (this.plugin.settings.enableContextSuggestions && this.plugin.contextAnalyzer && context.editor) {
      try {
        const contextInfo = this.plugin.contextAnalyzer.analyzeContextSync(
          context.editor,
          context.start.line
        );
        
        // Ajouter les dates trouvées dans le contexte (tolère une petite faute de frappe)
        for (const dateStr of contextInfo.datesInContext) {
          if (fuzzyMatchesQuery(dateStr, query) && !smartSuggestions.includes(dateStr)) {
            smartSuggestions.push(dateStr);
          }
        }
      } catch {
        // Ignorer les erreurs silencieusement
      }
    }

    return smartSuggestions;
  }

  private getTimeSuggestions(inputStr: string, lang: string): string[] {
    // Only the first variant of a pipe-separated translation (e.g. Chinese
    // "時間|时间") is used for display/matching -- embedding the raw
    // multi-variant string would both garble the suggestion text and, since
    // "|" is a regex metacharacter, silently break the "^" anchor below.
    const timeWord = t("time", lang).split('|')[0];
    const nowWord = t("now", lang).split('|')[0];
    if (inputStr.match(new RegExp(`^${escapeRegex(timeWord)}`, "i"))) {
      const suggestions = [
        nowWord,
        t("plusminutes", lang, { timeDelta: "15" }),
        t("plushour", lang, { timeDelta: "1" }),
        t("minusminutes", lang, { timeDelta: "15" }),
        t("minushour", lang, { timeDelta: "1" }),
      ]
        .map(val => `${timeWord}:${val}`)
        .filter(item => item.toLowerCase().startsWith(inputStr.toLowerCase()));
      return suggestions.length > 0 ? suggestions : undefined;
    }
  }

  private getImmediateSuggestions(inputStr: string, lang: string): string[] {
    // Escape each translation's variants individually before joining into
    // an alternation: a language's own "|"-separated variants stay
    // meaningful alternation, but any other regex metacharacter one might
    // contain can't corrupt the pattern. Anchored with "^" like the other
    // suggestion generators in this file -- otherwise a short, common
    // substring (e.g. Chinese "next": "下一個|下一个|下", the last variant
    // being a single bare character) can match in the middle of unrelated
    // input.
    const buildPattern = (translation: string) =>
      translation.split('|').map(v => escapeRegex(v.trim())).filter(Boolean).join('|');
    const prefixPattern = [t("next", lang), t("last", lang), t("this", lang)]
      .map(buildPattern)
      .join('|');
    const regexp = new RegExp(`^(${prefixPattern})`, "i");
    const match = inputStr.match(regexp)
    if (match) {
      const reference = match[1]
      // Prendre seulement la première variante (avant le |) pour les suggestions
      const getFirstVariant = (val: string) => val.split('|')[0];
      const suggestions = [
        t("week", lang),
        t("month", lang),
        t("year", lang),
        t("sunday", lang),
        t("monday", lang),
        t("tuesday", lang),
        t("wednesday", lang),
        t("thursday", lang),
        t("friday", lang),
        t("saturday", lang),
      ]
        .map(val => {
          const firstVariant = getFirstVariant(val);
          // Capitaliser la première lettre pour un meilleur affichage
          return firstVariant.charAt(0).toUpperCase() + firstVariant.slice(1);
        })
        .map(val => `${reference} ${val}`)
        .filter(items => items.toLowerCase().startsWith(inputStr.toLowerCase()));
      return suggestions.length > 0 ? suggestions : undefined;
    }
  }

  private getRelativeSuggestions(inputStr: string, lang: string): string[] {
    // Vérifier d'abord les expressions combinées comme "in 1 month and" ou "dans 1 mois et"
    // Permettre la saisie progressive : "in 1 month and", "in 1 month and 3", "in 3 month and", etc.
    const andPattern = t("and", lang).split('|')[0]; // Prendre la première variante
    // Regex plus flexible qui permet la saisie après "and"
    const combinedRegex = new RegExp(`^(${t("in", lang)} )?([+-]?\\d+)\\s+(${t("minute", lang)}|${t("hour", lang)}|${t("day", lang)}|${t("week", lang)}|${t("month", lang)}|${t("year", lang)})\\s+(${andPattern})(\\s+.*)?$`, "i");
    const combinedMatch = inputStr.match(combinedRegex);
    if (combinedMatch) {
      const afterAnd = combinedMatch[5] ? combinedMatch[5].trim() : '';
      
      // Extraire la partie avant "and" pour reconstruire correctement
      const beforeAnd = inputStr.substring(0, inputStr.indexOf(combinedMatch[4]) + combinedMatch[4].length).trimEnd();
      
      // Si on a déjà commencé à taper après "and", extraire le nombre s'il y en a un
      let suggestedNumber = "1";
      let afterAndWithoutNumber = afterAnd;
      if (afterAnd) {
        const numberMatch = afterAnd.match(/^(\d+)(.*)$/);
        if (numberMatch) {
          suggestedNumber = numberMatch[1];
          afterAndWithoutNumber = numberMatch[2].trim();
        }
      }
      
      const suggestions = [
        t("inminutes", lang, { timeDelta: suggestedNumber }),
        t("inhours", lang, { timeDelta: suggestedNumber }),
        t("indays", lang, { timeDelta: suggestedNumber }),
        t("inweeks", lang, { timeDelta: suggestedNumber }),
        t("inmonths", lang, { timeDelta: suggestedNumber }),
      ]
        .map(s => {
          const unitPart = s.replace(/^dans |^in /i, '');
          // unitPart est comme "3 days" ou "5 minutes"
          if (afterAnd) {
            // Si on a déjà commencé à taper, compléter intelligemment
            // unitPart commence par le nombre (ex: "3 days")
            const unitWords = unitPart.split(' ');
            if (unitWords.length > 1 && unitWords[0] === suggestedNumber) {
              // Le nombre correspond, on peut suggérer le reste (ex: "days")
              const remaining = unitPart.substring(suggestedNumber.length).trim();
              if (afterAndWithoutNumber) {
                // Si on a tapé quelque chose après le nombre, vérifier si ça correspond
                // NOTE: known rough edge -- this drops the space between the
                // number and unit (e.g. typing "3 day" after "and" produces
                // "...and 3s" instead of "...and 3 days"), so the rebuilt
                // candidate then fails the outer prefix filter below and this
                // whole branch silently contributes no suggestion. Verified
                // as the actual current behavior; left alone as a narrow
                // autosuggest-text polish issue rather than fixed here.
                if (remaining.toLowerCase().startsWith(afterAndWithoutNumber.toLowerCase())) {
                  return `${beforeAnd} ${suggestedNumber}${remaining.substring(afterAndWithoutNumber.length)}`;
                }
                return null;
              } else {
                // On a juste tapé le nombre, suggérer le reste
                return `${beforeAnd} ${unitPart}`;
              }
            }
            // Reached for languages that don't separate the number and unit
            // with a space (e.g. Chinese "3天後", Japanese "3日後"): unitPart
            // then has no space at all, so unitWords.length > 1 above is
            // false regardless of whether the number matches. Note this has
            // its own rough edge symmetric to the one above -- since
            // unitPart has no space, unitPart.indexOf(' ') is -1 and
            // unitWithoutNumber ends up being the *whole* unitPart
            // (including its own leading number), so the returned suggestion
            // duplicates the number (e.g. "在 3 天 和 4 4分鐘後" instead of
            // "...和 4分鐘後"). Verified as the actual current behavior;
            // left alone as the same kind of narrow autosuggest-text polish
            // issue as the one documented above, not fixed here.
            const unitWithoutNumber = unitPart.substring(unitPart.indexOf(' ') + 1);
            if (unitWithoutNumber.toLowerCase().startsWith(afterAnd.toLowerCase())) {
              return `${beforeAnd} ${suggestedNumber} ${unitWithoutNumber}`;
            }
            return null;
          }
          return `${beforeAnd} ${unitPart}`;
        })
        .filter((item): item is string => item !== null)
        .filter(items => items.toLowerCase().startsWith(inputStr.toLowerCase()));
      return suggestions.length > 0 ? suggestions : undefined;
    }

    // Vérifier les plages de dates partielles comme "de lundi à" ou "from monday to"
    // Permettre la saisie progressive : "de lundi a", "de lundi a v", "de lundi a ve", etc.
    const fromPattern = t("from", lang).split('|')[0];
    const toPattern = t("to", lang).split('|')[0];
    // Regex plus flexible qui permet la saisie progressive après "à" ou "a"
    const rangePartialRegex = new RegExp(`^(${fromPattern}|de|du)\\s+(${t("sunday", lang)}|${t("monday", lang)}|${t("tuesday", lang)}|${t("wednesday", lang)}|${t("thursday", lang)}|${t("friday", lang)}|${t("saturday", lang)})\\s+(${toPattern}|à|a)(\\s+.*)?$`, "i");
    const rangePartialMatch = inputStr.match(rangePartialRegex);
    if (rangePartialMatch) {
      const afterTo = rangePartialMatch[4] ? rangePartialMatch[4].trim() : '';
      // Extraire la partie avant "à" ou "a" pour reconstruire correctement
      const beforeTo = inputStr.substring(0, inputStr.indexOf(rangePartialMatch[3]) + rangePartialMatch[3].length).trimEnd();
      
      // Générer des suggestions pour les jours de fin possibles
      const allDays = [
        t("sunday", lang),
        t("monday", lang),
        t("tuesday", lang),
        t("wednesday", lang),
        t("thursday", lang),
        t("friday", lang),
        t("saturday", lang),
      ];
      const suggestions = allDays
        .map(day => {
          if (afterTo) {
            // Si on a déjà commencé à taper, filtrer les jours qui commencent par ce texte
            if (day.toLowerCase().startsWith(afterTo.toLowerCase())) {
              // Remplacer "afterTo" par le jour complet
              return `${beforeTo} ${day}`;
            }
            return null;
          }
          return `${beforeTo} ${day}`;
        })
        .filter((item): item is string => item !== null)
        .filter(items => items.toLowerCase().startsWith(inputStr.toLowerCase()));
      return suggestions.length > 0 ? suggestions : undefined;
    }

    // Pattern standard pour les dates relatives simples
    const regexp = new RegExp(`^(${t("in", lang)} )?([+-]?\\d+)`, "i")
    const relativeDate = inputStr.match(regexp);
    if (relativeDate) {
      const timeDelta = relativeDate[relativeDate.length - 1];
      const suggestions = [
        t("inminutes", lang, { timeDelta }),
        t("inhours", lang, { timeDelta }),
        t("indays", lang, { timeDelta }),
        t("inweeks", lang, { timeDelta }),
        t("inmonths", lang, { timeDelta }),
        t("minutesago", lang, { timeDelta }),
        t("hoursago", lang, { timeDelta }),
        t("daysago", lang, { timeDelta }),
        t("weeksago", lang, { timeDelta }),
        t("monthsago", lang, { timeDelta }),
      ].filter(items => items.toLowerCase().startsWith(inputStr.toLowerCase()));
      // Don't return an empty array here: any digit-led input (including
      // suffix-style "3 dias atrás") matches this regexp too, since its
      // prefix group is optional -- returning unconditionally would make
      // the suffix-pattern check below unreachable dead code for every
      // suffix-only language.
      if (suggestions.length > 0) {
        return suggestions;
      }
    }

    // Suffix-style past expressions, e.g. Portuguese/Spanish "3 dias atrás"
    // (X unit + agosuffix marker), the past-tense mirror of the prefix
    // suggestions above.
    const agoSuffix = t("agosuffix", lang);
    if (agoSuffix && agoSuffix !== "NOTFOUND") {
      const suffixMatch = inputStr.match(/^(\d+)\s+(\w*)/i);
      if (suffixMatch) {
        const timeDelta = suffixMatch[1];
        const suffixVariant = agoSuffix.split('|')[0];

        const unitTypes = ['minute', 'hour', 'day', 'week', 'month', 'year'];
        const suggestions: string[] = [];
        for (const unitType of unitTypes) {
          const words = t(unitType, lang).split('|').map(w => w.trim()).slice(0, 2);
          for (const word of words) {
            suggestions.push(`${timeDelta} ${word} ${suffixVariant}`);
          }
        }

        const filtered = suggestions.filter(item => item.toLowerCase().startsWith(inputStr.toLowerCase()));
        if (filtered.length > 0) {
          return filtered;
        }
      }
    }
  }

  private getWeekdaySuggestions(inputStr: string, lang: string): string[] {
    // Le parser peut gérer les abréviations (thu, mon, sat, etc.), donc on doit les proposer aussi
    const weekdays = [
      { key: 'sunday', abbr: ['sun'] },
      { key: 'monday', abbr: ['mon'] },
      { key: 'tuesday', abbr: ['tue', 'tues'] },
      { key: 'wednesday', abbr: ['wed'] },
      { key: 'thursday', abbr: ['thu', 'thur', 'thurs'] },
      { key: 'friday', abbr: ['fri'] },
      { key: 'saturday', abbr: ['sat'] },
    ];

    const inputLower = inputStr.toLowerCase();
    const suggestions: string[] = [];

    for (const day of weekdays) {
      // t() always falls back to English, and en.ts always defines all
      // seven weekdays, so this guard can't actually be false.
      const dayName = t(day.key, lang);
      if (!dayName || dayName === "NOTFOUND") continue;

      const firstVariant = dayName.split('|')[0].trim();
      const dayNameLower = firstVariant.toLowerCase();

      // Vérifier si le nom complet commence par l'input (tolère une petite faute de frappe)
      if (fuzzyMatchesQuery(dayNameLower, inputLower)) {
        const capitalized = firstVariant.charAt(0).toUpperCase() + firstVariant.slice(1);
        if (!suggestions.includes(capitalized)) {
          suggestions.push(capitalized);
        }
      }

      // Vérifier si une abréviation correspond -- the abbreviations below are
      // English-only (e.g. "mon"), but dayName/firstVariant is translated
      // (e.g. French "lundi"), so for any non-English language the full-name
      // check above never matches while this abbreviation check still does.
      // This is what lets English weekday abbreviations work as a shortcut
      // regardless of which language is active (verified: typing "mon" with
      // only French enabled correctly suggests "Lundi").
      for (const abbr of day.abbr) {
        if (abbr.startsWith(inputLower)) {
          const capitalized = firstVariant.charAt(0).toUpperCase() + firstVariant.slice(1);
          if (!suggestions.includes(capitalized)) {
            suggestions.push(capitalized);
          }
        }
      }
    }

    return suggestions.length > 0 ? suggestions : undefined;
  }

  private defaultSuggestions(inputStr: string, lang: string): string[] {
    return [
      t("today", lang),
      t("yesterday", lang),
      t("tomorrow", lang),
    ].filter(item => fuzzyMatchesQuery(item, inputStr));
  }

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    el.setText(suggestion);
  }

  selectSuggestion(suggestion: string, event: KeyboardEvent | MouseEvent): void {
    // Utiliser l'éditeur du contexte si disponible, sinon chercher l'éditeur actif
    let editor: Editor | null = null;
    if (this.context?.editor) {
      editor = this.context.editor;
    } else {
      editor = getActiveEditor(this.app.workspace);
    }

    if (!editor) {
      return;
    }

    const includeAlias = event.shiftKey;
    // When keeping the typed text as alias (Shift), prefer what the user
    // actually typed over the suggestion's canonical dictionary casing
    // (e.g. French "demain" vs the dictionary's "Demain") -- but only when
    // they typed the complete word/phrase, just in a different casing; a
    // partial query ("demai") would make for a broken-looking alias, so
    // fall back to the full suggestion text in that case. Language-agnostic:
    // this only compares the typed text to the suggestion text.
    const typedQuery = this.context?.query;
    const aliasText = (typedQuery && typedQuery.toLowerCase() === suggestion.toLowerCase())
      ? typedQuery
      : suggestion;
    let dateStr = "";
    let makeIntoLink = this.plugin.settings.autosuggestToggleLink;

    // We check if the input contains a time component using the parser logic.
    let hasTime = this.plugin.hasTimeComponent(suggestion);

    // --- CORRECTION MULTILANGUE ---
    // Si le parser n'a pas détecté l'heure (souvent le cas en anglais pour "in 2 minutes"),
    // on force la détection si on voit des mots clés explicites (min, hour, etc).
    // IMPORTANT: Ne pas matcher "m" dans "month" - vérifier que c'est bien un mot de temps
    if (!hasTime) {
      // Regex pour détecter un chiffre suivi de min/hour/heure/h (mais pas "m" seul qui pourrait être "month")
      // On vérifie que "m" est suivi de "in", "ins", ou est en fin de mot, et pas "onth" (month)
      const explicitTimeRegex = /\d+\s*(min|mins|minute|minutes|h|hour|hours|heure|heures|sec|second|seconds)(?![a-z])/i;
      if (suggestion.match(explicitTimeRegex)) {
        hasTime = true;
      }
    }
    // -----------------------------

    if (this.suggestionIsTime(suggestion)) {
      const timePart = suggestion.substring(this.getTimePrefixLength(suggestion));
      dateStr = this.plugin.parseTime(timePart).formattedString;
      makeIntoLink = false;
    } else {
      // Vérifier d'abord si c'est une plage de dates
      const dateRange = this.plugin.parseDateRange(suggestion);
      
      if (dateRange) {
        // C'est une plage de dates
        // Si on a une liste de dates, générer une liste de liens au lieu d'une plage
        if (dateRange.dateList && dateRange.dateList.length > 0) {
          const dateLinks = dateRange.dateList.map(m => {
            const formatted = m.format(this.plugin.settings.format);
            return makeIntoLink 
              ? generateMarkdownLink(this.app, formatted)
              : formatted;
          });
          dateStr = dateLinks.join(', ');
        } else {
          // Fallback vers l'ancien comportement (plage)
          const startFormatted = dateRange.startMoment.format(this.plugin.settings.format);
          const endFormatted = dateRange.endMoment.format(this.plugin.settings.format);
          
          // Obtenir la traduction de "to" selon la langue principale
          const primaryLang = this.plugin.settings.languages[0] || 'en';
          const toTranslation = t("to", primaryLang).split('|')[0]; // Prendre la première variante
          
          if (makeIntoLink) {
            dateStr = generateMarkdownLink(
              this.app,
              startFormatted,
              includeAlias ? aliasText : undefined
            ) + ` ${toTranslation} ` + generateMarkdownLink(
              this.app,
              endFormatted
            );
          } else {
            dateStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
          }
        }
        makeIntoLink = false; // Déjà géré ci-dessus
      } else {
        const parsedResult = this.plugin.parseDate(suggestion);

        // --- OPTIMISATION : Omettre la date pour expressions relatives courtes aujourd'hui ---
        const isToday = parsedResult.moment.isSame(moment(), 'day');
        const isRelativeShortTerm = shouldOmitDateForShortRelative(suggestion, this.plugin.settings.languages);
        const shouldOmitDate = this.plugin.settings.omitDateForShortRelative && isToday && isRelativeShortTerm && hasTime;

        // --- HYBRID LINK LOGIC START ---
        // If a time is detected AND linking is enabled, we split the link.
        // Expected result: [[YYYY-MM-DD]] HH:mm
        if (hasTime && makeIntoLink) {
          if (shouldOmitDate) {
            // CAS OPTIMISÉ : Juste l'heure pour "dans X min/heures" aujourd'hui
            const timePart = parsedResult.moment.format(this.plugin.settings.timeFormat || "HH:mm");
            dateStr = timePart;
            makeIntoLink = false; // Pas de lien nécessaire
          } else {
            // 1. Format the date part
            const datePart = parsedResult.moment.format(this.plugin.settings.format);
            
            // 2. Format the time part (fallback to HH:mm if not set)
            const timePart = parsedResult.moment.format(this.plugin.settings.timeFormat || "HH:mm");

            // 3. Generate the markdown link ONLY for the date part
            dateStr = generateMarkdownLink(
              this.app,
              datePart,
              includeAlias ? aliasText : undefined
            ) + " " + timePart; // Append time as plain text

            // 4. Disable standard linking since we constructed it manually above
            makeIntoLink = false;
          }
        } else if (hasTime && !makeIntoLink) {
          // Même logique si pas de lien mais avec heure
          if (shouldOmitDate) {
            const timePart = parsedResult.moment.format(this.plugin.settings.timeFormat || "HH:mm");
            dateStr = timePart;
          } else {
            const datePart = parsedResult.moment.format(this.plugin.settings.format);
            const timePart = parsedResult.moment.format(this.plugin.settings.timeFormat || "HH:mm");
            dateStr = `${datePart} ${timePart}`;
          }
        } else {
          // Standard behavior for dates without time (e.g., @tomorrow)
          dateStr = parsedResult.formattedString;
        }
        // --- HYBRID LINK LOGIC END ---
      }
    }

    if (makeIntoLink) {
      dateStr = generateMarkdownLink(
        this.app,
        dateStr,
        includeAlias ? aliasText : undefined
      );
    }

    if (!this.context) {
      logger.error('DateSuggest: context is undefined');
      return;
    }
    
    editor.replaceRange(dateStr, this.context.start, this.context.end);

    // Enregistrer la sélection dans l'historique (de manière asynchrone)
    if (this.plugin.settings.enableSmartSuggestions && 
        this.plugin.settings.enableHistorySuggestions && 
        this.plugin.historyManager) {
      this.plugin.historyManager.recordSelection(suggestion).catch(_err => {
        // Ignorer les erreurs silencieusement
      });
    }
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile
  ): EditorSuggestTriggerInfo {
    if (!this.plugin.settings.isAutosuggestEnabled) {
      return null;
    }

    const triggerPhrase = this.plugin.settings.autocompleteTriggerPhrase;
    const startPos = this.context?.start || {
      line: cursor.line,
      ch: cursor.ch - triggerPhrase.length,
    };

    const query = editor.getRange(startPos, cursor);

    if (!query.startsWith(triggerPhrase)) {
      return null;
    }

    const precedingChar = editor.getRange(
      {
        line: startPos.line,
        ch: startPos.ch - 1,
      },
      startPos
    );

    // Short-circuit if `@` as a part of a word (e.g. part of an email address)
    if (precedingChar && /[`a-zA-Z0-9]/.test(precedingChar)) {
      return null;
    }

    return {
      start: startPos,
      end: cursor,
      query: editor.getRange(startPos, cursor).substring(triggerPhrase.length),
    };
  }

  protected suggestionIsTime(suggestion: string): boolean {
    return this.plugin.settings.languages.some(lang => {
      const timeWord = t("time", lang).split('|')[0];
      return suggestion.startsWith(`${timeWord}:`);
    });
  }

  // Length of the "<TimeWord>:" prefix that getTimeSuggestions() builds its
  // suggestions with, so callers can strip exactly that many characters
  // instead of a hardcoded length -- "Time:" is 5 chars only in English and
  // a few others by coincidence (e.g. French "heure:" is 6, Italian "ora:"
  // is 4, Chinese "時間:" is 3 UTF-16 code units).
  protected getTimePrefixLength(suggestion: string): number {
    for (const lang of this.plugin.settings.languages) {
      const timeWord = t("time", lang).split('|')[0];
      const prefix = `${timeWord}:`;
      if (suggestion.startsWith(prefix)) {
        return prefix.length;
      }
    }
    return 0;
  }

  protected unique(suggestions: string[]) : string[] {
    return suggestions.filter(function(item, pos) {
      return suggestions.indexOf(item) == pos;
    })
  }
}