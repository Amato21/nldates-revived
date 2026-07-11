import t from "./lang/helper";

/**
 * Collects and caches translated words across multiple languages, and builds
 * regex alternations from them.
 *
 * Every supported language can define several variants for the same concept
 * (e.g. French "next": "prochain|prochaine|suivant|suivante"), and every
 * feature of the parser needs to gather those variants across *all* active
 * languages before building a regex out of them. This class centralizes that
 * "look up a translation key in every active language, split multi-variant
 * entries on '|', trim, dedupe" pattern, which used to be repeated inline
 * roughly fifteen times throughout NLDParser (and, less exhaustively, in
 * ContextAnalyzer and utils.ts).
 */
export class TranslationCollector {
  private readonly translationCache = new Map<string, string>();

  constructor(private readonly languages: string[]) {}

  /**
   * Gets a translation with caching for performance.
   */
  translate(key: string, lang: string): string {
    const cacheKey = `${lang}:${key}`;
    if (!this.translationCache.has(cacheKey)) {
      this.translationCache.set(cacheKey, t(key, lang));
    }
    return this.translationCache.get(cacheKey)!;
  }

  /**
   * Collects every variant of `key`'s translation across all active languages,
   * splitting multi-variant entries (e.g. "a|b|c") on "|", trimming, and
   * de-duplicating. Entries that aren't found for a given language are skipped.
   *
   * @param key - Translation key (e.g. "next", "monday", "indays")
   * @param options.lowercase - Lowercase each variant (default: false)
   */
  collectWords(key: string, options: { lowercase?: boolean } = {}): string[] {
    const words: string[] = [];
    for (const lang of this.languages) {
      const translation = this.translate(key, lang);
      if (!translation || translation === "NOTFOUND") continue;

      for (const variant of translation.split("|")) {
        const trimmed = variant.trim();
        // No current language dictionary entry has an empty "||" segment or
        // a trailing/leading "|", so this guard can't actually be false with
        // real data -- kept in case a future dictionary entry is malformed.
        if (trimmed) {
          words.push(options.lowercase ? trimmed.toLowerCase() : trimmed);
        }
      }
    }
    return [...new Set(words)];
  }

  /**
   * Builds a regex alternation ("a|b|c") from a list of words, escaping regex
   * special characters.
   *
   * Longest words are sorted first: otherwise a shorter word that is a prefix
   * of a longer one (e.g. French "prochain" vs "prochaine") can match first
   * and leave the remaining letters to be mis-captured by whatever comes next
   * in the pattern.
   */
  buildAlternation(words: string[]): string {
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...new Set(words)]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|');
  }

  /**
   * Convenience: collectWords(key) followed by buildAlternation() in one call.
   */
  buildAlternationFor(key: string, options: { lowercase?: boolean } = {}): string {
    return this.buildAlternation(this.collectWords(key, options));
  }
}
