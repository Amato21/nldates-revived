# Natural Language Dates (Revived) 🌍

This is a **revived and improved version** of the popular "Natural Language Dates" plugin for Obsidian.
It brings the plugin back to life with a modern engine, true multilingual support, and smarter time handling.

## New Features

### v0.9.5 - Security & Documentation Improvements
* **Input Validation & Security:**
    * Complete input sanitization to prevent injection attacks
    * Format validation with real-time preview in settings
    * URI parameter validation for secure protocol handling
    * Input length limits and character validation
* **API Documentation:**
    * Complete JSDoc documentation for all public methods
    * Comprehensive API.md guide for developers
    * TypeScript type definitions fully documented
    * Code examples and integration guides
* **Format Validation:**
    * Real-time format validation in settings with preview
    * Clear error messages for invalid formats
    * Automatic fallback to default formats on error
    * Protection against dangerous characters in formats

### v0.9.0 - Advanced Multilingual Support 🚀
* **🌍 Complete Multilingual Engine:** Full support for **English, French, German, Japanese, Dutch, Portuguese, Spanish, and Italian**!
    * Each language works **100%** with its own native words and units
    * *Examples:* `@ato 2 fun` (Japanese), `@in 2 Minuten` (German), `@dans 2 min` (French), `@over 2 minuten` (Dutch), `@en 2 minutos` (Spanish), `@tra 2 minuti` (Italian)
    * All time units (minutes, hours, days, weeks, months, years) are fully translated
    * All weekdays are recognized in all languages
    * Dynamic regex generation from translations - no hardcoded words!
* **Advanced Relative Dates:** Support for complex date expressions!
    * **Combined durations:** `@in 2 weeks and 3 days`, `@dans 2 semaines et 3 jours`
    * **Weekday with time:** `@next Monday at 3pm`, `@prochain lundi à 15h`
    * **Date ranges:** `@from Monday to Friday`, `@de lundi à vendredi`
    * **Week ranges:** `@next week` (returns Monday to Sunday of next week)
    * **Past expressions:** `@il y a 3 min`, `@3 minutes ago`, `@vor 2 Stunden` (all languages!)
    * **Smart formatting:** Short relative expressions for today show only time (e.g., `@in 15 min` → `14:30` instead of `[[2024-01-15]] 14:30`)
    * Works in all supported languages with native translations
* **Smart Contextual Suggestions:** Intelligent suggestions that learn from you!
    * **History-based suggestions:** The plugin learns your frequently used date patterns and prioritizes them in suggestions
    * **Context-aware detection:** Automatically detects dates already present in your current document (within ±10 lines) and suggests them
    * **Multi-language context detection:** Context analysis works with all enabled languages - detects dates in French, English, Japanese, and more!
    * **Optimized performance:** No vault-wide caching - only analyzes the current document for fast, efficient suggestions
    * All smart features can be toggled on/off individually in settings

### v0.8.0
* **🌍 Multilingual Support:** Now supports **English, French, German, Japanese, Dutch, and Portuguese**!
    * *Examples:* `@tomorrow`, `@in 20 minutes`, `@Next Monday`, `@next friday`.
* **Smart Time Parsing:** The plugin intelligently detects if you included a time in your sentence.
* **Hybrid Links:**
    * Dates without time: `[[2024-12-30]]`
    * Dates **with** time: `[[2024-12-30]] 23:45` (Keeps your graph clean!).

---

## How to Install

### Via BRAT (Recommended for now)
Since this is a new fork, the quickest way to get updates is via the **BRAT** plugin:
1.  Install **BRAT** from the Community Plugins store.
2.  Add a Beta Plugin with this URL: `https://github.com/Amato21/nldates-revived`
3.  Enjoy!

---

## Usage

### Date Autosuggest
Type `@` (default trigger) followed by a natural date.

* `@today` → `[[2024-12-30]]`
* `@tomorrow` → `[[2024-12-31]]`
* `@in 20 minutes` → `14:30` (smart formatting: only time when it's today!)
* `@in 2 hours` → `16:30` (smart formatting for today)
* `@in 2 weeks and 3 days` → `[[2025-01-22]]` (full date for future dates)
* `@next Monday at 3pm` → `[[2025-01-06]] 15:00`
* `@il y a 3 min` → `14:27` (past expressions supported!)
* `@3 minutes ago` → `14:27` (works in all languages)
* `@from Monday to Friday` → `[[2025-01-06]], [[2025-01-07]], [[2025-01-08]], [[2025-01-09]], [[2025-01-10]]`
* `@next week` → `[[2025-01-06]], [[2025-01-07]], [[2025-01-08]], [[2025-01-09]], [[2025-01-10]], [[2025-01-11]], [[2025-01-12]]`

Press <kbd>Shift</kbd> + <kbd>Enter</kbd> to keep the original text as an alias (e.g. `[[2024-12-30|today]]`).

![Obsidian_ldWoN5Xnt8](https://github.com/user-attachments/assets/7a876604-7b59-40e0-acd5-8d7370c1d0d0)

### Commands (Ctrl/Cmd + P)
* **Parse natural language date:** Replaces selected text with a link (e.g. select "demain" -> becomes `[[2024-12-31]]`).
* **Insert the current date and time:** Quickly insert a timestamp with both date and time.
* **Insert the current date:** Inserts only the current date.
* **Insert the current time:** Inserts only the current time.
* **Date Picker:** Opens a calendar view to pick a date visually.

### Configuration
Go to **Settings > Natural Language Dates**:
* **Languages:** Check the languages you want to enable.
* **Date Format:** How the date part looks (e.g. `YYYY-MM-DD`).
* **Time Format:** How the time part looks (e.g. `HH:mm`).
* **Separator:** Character between date and time (if used).
* **Smart Suggestions:** Enable intelligent suggestions (enabled by default)
    * **Enable smart suggestions:** Master toggle for all intelligent features
    * **History-based suggestions:** Learn from your frequently used date patterns
    * **Context-based suggestions:** Detect dates from the current document context

**Note:** History data is stored in `.obsidian/plugins/nldates-revived/history.json` and is limited to 100 most frequent entries for optimal performance.

---

## 🙏 Credits & Acknowledgements

This project stands on the shoulders of giants. Huge thanks to:

* **[Argentina Ortega Sainz (argenos)](https://github.com/argenos):** The original creator of this plugin. This revival is based on their excellent work.
* **[RensOliemans](https://github.com/RensOliemans):** For the major contributions and foundational work on the multilingual support.
* **Amato21:** Maintainer of this "Revived" version.

Powered by the [chrono-node](https://github.com/wanasit/chrono) library.

---

## 🔧 For Developers & API

### Complete API Documentation

For complete API documentation, see **[API.md](API.md)** - a comprehensive guide with:
- All public methods and their parameters
- TypeScript interfaces and types
- Code examples for common use cases
- Advanced usage patterns
- Integration examples

### Quick Start

**Accessing the Plugin:**
```typescript
const nldatesPlugin = app.plugins.plugins['nldates-obsidian-revived'] as NaturalLanguageDates;
```

**Basic Usage:**
```typescript
// Parse a date
const result = nldatesPlugin.parseDate("tomorrow");
console.log(result.formattedString); // "2025-01-06"

// Parse with custom format
const custom = nldatesPlugin.parse("next Monday", "dddd, MMMM Do");
console.log(custom.formattedString); // "Monday, January 6th"

// Parse date ranges
const range = nldatesPlugin.parseDateRange("from Monday to Friday");
if (range) {
  console.log(range.dateList?.length); // 5
  range.dateList?.forEach(date => {
    console.log(date.format("YYYY-MM-DD"));
  });
}

// Check for time component
const hasTime = nldatesPlugin.hasTimeComponent("next Monday at 3pm"); // true
```

**URI Action:** `obsidian://nldates?day=tomorrow&newPane=yes`

**TypeScript Support:**
```typescript
import type NaturalLanguageDates from 'nldates-obsidian-revived';
import type { NLDResult, NLDRangeResult } from 'nldates-obsidian-revived/src/parser';
import type { NLDSettings } from 'nldates-obsidian-revived/src/settings';
```

### Architecture

The plugin uses a modular architecture with specialized components:

* **`HistoryManager`** (`src/history-manager.ts`): Manages user selection history
    * Stores frequently used date patterns (max 100 entries)
    * Provides synchronous cache for fast suggestions
    * Normalizes suggestions (capitalizes first letter for consistency)
    * Persists data to `.obsidian/plugins/nldates-revived/history.json`

* **`ContextAnalyzer`** (`src/context-analyzer.ts`): Analyzes document context for smart suggestions
    * Scans ±10 lines around cursor for date patterns
    * Uses dynamic regex patterns generated from translations (multi-language support)
    * Implements temporary caching (5 seconds) for performance
    * Automatically updates patterns when languages change
    * Supports all enabled languages (French, English, Japanese, German, Spanish, Italian, Portuguese, Dutch)

Both components are optimized for performance: no vault-wide scanning, only analyzes the current document, and uses efficient caching strategies.

---

## Maintenance & Community

This project is **open source** (MIT License). The primary goal is to provide a working, reliable tool for the Obsidian community.

**Community First:** If this repository becomes inactive or unmaintained in the future, please feel free to fork it and take over maintenance immediately—no permission needed! The community's needs come first, and we'd be delighted to see the project continue to evolve and improve.

Your contributions, forks, and improvements are always welcome! 🚀