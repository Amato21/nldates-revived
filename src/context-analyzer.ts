import { App, MarkdownView, Editor } from "obsidian";
import type NaturalLanguageDates from "./main";
import { LRUCache } from "./lru-cache";
import { logger } from "./logger";
import { TranslationCollector } from "./translation-collector";

const CONTEXT_LINES = 10; // Nombre de lignes à analyser avant et après le curseur
const MAX_DATES_TO_EXTRACT = 10; // Nombre maximum de dates à extraire du contexte
const MAX_CACHE_SIZE = 200; // Limite de taille du cache de contexte
const CACHE_TIMEOUT = 5000; // 5 secondes de cache
const CLEANUP_INTERVAL = 30000; // Nettoyage périodique toutes les 30 secondes

export interface ContextInfo {
  datesInContext: string[]; // Dates trouvées dans le contexte (formats naturels détectés)
  title?: string; // Titre de la note
  tags: string[]; // Tags de la note
  timestamp: number; // Timestamp de création pour le nettoyage
}

export default class ContextAnalyzer {
  private app: App;
  private plugin: NaturalLanguageDates;
  private cache: LRUCache<string, ContextInfo>; // Cache temporaire par fichier avec limite de taille
  private cleanupInterval: number | null = null; // ID de l'intervalle de nettoyage
  
  // Patterns regex pour la détection de dates (générés dynamiquement)
  private datePatterns: RegExp[] = [];

  constructor(app: App, plugin: NaturalLanguageDates) {
    this.app = app;
    this.plugin = plugin;
    this.cache = new LRUCache<string, ContextInfo>(MAX_CACHE_SIZE);
    this.initializeDatePatterns();
    this.startPeriodicCleanup();
  }

  /**
   * Démarre le nettoyage périodique du cache
   */
  private startPeriodicCleanup(): void {
    // Nettoyer toutes les 30 secondes
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpiredEntries();
    }, CLEANUP_INTERVAL);
  }

  /**
   * Arrête le nettoyage périodique (à appeler lors de la destruction)
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval !== null) {
      window.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Nettoie les entrées expirées du cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Parcourir toutes les entrées du cache
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp && (now - value.timestamp) > CACHE_TIMEOUT) {
        keysToDelete.push(key);
      }
    }

    // Supprimer les entrées expirées
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug(`Nettoyage du cache de contexte: ${keysToDelete.length} entrées supprimées`);
    }
  }

  /**
   * Initialise les patterns regex pour la détection de dates dans toutes les langues activées
   */
  private initializeDatePatterns(): void {
    const tc = new TranslationCollector(this.plugin.settings.languages);

    const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayPattern = tc.buildAlternation(weekdayKeys.flatMap(key => tc.collectWords(key)));
    const timeWordPattern = tc.buildAlternation(['today', 'tomorrow', 'yesterday'].flatMap(key => tc.collectWords(key)));
    const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
    const timeUnitPattern = tc.buildAlternation(timeUnitKeys.flatMap(key => tc.collectWords(key)));
    const inPattern = tc.buildAlternationFor('in');
    const prefixPattern = tc.buildAlternation([...tc.collectWords('next'), ...tc.collectWords('last')]);

    this.datePatterns = [];

    // \b is defined in terms of \w, which is ASCII-only: it never matches
    // around CJK characters (no boundary exists between two Chinese
    // characters as far as \b is concerned), so it silently drops every CJK
    // match. Using explicit lookaround against Latin alphanumerics instead
    // still blocks partial-word matches for Latin scripts (e.g. "Monday"
    // inside "Mondayish") while imposing no boundary at all next to CJK
    // characters, which don't have word separators to check against anyway.
    //
    // The leading boundary can't be a lookbehind ("(?<!...)"): that syntax
    // isn't supported on iOS/Safari before 16.4 and throws at RegExp
    // construction time, breaking every one of these patterns on older
    // devices. Using a consuming alternation ("start-of-string or a single
    // non-word character") instead works the same way but actually consumes
    // that leading character, so the content to extract is wrapped in its
    // own capturing group below rather than read off the whole match.
    // Lookahead ("(?!...)") has no such compatibility issue and can stay.
    const wordBoundaryBefore = '(?:^|[^a-zA-Z0-9_])';
    const wordBoundaryAfter = '(?![a-zA-Z0-9_])';

    // Pattern 1: Jours de la semaine
    if (weekdayPattern) {
      this.datePatterns.push(new RegExp(`${wordBoundaryBefore}(${weekdayPattern})${wordBoundaryAfter}`, 'gi'));
    }

    // Pattern 2: Mots temporels courants (today, tomorrow, yesterday)
    if (timeWordPattern) {
      this.datePatterns.push(new RegExp(`${wordBoundaryBefore}(${timeWordPattern})${wordBoundaryAfter}`, 'gi'));
    }

    // Pattern 3: Expressions relatives "dans X jours/semaines/mois"
    if (inPattern && timeUnitPattern) {
      this.datePatterns.push(new RegExp(`${wordBoundaryBefore}((?:${inPattern})\\s*\\d+\\s*(?:${timeUnitPattern}))${wordBoundaryAfter}`, 'gi'));
    }

    // Pattern 4: Expressions "next/last weekday/week/month/year"
    // Every one of the 11 supported languages defines weekdays and time
    // units together with next/last, so the nested checks below can't
    // actually be false while prefixPattern is true -- kept as a guard in
    // case a future language module is authored incompletely.
    if (prefixPattern) {
      if (weekdayPattern) {
        this.datePatterns.push(new RegExp(`${wordBoundaryBefore}((?:${prefixPattern})\\s*(?:${weekdayPattern}))${wordBoundaryAfter}`, 'gi'));
      }
      if (timeUnitPattern) {
        this.datePatterns.push(new RegExp(`${wordBoundaryBefore}((?:${prefixPattern})\\s*(?:${timeUnitPattern}))${wordBoundaryAfter}`, 'gi'));
      }
    }
  }

  /**
   * Réinitialise les patterns (à appeler quand les langues changent)
   */
  resetPatterns(): void {
    this.initializeDatePatterns();
    this.clearCache(); // Vider le cache car les patterns ont changé
  }

  /**
   * Nettoie le cache lors de la destruction de l'instance
   */
  destroy(): void {
    this.stopPeriodicCleanup();
    this.clearCache();
  }

  /**
   * Analyse le contexte autour du curseur de manière synchrone (utilise le cache)
   */
  analyzeContextSync(editor: Editor, cursorLine: number): ContextInfo {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return { datesInContext: [], tags: [] };
    }

    const file = activeView.file;
    if (!file) {
      return { datesInContext: [], tags: [] };
    }

    // Vérifier le cache (avec timeout)
    const cacheKey = `${file.path}-${cursorLine}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Vérifier si l'entrée n'est pas expirée
      const now = Date.now();
      if (cached.timestamp && (now - cached.timestamp) <= CACHE_TIMEOUT) {
        return cached;
      } else {
        // Entrée expirée, la supprimer
        this.cache.delete(cacheKey);
      }
    }

    const context: ContextInfo = {
      datesInContext: [],
      tags: [],
      timestamp: Date.now(),
    };

    try {
      // Extraire les tags depuis les métadonnées
      const metadata = this.app.metadataCache.getFileCache(file);
      if (metadata) {
        if (metadata.tags) {
          context.tags = metadata.tags.map(tag => tag.tag);
        }

        // Extraire le titre depuis les frontmatter ou le premier titre
        if (metadata.frontmatter?.title) {
          context.title = metadata.frontmatter.title;
        } else if (metadata.headings && metadata.headings.length > 0) {
          context.title = metadata.headings[0].heading;
        }
      }

      // Analyser le contexte autour du curseur
      const content = editor.getValue();
      const lines = content.split("\n");
      
      const startLine = Math.max(0, cursorLine - CONTEXT_LINES);
      const endLine = Math.min(lines.length - 1, cursorLine + CONTEXT_LINES);
      
      const contextLines = lines.slice(startLine, endLine + 1);
      const contextText = contextLines.join("\n");

      // Extraire les dates du contexte
      context.datesInContext = this.extractDatesFromContext(contextText);

      // Mettre en cache (le LRU cache gère automatiquement la limite de taille)
      this.cache.set(cacheKey, context);

    } catch (error) {
      logger.error("Error analyzing context:", { error });
    }

    return context;
  }

  /**
   * Analyse le contexte autour du curseur dans le document actuel (async, pour compatibilité)
   */
  analyzeContext(editor: Editor, cursorLine: number): Promise<ContextInfo> {
    return Promise.resolve(this.analyzeContextSync(editor, cursorLine));
  }

  /**
   * Normalise une date extraite en capitalisant la première lettre
   * Exemple: "demain" -> "Demain", "lundi prochain" -> "Lundi prochain"
   */
  private normalizeDate(dateStr: string): string {
    if (!dateStr || dateStr.length === 0) {
      return dateStr;
    }
    
    const trimmed = dateStr.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }
    
    // Capitaliser la première lettre (gère les caractères Unicode)
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  /**
   * Extrait les expressions de dates potentielles du texte
   * Utilise des patterns dynamiques multi-langue pour détecter les dates naturelles
   */
  private extractDatesFromContext(text: string): string[] {
    const dates: string[] = [];
    const seen = new Set<string>();

    // Utiliser les patterns dynamiques générés pour toutes les langues activées
    for (const pattern of this.datePatterns) {
      // The leading boundary consumes a character instead of using a
      // zero-width lookbehind (see initializeDatePatterns), so the text to
      // extract is read from capture group 1, not the whole match.
      for (const match of text.matchAll(pattern)) {
        const content = match[1];
        if (content) {
          // Pour les langues sans casse (comme le japonais), toLowerCase() ne change rien
          const normalized = content.toLowerCase().trim();
          if (!seen.has(normalized) && dates.length < MAX_DATES_TO_EXTRACT) {
            seen.add(normalized);
            // Normaliser avec la première lettre en majuscule (ou laisser tel quel pour le japonais)
            dates.push(this.normalizeDate(content.trim()));
          }
        }
      }
    }

    return dates;
  }

  /**
   * Nettoie le cache (peut être appelé périodiquement)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retourne les statistiques du cache de contexte
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.cache.maxSizeLimit,
    };
  }
}
