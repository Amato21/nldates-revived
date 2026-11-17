// Canonical English UI-string dictionary. Every other language file under
// src/lang/ui/ must expose exactly this same set of keys (enforced by the
// `LangDict` type in helper.ts) -- only the string values differ.
//
// This is a *separate* dictionary from src/lang/en.ts (etc.): that one holds
// the words/phrases the NLP parser recognizes as input (e.g. "today",
// "tomorrow") and is keyed to match a grammar across languages. This one
// holds the plugin's own UI text (settings tab, commands, modals) and is
// keyed by identifier, selected automatically from Obsidian's own interface
// language (see detectUILanguage() in ./helper), independent of which
// languages the user enabled for date *parsing*.
const dict = {
  // Commands (Ctrl/Cmd+P palette)
  cmd_parse_date: "Parse natural language date",
  cmd_parse_date_link: "Parse natural language date (as link)",
  cmd_parse_date_clean: "Parse natural language date (as plain text)",
  cmd_parse_time: "Parse natural language time",
  cmd_insert_now: "Insert the current date and time",
  cmd_insert_today: "Insert the current date",
  cmd_insert_time: "Insert the current time",
  cmd_date_picker: "Date picker",

  // Notices
  notice_fallback_english: "Natural Language Dates: Failed to initialize with selected languages. Using English as fallback.",
  notice_critical_error: "Natural Language Dates: Critical error - parser initialization failed. Please restart Obsidian.",

  // Settings tab headings
  heading_main: "Natural language dates",
  heading_parser_settings: "Parser settings",
  heading_language_settings: "Language settings",
  heading_hotkey_formatting: "Hotkey formatting settings",
  heading_date_autosuggest: "Date autosuggest",
  heading_smart_suggestions: "Smart suggestions",
  heading_date_formatting: "Date formatting",
  heading_periodic_notes: "Periodic notes",

  // Settings tab fields
  date_format_name: "Date format",
  date_format_desc: "Output format for parsed dates",
  week_starts_on_name: "Week starts on",
  week_starts_on_desc: "Which day to consider as the start of the week",
  locale_default_option: "Locale default (%{day})",
  language_toggle_desc: "Whether to parse %{language} or not",
  note_partially_supported: "partially supported",
  note_under_development: "under development",
  time_format_name: "Time format",
  time_format_desc: "Format for the hotkeys that include the current time",
  separator_name: "Separator",
  separator_desc: "Separator between date and time for entries that have both",
  separator_placeholder: "Separator is empty",
  enable_autosuggest_name: "Enable date autosuggest",
  enable_autosuggest_desc: "Input dates with natural language. Open the suggest menu with %{trigger}",
  add_as_link_name: "Add dates as link?",
  add_as_link_desc: "If enabled, dates created via autosuggest will be wrapped in [[wikilinks]]",
  trigger_phrase_name: "Trigger phrase",
  trigger_phrase_desc: "Character(s) that will cause the date autosuggest to open",
  trigger_phrase_empty_error: "Trigger phrase cannot be empty",
  enable_smart_suggestions_name: "Enable smart suggestions",
  enable_smart_suggestions_desc: "Enable intelligent suggestions based on your usage history and document context",
  history_based_name: "History-based suggestions",
  history_based_desc: "Learn from your frequently used date patterns and prioritize them in suggestions",
  context_based_name: "Context-based suggestions",
  context_based_desc: "Suggest dates based on dates already present in the current document",
  manage_history_name: "Manage history",
  manage_history_desc: "View your suggestion history and remove individual entries, or clear it entirely",
  manage_history_button: "Manage history",
  omit_date_name: "Omit date for short relative expressions",
  omit_date_desc: "When enabled, short relative expressions for today (e.g., 'in 15 min', 'dans 2 heures') will display only the time (e.g., '14:30') instead of '[[2024-01-15]] 14:30'",
  week_format_name: "Week format",
  month_format_name: "Month format",
  quarter_format_name: "Quarter format",
  year_format_name: "Year format",
  periodic_format_desc: "Used instead of the daily Date format when an expression resolves to a whole period (e.g. \"%{examples}\"). Leave empty to keep using the daily Date format for these too.",

  // Shared templates (used across several settings)
  preview_template: "%{desc} (Preview: %{preview})",
  error_template: "%{desc} - ⚠️ %{error}",
  generic_invalid_format: "Invalid format",

  // Date picker modal
  prev_month_aria: "Previous month",
  next_month_aria: "Next month",
  date_field_name: "Date",
  date_field_placeholder: "Today",
  date_format_modal_desc: "Moment format to be used",
  add_as_link_modal_name: "Add as link?",
  quick_select_label: "Quick select:",
  button_cancel: "Never mind",
  button_insert_date: "Insert date",

  // History manager modal
  history_title: "Manage suggestion history",
  history_empty: "No history yet. Suggestions you select from the autosuggest popup will appear here.",
  clear_all_name: "Clear all history",
  clear_all_desc_confirm: "Click again to confirm -- this cannot be undone.",
  clear_all_desc_remove: "Remove all %{count} entries.",
  clear_all_button: "Clear all",
  clear_all_button_confirm: "Click again to confirm",
  entry_used_desc: "Used %{times} · last used %{lastUsed}",
  entry_used_once: "1 time",
  entry_used_times: "%{count} times",
  remove_entry_tooltip: "Remove this entry",

  // validateMomentFormat() error messages
  err_format_empty: "The format cannot be empty",
  err_format_too_long: "The format cannot exceed %{max} characters",
  err_format_invalid: "Invalid or unrecognized format",
  err_format_unsafe_chars: "The format contains characters that are not allowed",
  err_format_validation_generic: "Error while validating the format",
} as const;

export default dict;
