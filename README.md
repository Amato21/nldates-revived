# Natural Language Dates (Revived) 🌍

This is a **revived and improved version** of the popular "Natural Language Dates" plugin for Obsidian.
It brings the plugin back to life with a modern engine, true multilingual support, and smarter time handling.

---

## Supported Languages

Enable any combination in **Settings → Natural Language Dates → Language settings**. All examples in this README use English, but every feature below works the same way in each of these:

| Language | Status |
|---|---|
| English | Full support |
| French | Full support |
| Spanish | Full support |
| Italian | Full support |
| Russian | Full support |
| Ukrainian | Full support |
| Chinese (Traditional & Simplified) | Partially supported |
| German | Partially supported |
| Portuguese | Partially supported |
| Japanese | Full support |
| Dutch | Under development |

You can enable several languages at once — the autosuggest and parser understand all of them simultaneously.

---

## How to Install

### Via Obsidian Community Plugins (Recommended)
1.  Open **Settings → Community plugins** in Obsidian.
2.  Click **Browse** and search for "Natural Language Dates (Revived)".
3.  Install and enable it.

### Via BRAT (for the latest beta builds)
To get updates ahead of the official release, use the **BRAT** plugin:
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
* **Weekday shortcuts:**
  * `@Monday` → next Monday (or today if it's Monday)
  * `@this Monday` → Monday of the current week (even if already elapsed)
  * `@last Monday` → Monday of the previous week
  * `@next Monday` → Monday of the next week
  * Abbreviations also work: `@mon`, `@tue`, `@wed`, `@thu`, `@fri`, `@sat`, `@sun`
* `@3 minutes ago` → `14:27` (past expressions, in every supported language)
* `@2 hours ago` → `12:30`
* `@from Monday to Friday` → `[[2025-01-06]], [[2025-01-07]], [[2025-01-08]], [[2025-01-09]], [[2025-01-10]]`
* `@next week` → `[[2025-01-06]], [[2025-01-07]], [[2025-01-08]], [[2025-01-09]], [[2025-01-10]], [[2025-01-11]], [[2025-01-12]]`
* **Complex date expressions:**
  * `@the 15th of next month` → `[[2025-02-15]]`
  * `@last day of month` → last day of the current month
  * `@last day of next month` → last day of next month
  * `@first Monday of month` → first Monday of the current month
  * `@first Monday of next month` → first Monday of next month
  * `@last Friday of next month` → last Friday of next month
  * Works with all prefixes (`next`, `last`, `this`) and their translations in every supported language

* **Time shortcuts:** type the word for "time" in one of your **enabled** languages to see quick time-adjustment suggestions — `@Time` in English, `@heure` in French, and so on for each language:
  * `Time:Now` → inserts the current time (e.g. `14:30`)
  * `Time:+15 minutes` / `Time:+1 hour` → time 15 minutes / 1 hour from now
  * `Time:-15 minutes` / `Time:-1 hour` → time 15 minutes / 1 hour ago
  * These insert just the time, with no date or link — handy for logging timestamps
  * Only works for a language you've actually enabled in settings — `@Time` won't trigger anything if only French is enabled, only `@heure` will

Press <kbd>Shift</kbd> + <kbd>Enter</kbd> to keep the original text as an alias (e.g. `[[2024-12-30|today]]`). If you type the full word yourself, the alias keeps your exact casing instead of the suggestion's own — handy in languages where the dictionary form is capitalized (French `Demain`, for instance) but you'd rather see it lowercase in your note. Only completing a partial word falls back to the suggestion's own spelling.

![Obsidian_ldWoN5Xnt8](https://github.com/user-attachments/assets/7a876604-7b59-40e0-acd5-8d7370c1d0d0)

### Commands (Ctrl/Cmd + P)
* **Parse natural language date:** Replaces selected text with a link (e.g. select "tomorrow" -> becomes `[[2024-12-31]]`).
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
    * **History-based suggestions:** Learn from your frequently used date patterns. Ranking favors what you've picked *recently*, not just most often overall — something you used a lot months ago naturally fades if you haven't reached for it lately, while anything you reuse jumps back to the top.
    * **Context-based suggestions:** Detect dates already mentioned in the current document (within ±10 lines of the cursor) and suggest them
* **Date Formatting:**
    * **Omit date for short relative expressions:** When enabled, short relative expressions for today (e.g., `@in 15 min`, `@in 2 hours`) will display only the time (e.g., `14:30`) instead of `[[2024-01-15]] 14:30` (enabled by default)

**Note:** History data is stored in `.obsidian/plugins/nldates-revived/history.json` and is limited to the 100 most relevant entries for optimal performance.

### URI Action
Open (or create) a daily note from outside Obsidian — e.g. from a Shortcuts automation, a script, or another app:

```
obsidian://nldates?day=tomorrow&newPane=yes
```

`day` accepts any natural language expression the plugin understands. `newPane` (`yes`/`no`, default `yes`) controls whether the note opens in a new pane.

---

## 🔧 For Developers

Building an integration against the plugin's TypeScript API? See **[API.md](API.md)** for the complete reference: accessing the plugin instance, all public methods and types, and usage examples.

---

## 🙏 Credits & Acknowledgements

This project stands on the shoulders of giants. Huge thanks to:

* **[Argentina Ortega Sainz (argenos)](https://github.com/argenos):** The original creator of this plugin. This revival is based on their excellent work.
* **[RensOliemans](https://github.com/RensOliemans):** For the major contributions and foundational work on the multilingual support.
* **Amato21:** Maintainer of this "Revived" version.

Powered by the [chrono-node](https://github.com/wanasit/chrono) library.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

## Development Troubleshooting

If `npm install` fails with an `ENOTEMPTY` rename error, remove `node_modules/` and retry. If you see `403 Forbidden` while fetching packages, confirm that your registry access is allowed by your network or security policy before retrying. This helps avoid stalled installs when running the project locally. Keep any local install logs out of version control.

---

## Maintenance & Community

This project is **open source** (MIT License). The primary goal is to provide a working, reliable tool for the Obsidian community.

**Community First:** If this repository becomes inactive or unmaintained in the future, please feel free to fork it and take over maintenance immediately—no permission needed! The community's needs come first, and we'd be delighted to see the project continue to evolve and improve.

Your contributions, forks, and improvements are always welcome! 🚀
