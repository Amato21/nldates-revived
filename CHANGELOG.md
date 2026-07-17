# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.9.71] - 2026-07-17

### Added
- Autosuggest now tolerates a small typo (a wrong, missing, or transposed letter) when typing today/tomorrow/yesterday, a weekday's full name, or a history/context suggestion, instead of showing no suggestions at all. Verified across every Latin- and Cyrillic-script supported language; Japanese and Chinese are unaffected by design, since their short CJK words aren't typed letter-by-letter.
- Settings → Smart suggestions → **Manage history**: view your suggestion history (most relevant first) and remove individual entries, or clear the whole history at once.

### Fixed
- Combining a day keyword with a relative time expression (e.g. `@today in 3 minutes`, `@aujourd'hui dans 3 minutes`) resolved to the right date but the *current* time instead of the requested offset — chrono-node returns multiple disjoint matches for this kind of input, and only the first one was ever considered. Reported and reproduced in both English and French.
- `getWordBoundaries()` (used by every parse command invoked with no text selected) crashed when the cursor sat on an empty line or between non-word characters.
- A corrupted `history.json` (interrupted write, sync conflict) was silently wiped with no logging.
- Ordinal-only dates like `@15th` resolved to the wrong month (and sometimes the wrong year) due to a 0-indexed/1-indexed mismatch between moment.js and chrono-node.
- `@adesso` (Italian "now") and `@現在`/`@现在` (Chinese "now") weren't recognized as carrying a time component, for any language whose translation lists multiple variants.
- The "failed to initialize with selected languages" and "critical parser error" notifications never actually displayed (they called a non-existent Obsidian API).
- The autosuggest popup could return zero suggestions for Chinese input containing the character "下" (e.g. 下午, 下雨) due to an unanchored regex matching mid-word.
- Selecting a "Time:" suggestion inserted a truncated or garbled result for French, Italian, Japanese, Russian, Ukrainian, and Chinese (hardcoded English-only string length).
- Clearing the "Trigger phrase" setting made the autosuggest popup fire on nearly every keystroke; the field now rejects an empty value.
- The Date Picker's manual text input overwrote itself while the user was still typing, whenever the partial text already parsed to a valid date.
- The cursor could land in the wrong position after a parse command run with no selection and the cursor mid-word.
- `ContextAnalyzer`: multi-word context suggestions (e.g. "next Friday") had their second word forcibly lowercased ("Next friday").
- `ContextAnalyzer`: editing text near the cursor without moving to a different line could serve a stale cached suggestion for up to 5 seconds.
- `HistoryManager`: multi-word history-based suggestions had the same lowercasing bug as `ContextAnalyzer`.
- <kbd>Shift</kbd>+select ("keep text as alias") used the suggestion's dictionary casing instead of what the user actually typed (e.g. French `@demain` → alias "Demain" instead of "demain").

### Changed
- History-based suggestions are now ranked by frequency weighted by recency (a 30-day half-life) instead of raw lifetime count, so a suggestion used heavily months ago no longer permanently outranks one used a few times this week. Existing `history.json` files are migrated automatically.
- Improved internal type safety across language dictionaries and context caching (no user-facing behavior change).

### Known limitations
- Combining a day keyword with a relative time (e.g. `@today in 3 minutes`) doesn't advance the time in Portuguese, Japanese, or Chinese — chrono-node's own parser for these three locales drops the relative-time portion of the phrase entirely, so there's nothing for the fix above to pick between. Standalone `@in 3 minutes` (no day keyword) already works correctly in every language. Tracked in [#40](https://github.com/Amato21/nldates-revived/issues/40).

## [0.9.7] - 2026-07-17

### Fixed
- `@now`, `@in 20 minutes`, and other expressions relative to the current instant were getting cached for a whole day, causing them to return the same stale timestamp on every call after the first. Thanks to [@raeglan](https://github.com/raeglan) for the report!
- Removed leftover ES5 transpilation helpers (`__awaiter`, `__generator`, `__spreadArray`) from the build output by targeting ES2020.

## [0.9.6] - 2026-07-11

### Fixed
- Removed a regex lookbehind that isn't supported on iOS/Safari before 16.4, which could break date detection on older devices.
- Replaced runtime `<style>` element injection in the date picker with a proper `styles.css` file, per Obsidian's plugin guidelines.
- Fixed dark-mode/theme detection to use `activeDocument` for compatibility with pop-out windows.

## [0.9.5] - 2026-07-11

### Added
- **Past time expressions** in all 11 supported languages: `@il y a 3 min`, `@3 minutes ago`, `@vor 2 Stunden`, `@hace 5 minutos`. Suggestions now include past expressions alongside future ones.
- **Smart date formatting:** short relative expressions for today (e.g. `@in 15 min`, `@in 2 hours`) now display only the time (e.g. `14:30`) instead of the full `[[2024-01-15]] 14:30`.
- **Complex date expressions:** ordinal dates (`@the 15th of next month`), last day of month (`@last day of month`), and first/last weekday of month (`@first Monday of month`), all multilingual.
- Input sanitization, format validation with live preview, and URI parameter validation.
- Complete JSDoc + `API.md` developer documentation.

## [0.9.0] - 2026-01-05

### Added
- **Complete multilingual engine:** English, French, German, Japanese, Dutch, Portuguese, Spanish, Italian, Russian, Ukrainian, and Chinese (Traditional and Simplified), with dynamically generated regex from translations.
- **Advanced relative dates:** combined durations (`@in 2 weeks and 3 days`), weekday with time (`@next Monday at 3pm`), date ranges (`@from Monday to Friday`), and week ranges (`@next week`).
- **Smart contextual suggestions:** history-based suggestions and document-context-aware date detection, toggleable individually in settings.

## [0.8.0] - 2025-12-30

### Added
- **Multilingual support:** English, French, German, Japanese, Dutch, and Portuguese. Major contributions by [@RensOliemans](https://github.com/RensOliemans).
- **Smart time parsing:** detects whether a parsed expression includes a time component.
- **Hybrid links:** dates without a time produce `[[2024-12-30]]`; dates with a time produce `[[2024-12-30]] 23:45` instead of embedding the time in the link itself.

### Fixed
- Command palette commands (e.g. "Parse natural language date") now work correctly with selected text.
