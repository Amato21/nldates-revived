import { App, MarkdownView, Editor } from "obsidian";
import type NaturalLanguageDates from "./main";
import t from "./lang/helper";
import { LRUCache } from "./lru-cache";
import { logger } from "./logger";

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
    const languages = this.plugin.settings.languages;
    
    // Collecter tous les mots de toutes les langues activées
    const weekdays: string[] = [];
    const todayWords: string[] = [];
    const tomorrowWords: string[] = [];
    const yesterdayWords: string[] = [];
    const inWords: string[] = [];
    const nextWords: string[] = [];
    const lastWords: string[] = [];
    const timeUnits: string[] = [];

    for (const lang of languages) {
      // Jours de la semaine
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of days) {
        const dayWord = t(day, lang);
        if (dayWord && dayWord !== "NOTFOUND") {
          weekdays.push(...dayWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }

      // Mots temporels courants
      const todayWord = t("today", lang);
      if (todayWord && todayWord !== "NOTFOUND") {
        todayWords.push(...todayWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const tomorrowWord = t("tomorrow", lang);
      if (tomorrowWord && tomorrowWord !== "NOTFOUND") {
        tomorrowWords.push(...tomorrowWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const yesterdayWord = t("yesterday", lang);
      if (yesterdayWord && yesterdayWord !== "NOTFOUND") {
        yesterdayWords.push(...yesterdayWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // "in" pour les expressions relatives
      const inWord = t("in", lang);
      if (inWord && inWord !== "NOTFOUND") {
        inWords.push(...inWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // "next" et "last"
      const nextWord = t("next", lang);
      if (nextWord && nextWord !== "NOTFOUND") {
        nextWords.push(...nextWord.split("|").map(w => w.trim()).filter(w => w));
      }

      const lastWord = t("last", lang);
      if (lastWord && lastWord !== "NOTFOUND") {
        lastWords.push(...lastWord.split("|").map(w => w.trim()).filter(w => w));
      }

      // Unités de temps
      const timeUnitKeys = ['minute', 'hour', 'day', 'week', 'month', 'year'];
      for (const unitKey of timeUnitKeys) {
        const unitWord = t(unitKey, lang);
        if (unitWord && unitWord !== "NOTFOUND") {
          timeUnits.push(...unitWord.split("|").map(w => w.trim()).filter(w => w));
        }
      }
    }

    // Échapper les caractères spéciaux pour les regex
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Créer les patterns regex
    this.datePatterns = [];

    // Pattern 1: Jours de la semaine
    if (weekdays.length > 0) {
      const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
      // Utiliser \b pour les limites de mots (fonctionne pour la plupart des langues)
      this.datePatterns.push(new RegExp(`\\b(${weekdayPattern})\\b`, 'gi'));
    }

    // Pattern 2: Mots temporels courants (today, tomorrow, yesterday)
    const timeWords = [...todayWords, ...tomorrowWords, ...yesterdayWords];
    if (timeWords.length > 0) {
      const timeWordPattern = [...new Set(timeWords.map(escapeRegex))].join('|');
      this.datePatterns.push(new RegExp(`\\b(${timeWordPattern})\\b`, 'gi'));
    }

    // Pattern 3: Expressions relatives "dans X jours/semaines/mois"
    if (inWords.length > 0 && timeUnits.length > 0) {
      const inPattern = [...new Set(inWords.map(escapeRegex))].join('|');
      const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
      this.datePatterns.push(new RegExp(`\\b(${inPattern})\\s+\\d+\\s+(${timeUnitPattern})\\b`, 'gi'));
    }

    // Pattern 4: Expressions "next/last weekday/week/month/year"
    const prefixWords = [...nextWords, ...lastWords];
    if (prefixWords.length > 0) {
      const prefixPattern = [...new Set(prefixWords.map(escapeRegex))].join('|');
      
      // Pour les jours de la semaine
      if (weekdays.length > 0) {
        const weekdayPattern = [...new Set(weekdays.map(escapeRegex))].join('|');
        this.datePatterns.push(new RegExp(`\\b(${prefixPattern})\\s+(${weekdayPattern})\\b`, 'gi'));
      }
      
      // Pour les unités de temps
      if (timeUnits.length > 0) {
        const timeUnitPattern = [...new Set(timeUnits.map(escapeRegex))].join('|');
        this.datePatterns.push(new RegExp(`\\b(${prefixPattern})\\s+(${timeUnitPattern})\\b`, 'gi'));
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
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          // Pour les langues sans casse (comme le japonais), toLowerCase() ne change rien
          const normalized = match.toLowerCase().trim();
          if (!seen.has(normalized) && dates.length < MAX_DATES_TO_EXTRACT) {
            seen.add(normalized);
            // Normaliser avec la première lettre en majuscule (ou laisser tel quel pour le japonais)
            dates.push(this.normalizeDate(match.trim()));
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
