# Natural Language Dates API Documentation

Complete API reference for the Natural Language Dates (Revived) plugin for Obsidian.

## Table of Contents

- [Getting Started](#getting-started)
- [Plugin Instance](#plugin-instance)
- [Core Methods](#core-methods)
- [Parser Methods](#parser-methods)
- [Types and Interfaces](#types-and-interfaces)
- [Examples](#examples)
- [Advanced Usage](#advanced-usage)

---

## Getting Started

### Accessing the Plugin Instance

To use the Natural Language Dates API in your Obsidian plugin, you need to access the plugin instance:

```typescript
import NaturalLanguageDates from 'nldates-obsidian-revived';

// In your plugin's onload method
const nldatesPlugin = this.app.plugins.plugins['nldates-obsidian-revived'] as NaturalLanguageDates;

if (nldatesPlugin) {
  // Use the API
  const result = nldatesPlugin.parseDate("tomorrow");
}
```

### TypeScript Support

The plugin is written in TypeScript and exports all necessary types. Import them for type safety:

```typescript
import type NaturalLanguageDates from 'nldates-obsidian-revived';
import type { NLDResult, NLDRangeResult } from 'nldates-obsidian-revived/src/parser';
import type { NLDSettings, DayOfWeek } from 'nldates-obsidian-revived/src/settings';
```

---

## Plugin Instance

### Public Properties

#### `parser: NLDParser`
Direct access to the parser instance for advanced usage.

```typescript
const parser = plugin.parser;
const date = parser.getParsedDate("tomorrow", "monday");
```

#### `settings: NLDSettings`
Access to plugin settings. Read-only - use `saveSettings()` to persist changes.

```typescript
const format = plugin.settings.format; // "YYYY-MM-DD"
const languages = plugin.settings.languages; // ["en", "fr"]
```

#### `historyManager: HistoryManager`
Access to the history manager for suggestion learning.

#### `contextAnalyzer: ContextAnalyzer`
Access to the context analyzer for contextual suggestions.

---

## Core Methods

### `parse(dateString: string, format: string): NLDResult`

Parses a natural language date string and formats it according to the specified format.

**Parameters:**
- `dateString` (string): Natural language date string (e.g., "today", "tomorrow", "in 2 days", "next Monday")
- `format` (string): Moment.js format string (e.g., "YYYY-MM-DD", "DD/MM/YYYY", "MMMM Do, YYYY")

**Returns:** `NLDResult` object containing:
- `formattedString`: Formatted date string
- `date`: Native JavaScript Date object
- `moment`: Moment.js object for advanced manipulation

**Example:**
```typescript
const result = plugin.parse("tomorrow", "YYYY-MM-DD");
console.log(result.formattedString); // "2025-01-06"

const result2 = plugin.parse("next Monday", "dddd, MMMM Do");
console.log(result2.formattedString); // "Monday, January 6th"
```

**Supported Expressions:**
- Immediate dates: "today", "tomorrow", "yesterday", "now"
- Relative dates: "in 2 days", "in 3 weeks", "in 1 month"
- Combined durations: "in 2 weeks and 3 days"
- Weekdays: "next Monday", "last Friday", "this Wednesday"
- Weekdays with time: "next Monday at 3pm"
- Periods: "next week", "next month", "next year"

**Multilingual Support:**
Works with all enabled languages:
- English: "tomorrow", "in 2 days"
- French: "demain", "dans 2 jours"
- German: "morgen", "in 2 Tagen"
- Spanish: "mañana", "en 2 días"
- Italian: "domani", "tra 2 giorni"
- Portuguese: "amanhã", "em 2 dias"
- Dutch: "morgen", "over 2 dagen"
- Japanese: "明日", "2日後"

---

### `parseDate(dateString: string): NLDResult`

Parses a natural language date string using the plugin's configured date format. Automatically detects time components and includes them in the output.

**Parameters:**
- `dateString` (string): Natural language date string (e.g., "today", "tomorrow", "next Monday at 3pm")

**Returns:** `NLDResult` object with formatted string using configured format

**Example:**
```typescript
// If settings.format is "YYYY-MM-DD" and settings.timeFormat is "HH:mm"
const result = plugin.parseDate("tomorrow");
console.log(result.formattedString); // "2025-01-06"

const result2 = plugin.parseDate("next Monday at 3pm");
console.log(result2.formattedString); // "2025-01-06 15:00"
```

**Note:** This method uses the format from `plugin.settings.format` and automatically appends time format if a time component is detected.

---

### `parseDateRange(dateString: string): NLDRangeResult | null`

Parses a natural language date range string. Returns a range result with start/end dates and a list of all dates in the range.

**Parameters:**
- `dateString` (string): Natural language date range string

**Returns:** `NLDRangeResult` object or `null` if the input is not a range

**Example:**
```typescript
const range = plugin.parseDateRange("from Monday to Friday");
if (range) {
  console.log(range.startDate); // Date for Monday
  console.log(range.endDate); // Date for Friday
  console.log(range.dateList?.length); // 5
  
  // Iterate over all dates in range
  range.dateList?.forEach(date => {
    console.log(date.format("YYYY-MM-DD"));
  });
}

// Week ranges
const weekRange = plugin.parseDateRange("next week");
if (weekRange) {
  console.log(weekRange.dateList?.length); // 7 (all days of the week)
}
```

**Supported Range Expressions:**
- Weekday ranges: "from Monday to Friday" / "de lundi à vendredi"
- Week ranges: "next week" / "semaine prochaine" (returns all days of the week)

---

### `parseTime(dateString: string): NLDResult`

Parses a natural language time string using the plugin's configured time format. Extracts only the time component.

**Parameters:**
- `dateString` (string): Natural language time string (e.g., "now", "in 2 hours", "at 3pm")

**Returns:** `NLDResult` object with formatted time string

**Example:**
```typescript
// If settings.timeFormat is "HH:mm"
const result = plugin.parseTime("in 2 hours");
console.log(result.formattedString); // "17:30" (if current time is 15:30)

const result2 = plugin.parseTime("at 3pm");
console.log(result2.formattedString); // "15:00"
```

---

### `hasTimeComponent(text: string): boolean`

Checks if a text string contains a time component. Useful for determining whether to include time formatting in the output.

**Parameters:**
- `text` (string): Text string to check for time component

**Returns:** `boolean` - `true` if a time component is detected, `false` otherwise

**Example:**
```typescript
plugin.hasTimeComponent("next Monday at 3pm"); // true
plugin.hasTimeComponent("tomorrow"); // false
plugin.hasTimeComponent("in 2 hours"); // true
plugin.hasTimeComponent("dans 2 heures"); // true (French)
```

**Detected Time Expressions:**
- Explicit times: "at 3pm", "at 15:00", "à 15h"
- Time in relative expressions: "in 2 hours", "dans 2 heures"
- Works with all enabled languages

---

## Parser Methods

For advanced usage, you can access the parser directly via `plugin.parser`:

### `parser.getParsedDate(selectedText: string, weekStartPreference: DayOfWeek): Date`

Low-level parsing method that returns a raw Date object.

**Parameters:**
- `selectedText` (string): Natural language date string
- `weekStartPreference` (DayOfWeek): Day of week to consider as week start

**Returns:** `Date` object

**Example:**
```typescript
const parser = plugin.parser;
const date = parser.getParsedDate("tomorrow", "monday");
```

---

### `parser.getParsedDateRange(selectedText: string, weekStartPreference: DayOfWeek): NLDRangeResult | null`

Low-level range parsing method.

**Parameters:**
- `selectedText` (string): Natural language date range string
- `weekStartPreference` (DayOfWeek): Day of week to consider as week start

**Returns:** `NLDRangeResult` object or `null`

**Example:**
```typescript
const parser = plugin.parser;
const range = parser.getParsedDateRange("from Monday to Friday", "monday");
```

---

### `parser.hasTimeComponent(text: string): boolean`

Low-level time component detection.

**Parameters:**
- `text` (string): Text string to check

**Returns:** `boolean`

---

## Types and Interfaces

### `NLDResult`

Result object returned by date parsing methods.

```typescript
interface NLDResult {
  /** Formatted date string according to the specified format */
  formattedString: string;
  /** Native JavaScript Date object */
  date: Date;
  /** Moment.js object for advanced date manipulation */
  moment: Moment;
}
```

### `NLDRangeResult`

Result object returned by date range parsing methods.

```typescript
interface NLDRangeResult {
  /** Formatted range string (e.g., "2025-01-06 to 2025-01-10") */
  formattedString: string;
  /** Start date of the range as a native Date object */
  startDate: Date;
  /** End date of the range as a native Date object */
  endDate: Date;
  /** Start date as a Moment.js object */
  startMoment: Moment;
  /** End date as a Moment.js object */
  endMoment: Moment;
  /** Always true for range results */
  isRange: true;
  /** Optional list of all dates in the range as Moment objects */
  dateList?: Moment[];
}
```

### `NLDSettings`

Plugin settings interface.

```typescript
interface NLDSettings {
  autosuggestToggleLink: boolean;
  autocompleteTriggerPhrase: string;
  isAutosuggestEnabled: boolean;
  format: string; // Moment.js format (default: "YYYY-MM-DD")
  timeFormat: string; // Moment.js format (default: "HH:mm")
  separator: string;
  weekStart: DayOfWeek;
  languages: string[]; // Array of language codes: ["en", "fr", "de", ...]
  // Language flags (synchronized with languages array)
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
```

### `DayOfWeek`

Day of the week type.

```typescript
type DayOfWeek =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "locale-default";
```

---

## Examples

### Basic Date Parsing

```typescript
// Get plugin instance
const nldatesPlugin = this.app.plugins.plugins['nldates-obsidian-revived'] as NaturalLanguageDates;

// Parse a simple date
const tomorrow = nldatesPlugin.parseDate("tomorrow");
console.log(tomorrow.formattedString); // "2025-01-06"

// Parse with custom format
const nextWeek = nldatesPlugin.parse("next Monday", "dddd, MMMM Do");
console.log(nextWeek.formattedString); // "Monday, January 6th"
```

### Date Ranges

```typescript
// Parse a weekday range
const range = nldatesPlugin.parseDateRange("from Monday to Friday");
if (range) {
  // Get all dates in the range
  range.dateList?.forEach(date => {
    const formatted = date.format("YYYY-MM-DD");
    console.log(formatted);
    // Output:
    // 2025-01-06
    // 2025-01-07
    // 2025-01-08
    // 2025-01-09
    // 2025-01-10
  });
}

// Parse a week range
const weekRange = nldatesPlugin.parseDateRange("next week");
if (weekRange && weekRange.dateList) {
  console.log(`Week has ${weekRange.dateList.length} days`);
}
```

### Multilingual Support

```typescript
// Works with all enabled languages
const english = nldatesPlugin.parseDate("tomorrow");
const french = nldatesPlugin.parseDate("demain");
const german = nldatesPlugin.parseDate("morgen");
const spanish = nldatesPlugin.parseDate("mañana");

// All return the same date
console.log(english.date.getTime() === french.date.getTime()); // true
```

### Time Detection

```typescript
// Check if input has time component
const hasTime1 = nldatesPlugin.hasTimeComponent("next Monday at 3pm"); // true
const hasTime2 = nldatesPlugin.hasTimeComponent("tomorrow"); // false

// Parse dates with time
const withTime = nldatesPlugin.parseDate("next Monday at 3pm");
console.log(withTime.formattedString); // "2025-01-06 15:00"
```

### Advanced Date Manipulation

```typescript
const result = nldatesPlugin.parseDate("in 2 weeks and 3 days");

// Use native Date object
const date = result.date;
console.log(date.toISOString());

// Use Moment.js for advanced manipulation
const moment = result.moment;
console.log(moment.format("dddd, MMMM Do YYYY")); // "Monday, January 20th 2025"
console.log(moment.add(1, 'day').format("YYYY-MM-DD")); // "2025-01-21"
```

### Creating Daily Notes

```typescript
// Parse a date and create/open a daily note
const result = nldatesPlugin.parseDate("tomorrow");
const dailyNote = await getOrCreateDailyNote(result.moment);
await this.app.workspace.openLinkText(dailyNote.path, '', true);
```

### Custom Formatting

```typescript
// Use custom formats
const formats = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "MMMM Do, YYYY",
  "dddd, MMMM Do",
  "YYYY-MM-DD HH:mm"
];

formats.forEach(format => {
  const result = nldatesPlugin.parse("tomorrow", format);
  console.log(`${format}: ${result.formattedString}`);
});
```

---

## Advanced Usage

### Accessing Parser Directly

For advanced use cases, you can access the parser directly:

```typescript
const parser = plugin.parser;

// Access parser properties
console.log(parser.languages); // ["en", "fr", "de", ...]
console.log(parser.chronos); // Array of Chrono parsers

// Use low-level methods
const date = parser.getParsedDate("tomorrow", "monday");
```

### Working with Settings

```typescript
// Read settings
const currentFormat = plugin.settings.format;
const enabledLanguages = plugin.settings.languages;

// Modify settings (remember to save)
plugin.settings.format = "DD/MM/YYYY";
await plugin.saveSettings();
```

### Error Handling

All parsing methods validate input and handle errors gracefully:

```typescript
// Invalid input returns "Invalid date"
const result = plugin.parseDate("invalid input");
if (result.formattedString === "Invalid date") {
  console.error("Failed to parse date");
}

// Invalid format falls back to default
const result2 = plugin.parse("tomorrow", "invalid format");
// Uses DEFAULT_SETTINGS.format instead
```

### Integration with Other Plugins

```typescript
// Example: Create calendar events from parsed dates
const date = plugin.parseDate("next Monday at 3pm");
const event = {
  title: "Meeting",
  start: date.date,
  end: new Date(date.date.getTime() + 60 * 60 * 1000) // +1 hour
};
// Create event in calendar plugin...
```

---

## Moment.js Format Reference

The plugin uses Moment.js for date formatting. Common format tokens:

- `YYYY` - 4-digit year
- `MM` - 2-digit month (01-12)
- `DD` - 2-digit day (01-31)
- `HH` - 24-hour format (00-23)
- `mm` - minutes (00-59)
- `dddd` - Full weekday name (Monday, Tuesday, ...)
- `MMMM` - Full month name (January, February, ...)
- `Do` - Ordinal day (1st, 2nd, 3rd, ...)

See [Moment.js documentation](https://momentjs.com/docs/#/displaying/format/) for complete format reference.

---

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/Amato21/nldates-revived).

---

**Last Updated:** January 2025  
**Plugin Version:** 0.9.5

