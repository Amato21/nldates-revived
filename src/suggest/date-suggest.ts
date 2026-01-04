import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView,
  TFile,
} from "obsidian";
import type NaturalLanguageDates from "src/main";
import t from "../lang/helper";
import { generateMarkdownLink } from "src/utils";

export default class DateSuggest extends EditorSuggest<string> {
  private plugin: NaturalLanguageDates;

  constructor(app: App, plugin: NaturalLanguageDates) {
    super(app);
    this.app = app;
    this.plugin = plugin;

    const scope = this.scope as typeof this.scope & {
      register: (modifiers: string[], key: string, callback: (evt: KeyboardEvent) => boolean) => void;
    };
    scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
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
    // Get standard suggestions
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

        return this.defaultSuggestions(context.query, language);
      }
    ));

    // If smart suggestions are disabled, return standard suggestions
    if (!this.plugin.settings.enableSmartSuggestions) {
      return standardSuggestions;
    }

    // Get smart suggestions (history + context)
    const smartSuggestions = this.getSmartSuggestions(context, standardSuggestions);

    // Merge: smart suggestions first, then standard suggestions
    const merged = [...smartSuggestions];
    for (const suggestion of standardSuggestions) {
      if (!merged.includes(suggestion)) {
        merged.push(suggestion);
      }
    }

    return merged;
  }

  /**
   * Gets smart suggestions based on history and context
   */
  private getSmartSuggestions(context: EditorSuggestContext, standardSuggestions: string[]): string[] {
    const smartSuggestions: string[] = [];
    const query = context.query.toLowerCase();

    // History-based suggestions
    if (this.plugin.settings.enableHistorySuggestions && this.plugin.historyManager) {
      try {
        const historySuggestions = this.plugin.historyManager.getTopSuggestionsSync(15);
        for (const suggestion of historySuggestions) {
          // Check that suggestion matches the query
          if (suggestion.toLowerCase().startsWith(query) && !smartSuggestions.includes(suggestion)) {
            smartSuggestions.push(suggestion);
          }
        }
      } catch (error) {
        // Ignore errors silently
      }
    }

    // Context-based suggestions
    if (this.plugin.settings.enableContextSuggestions && this.plugin.contextAnalyzer && context.editor) {
      try {
        const contextInfo = this.plugin.contextAnalyzer.analyzeContextSync(
          context.editor,
          context.start.line
        );
        
        // Add dates found in context
        for (const dateStr of contextInfo.datesInContext) {
          if (dateStr.toLowerCase().startsWith(query) && !smartSuggestions.includes(dateStr)) {
            smartSuggestions.push(dateStr);
          }
        }
      } catch (error) {
        // Ignore errors silently
      }
    }

    return smartSuggestions;
  }

  private getTimeSuggestions(inputStr: string, lang: string): string[] {
    if (inputStr.match(new RegExp(`^${t("time", lang)}`))) {
      return [
        t("now", lang),
        t("plusminutes", lang, { timeDelta: "15" }),
        t("plushour", lang, { timeDelta: "1" }),
        t("minusminutes", lang, { timeDelta: "15" }),
        t("minushour", lang, { timeDelta: "1" }),
      ]
        .map(val => `${t("time", lang)}:${val}`)
        .filter(item => item.toLowerCase().startsWith(inputStr));
    }
  }

  private getImmediateSuggestions(inputStr: string, lang: string): string[] {
    const regexp = new RegExp(`(${t("next", lang)}|${t("last", lang)}|${t("this", lang)})`, "i")
    const match = inputStr.match(regexp)
    if (match) {
      const reference = match[1]
      // Take only the first variant (before |) for suggestions
      const getFirstVariant = (val: string) => val.split('|')[0];
      return [
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
          // Capitalize first letter for better display
          return firstVariant.charAt(0).toUpperCase() + firstVariant.slice(1);
        })
        .map(val => `${reference} ${val}`)
        .filter(items => items.toLowerCase().startsWith(inputStr));
    }
  }

  private getRelativeSuggestions(inputStr: string, lang: string): string[] {
    // First check combined expressions like "in 1 month and" or "dans 1 mois et"
    // Allow progressive typing: "in 1 month and", "in 1 month and 3", "in 3 month and", etc.
    const andPattern = t("and", lang).split('|')[0]; // Take first variant
    // More flexible regex that allows typing after "and"
    const combinedRegex = new RegExp(`^(${t("in", lang)} )?([+-]?\\d+)\\s+(${t("minute", lang)}|${t("hour", lang)}|${t("day", lang)}|${t("week", lang)}|${t("month", lang)}|${t("year", lang)})\\s+(${andPattern})(\\s+.*)?$`, "i");
    const combinedMatch = inputStr.match(combinedRegex);
    if (combinedMatch) {
      const timeDelta1 = combinedMatch[2];
      const unit1 = combinedMatch[3];
      const afterAnd = combinedMatch[5] ? combinedMatch[5].trim() : '';
      
      // Extract part before "and" to rebuild correctly
      const beforeAnd = inputStr.substring(0, inputStr.indexOf(combinedMatch[4]) + combinedMatch[4].length).trimEnd();
      
      // If we've already started typing after "and", extract the number if present
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
          // unitPart is like "3 days" or "5 minutes"
          if (afterAnd) {
            // If we've already started typing, complete intelligently
            // unitPart starts with the number (ex: "3 days")
            const unitWords = unitPart.split(' ');
            if (unitWords.length > 1 && unitWords[0] === suggestedNumber) {
              // Number matches, we can suggest the rest (ex: "days")
              const remaining = unitPart.substring(suggestedNumber.length).trim();
              if (afterAndWithoutNumber) {
                // If we typed something after the number, check if it matches
                if (remaining.toLowerCase().startsWith(afterAndWithoutNumber.toLowerCase())) {
                  return `${beforeAnd} ${suggestedNumber}${remaining.substring(afterAndWithoutNumber.length)}`;
                }
                return null;
              } else {
                // We just typed the number, suggest the rest
                return `${beforeAnd} ${unitPart}`;
              }
            }
            // If the complete unit starts with what we typed (without the number)
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

    // Check partial date ranges like "de lundi à" or "from monday to"
    // Allow progressive typing: "de lundi a", "de lundi a v", "de lundi a ve", etc.
    const fromPattern = t("from", lang).split('|')[0];
    const toPattern = t("to", lang).split('|')[0];
    // More flexible regex that allows progressive typing after "à" or "a"
    const rangePartialRegex = new RegExp(`^(${fromPattern}|de|du)\\s+(${t("sunday", lang)}|${t("monday", lang)}|${t("tuesday", lang)}|${t("wednesday", lang)}|${t("thursday", lang)}|${t("friday", lang)}|${t("saturday", lang)})\\s+(${toPattern}|à|a)(\\s+.*)?$`, "i");
    const rangePartialMatch = inputStr.match(rangePartialRegex);
    if (rangePartialMatch) {
      const startDay = rangePartialMatch[2];
      const afterTo = rangePartialMatch[4] ? rangePartialMatch[4].trim() : '';
      // Extract part before "à" or "a" to rebuild correctly
      const beforeTo = inputStr.substring(0, inputStr.indexOf(rangePartialMatch[3]) + rangePartialMatch[3].length).trimEnd();
      
      // Generate suggestions for possible end days
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
            // If we've already started typing, filter days that start with this text
            if (day.toLowerCase().startsWith(afterTo.toLowerCase())) {
              // Replace "afterTo" with complete day
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
        t("daysago", lang, { timeDelta }),
        t("weeksago", lang, { timeDelta }),
        t("monthsago", lang, { timeDelta }),
      ].filter(items => items.toLowerCase().startsWith(inputStr.toLowerCase()));
      return suggestions;
    }
  }

  private defaultSuggestions(inputStr: string, lang: string): string[] {
    return [
      t("today", lang),
      t("yesterday", lang),
      t("tomorrow", lang),
    ].filter(item => item.toLowerCase().startsWith(inputStr));
  }

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    el.setText(suggestion);
  }

  selectSuggestion(suggestion: string, event: KeyboardEvent | MouseEvent): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const includeAlias = event.shiftKey;
    let dateStr = "";
    let makeIntoLink = this.plugin.settings.autosuggestToggleLink;

    // We check if the input contains a time component using the parser logic.
    let hasTime = this.plugin.hasTimeComponent(suggestion);

    // --- MULTILINGUAL FIX ---
    // If parser didn't detect time (often the case in English for "in 2 minutes"),
    // force detection if we see explicit keywords (min, hour, etc).
    // IMPORTANT: Don't match "m" in "month" - verify it's a time word
    if (!hasTime) {
      // Regex to detect a number followed by min/hour/heure/h (but not "m" alone which could be "month")
      // We check that "m" is followed by "in", "ins", or is at end of word, and not "onth" (month)
      const explicitTimeRegex = /\d+\s*(min|mins|minute|minutes|h|hour|hours|heure|heures|sec|second|seconds)(?![a-z])/i;
      if (suggestion.match(explicitTimeRegex)) {
        hasTime = true;
      }
    }
    // -----------------------------

    if (this.suggestionIsTime(suggestion)) {
      const timePart = suggestion.substring(5);
      dateStr = this.plugin.parseTime(timePart).formattedString;
      makeIntoLink = false;
    } else {
      // First check if it's a date range
      const dateRange = this.plugin.parseDateRange(suggestion);
      
      if (dateRange) {
        // It's a date range
        // If we have a date list, generate a list of links instead of a range
        if (dateRange.dateList && dateRange.dateList.length > 0) {
          const dateLinks = dateRange.dateList.map(moment => {
            const formatted = moment.format(this.plugin.settings.format);
            return makeIntoLink 
              ? generateMarkdownLink(this.app, formatted)
              : formatted;
          });
          dateStr = dateLinks.join(', ');
        } else {
          // Fallback to old behavior (range)
          const startFormatted = dateRange.startMoment.format(this.plugin.settings.format);
          const endFormatted = dateRange.endMoment.format(this.plugin.settings.format);
          
          // Get translation of "to" according to primary language
          const primaryLang = this.plugin.settings.languages[0] || 'en';
          const toTranslation = t("to", primaryLang).split('|')[0]; // Take first variant
          
          if (makeIntoLink) {
            dateStr = generateMarkdownLink(
              this.app,
              startFormatted,
              includeAlias ? suggestion : undefined
            ) + ` ${toTranslation} ` + generateMarkdownLink(
              this.app,
              endFormatted
            );
          } else {
            dateStr = `${startFormatted} ${toTranslation} ${endFormatted}`;
          }
        }
        makeIntoLink = false; // Already handled above
      } else {
        const parsedResult = this.plugin.parseDate(suggestion);

        // --- HYBRID LINK LOGIC START ---
        // If a time is detected AND linking is enabled, we split the link.
        // Expected result: [[YYYY-MM-DD]] HH:mm
        if (hasTime && makeIntoLink) {
          // 1. Format the date part
          const datePart = parsedResult.moment.format(this.plugin.settings.format);
          
          // 2. Format the time part (fallback to HH:mm if not set)
          const timePart = parsedResult.moment.format(this.plugin.settings.timeFormat || "HH:mm");

          // 3. Generate the markdown link ONLY for the date part
          dateStr = generateMarkdownLink(
            this.app,
            datePart,
            includeAlias ? suggestion : undefined
          ) + " " + timePart; // Append time as plain text

          // 4. Disable standard linking since we constructed it manually above
          makeIntoLink = false; 
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
        includeAlias ? suggestion : undefined
      );
    }

    if (!this.context) {
      console.error('DateSuggest: context is undefined');
      return;
    }
    
    activeView.editor.replaceRange(dateStr, this.context.start, this.context.end);

    // Record selection in history (asynchronously)
    if (this.plugin.settings.enableSmartSuggestions && 
        this.plugin.settings.enableHistorySuggestions && 
        this.plugin.historyManager) {
      this.plugin.historyManager.recordSelection(suggestion).catch(err => {
        // Ignore errors silently
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
    return this.plugin.settings.languages.some(lang => suggestion.startsWith(t("time", lang)))
  }

  protected unique(suggestions: string[]) : string[] {
    return suggestions.filter(function(item, pos) {
      return suggestions.indexOf(item) == pos;
    })
  }
}