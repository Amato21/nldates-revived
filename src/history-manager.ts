import { Plugin, normalizePath } from "obsidian";
import { logger } from "./logger";

export interface HistoryEntry {
  count: number; // Nombre de fois que cette suggestion a été sélectionnée
  lastUsed: number; // Date.now() de la dernière sélection
}

export interface SelectionHistory {
  [suggestion: string]: HistoryEntry;
}

const MAX_HISTORY_SIZE = 100; // Limite du nombre d'entrées dans l'historique
const HISTORY_FILE = "plugins/nldates-revived/history.json";
const CLEANUP_INTERVAL = 300000; // Nettoyage périodique toutes les 5 minutes

// A suggestion's rank is frequency weighted by recency, not raw lifetime
// count: without decay, something selected 50 times six months ago would
// permanently outrank something selected 3 times this week, even though
// the latter is clearly more relevant *now*. Halving the weight every
// HALF_LIFE_MS of inactivity means every reuse "refreshes" an entry, while
// genuinely stale entries fade out instead of camping the top of the list
// forever.
const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export default class HistoryManager {
  private plugin: Plugin;
  private history: SelectionHistory = {};
  private historyLoaded = false;
  private cachedTopSuggestions: string[] = [];
  private cacheValid = false;
  private cleanupInterval: number | null = null; // ID de l'intervalle de nettoyage

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.startPeriodicCleanup();
  }

  /**
   * Démarre le nettoyage périodique de l'historique
   */
  private startPeriodicCleanup(): void {
    // Nettoyer toutes les 5 minutes
    this.cleanupInterval = window.setInterval(() => {
      this.performPeriodicCleanup();
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
   * Effectue un nettoyage périodique de l'historique
   * Réduit la taille si nécessaire et nettoie les entrées peu utilisées
   */
  private performPeriodicCleanup(): void {
    if (!this.historyLoaded) {
      return;
    }

    const currentSize = Object.keys(this.history).length;
    
    // Si l'historique dépasse la limite, le réduire
    if (currentSize > MAX_HISTORY_SIZE) {
      this.trimHistory();
      logger.debug(`Nettoyage périodique de l'historique: réduit de ${currentSize} à ${Object.keys(this.history).length} entrées`);
    }

    // Mettre à jour le cache des suggestions
    this.updateCache();
  }

  /**
   * Convertit un historique chargé depuis le disque vers le format actuel.
   * Les fichiers écrits par une version antérieure du plugin stockent un
   * simple compteur (`{ [suggestion]: number }`) au lieu de
   * `{ [suggestion]: HistoryEntry }` -- on donne à ces entrées un
   * lastUsed de "maintenant" pour ne pas les faire disparaître
   * immédiatement du classement le temps qu'un nouvel usage les rafraîchisse.
   */
  private migrateHistory(raw: unknown): SelectionHistory {
    const migrated: SelectionHistory = {};
    // typeof [] === "object", so a top-level JSON array (corrupted file,
    // stray manual edit) would otherwise sail through the caller's
    // `typeof parsed === "object"` check and get walked here: Object.entries()
    // on an array yields numeric-string keys ("0", "1", ...) that would be
    // migrated into bogus history entries.
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return migrated;
    }
    const now = Date.now();
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "number") {
        migrated[key] = { count: value, lastUsed: now };
      } else if (
        value &&
        typeof value === "object" &&
        typeof (value as HistoryEntry).count === "number" &&
        typeof (value as HistoryEntry).lastUsed === "number"
      ) {
        // Copy only the two expected fields rather than keeping the whole
        // parsed object reference, so unexpected extra properties on a
        // malformed entry aren't silently carried forward and re-persisted.
        migrated[key] = {
          count: (value as HistoryEntry).count,
          lastUsed: (value as HistoryEntry).lastUsed,
        };
      }
      // Anything else (malformed entry) is silently dropped rather than
      // carried forward -- a single bad entry shouldn't poison the rest.
    }
    return migrated;
  }

  /**
   * Score d'une entrée : fréquence pondérée par la fraîcheur d'utilisation
   * (voir HALF_LIFE_MS). Utilisé pour trier/trimmer l'historique.
   */
  private computeScore(entry: HistoryEntry, now: number): number {
    const ageMs = Math.max(0, now - entry.lastUsed);
    const decay = Math.pow(0.5, ageMs / HALF_LIFE_MS);
    return entry.count * decay;
  }

  /**
   * Charge l'historique depuis le stockage
   */
  async loadHistory(): Promise<void> {
    if (this.historyLoaded) {
      return;
    }

    try {
      const configDir = this.plugin.app.vault.configDir;
      const path = normalizePath(`${configDir}/${HISTORY_FILE}`);
      const exists = await this.plugin.app.vault.adapter.exists(path);
      if (exists) {
        const data = await this.plugin.app.vault.adapter.read(path);
        if (data) {
          const parsed: unknown = JSON.parse(data);
          if (parsed && typeof parsed === "object") {
            this.history = this.migrateHistory(parsed);
          }
        }
      }
    } catch (error) {
      // The exists()/read() calls above already handle the "file doesn't
      // exist yet" case explicitly (the `if (exists)` guard) -- reaching
      // this catch means an actual anomaly (corrupted JSON from an
      // interrupted write, a sync conflict, etc.), so log it instead of
      // silently discarding the user's history with no diagnostic trail.
      logger.error("Error loading history:", { error });
      this.history = {};
    }
    this.historyLoaded = true;
  }

  /**
   * Enregistre l'historique dans le stockage
   */
  async saveHistory(): Promise<void> {
    try {
      const configDir = this.plugin.app.vault.configDir;
      const path = normalizePath(`${configDir}/${HISTORY_FILE}`);
      const dir = path.substring(0, path.lastIndexOf("/"));
      
      // Créer le dossier si nécessaire
      const dirExists = await this.plugin.app.vault.adapter.exists(dir);
      if (!dirExists) {
        await this.plugin.app.vault.adapter.mkdir(dir);
      }
      
      await this.plugin.app.vault.adapter.write(path, JSON.stringify(this.history, null, 2));
    } catch (error) {
      logger.error("Error saving history:", { error });
    }
  }

  /**
   * Normalise une suggestion en capitalisant la première lettre
   * Exemple: "demain" -> "Demain", "lundi prochain" -> "Lundi prochain"
   */
  private normalizeSuggestion(suggestion: string): string {
    if (!suggestion || suggestion.length === 0) {
      return suggestion;
    }

    const trimmed = suggestion.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }

    // Capitalize each word individually, not just the first character of
    // the whole string: history keys are stored fully lowercase (see
    // recordSelection()), so a multi-word suggestion like "next friday"
    // would otherwise display as "Next friday" -- only the very first
    // letter capitalized -- inconsistent with the "Next Friday" that other
    // suggestion sources (e.g. date-suggest.ts's getImmediateSuggestions)
    // show for the exact same phrase in the same dropdown.
    return trimmed
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Enregistre une sélection dans l'historique
   */
  async recordSelection(suggestion: string): Promise<void> {
    await this.loadHistory();

    // Normaliser la suggestion (en minuscules pour la clé, évite les doublons)
    const normalized = suggestion.toLowerCase().trim();

    if (!normalized) {
      return;
    }

    // Incrémenter le compteur et rafraîchir la date d'utilisation (utiliser la clé en minuscules)
    const existing = this.history[normalized];
    this.history[normalized] = {
      count: (existing?.count || 0) + 1,
      lastUsed: Date.now(),
    };

    // Limiter la taille de l'historique si nécessaire
    if (Object.keys(this.history).length > MAX_HISTORY_SIZE) {
      this.trimHistory();
    }

    // Mettre à jour le cache
    this.updateCache();

    // Save (asynchronously, don't block)
    this.saveHistory().catch((err: unknown) => {
      logger.error("Error saving history:", { error: err });
    });
  }

  /**
   * Réduit la taille de l'historique en gardant les entrées les plus pertinentes
   * (fréquence pondérée par la fraîcheur, voir computeScore())
   */
  private trimHistory(): void {
    const now = Date.now();
    const entries = Object.entries(this.history);

    // Trier par score (décroissant)
    entries.sort((a, b) => this.computeScore(b[1], now) - this.computeScore(a[1], now));

    // Garder uniquement les MAX_HISTORY_SIZE entrées les plus pertinentes
    const trimmed = entries.slice(0, MAX_HISTORY_SIZE);

    this.history = Object.fromEntries(trimmed);
  }

  /**
   * Charge l'historique et met à jour le cache (à appeler au démarrage)
   */
  async initialize(): Promise<void> {
    await this.loadHistory();
    this.updateCache();
  }

  /**
   * Met à jour le cache des suggestions les plus pertinentes
   * (fréquence pondérée par la fraîcheur, voir computeScore())
   */
  private updateCache(): void {
    const now = Date.now();
    const entries = Object.entries(this.history);

    // Trier par score (décroissant)
    entries.sort((a, b) => this.computeScore(b[1], now) - this.computeScore(a[1], now));

    // Mettre en cache les top suggestions avec la première lettre capitalisée
    this.cachedTopSuggestions = entries.slice(0, 50).map(([suggestion]) =>
      this.normalizeSuggestion(suggestion)
    );
    this.cacheValid = true;
  }

  /**
   * Récupère les suggestions les plus fréquentes de manière synchrone (utilise le cache)
   * @param limit Nombre maximum de suggestions à retourner
   */
  getTopSuggestionsSync(limit = 10): string[] {
    if (!this.cacheValid) {
      // Si le cache n'est pas valide, retourner un tableau vide
      // Le cache sera mis à jour lors de l'initialisation
      return [];
    }
    return this.cachedTopSuggestions.slice(0, limit);
  }

  /**
   * Récupère les suggestions les plus fréquentes, triées par fréquence (async, met à jour le cache)
   * @param limit Nombre maximum de suggestions à retourner
   */
  async getTopSuggestions(limit = 10): Promise<string[]> {
    await this.loadHistory();
    this.updateCache();
    return this.cachedTopSuggestions.slice(0, limit);
  }

  /**
   * Réinitialise l'historique
   */
  async clearHistory(): Promise<void> {
    this.history = {};
    this.cachedTopSuggestions = [];
    this.cacheValid = true;
    await this.saveHistory();
  }

  /**
   * Supprime une seule entrée de l'historique (gestion fine, par opposition
   * à clearHistory() qui vide tout). `suggestion` peut être la forme normalisée
   * affichée à l'utilisateur (ex: "Next Friday") ou la clé brute stockée en
   * interne (ex: "next friday") -- les deux sont acceptées puisque
   * l'utilisateur ne voit jamais la clé brute, seulement la version affichée.
   */
  async removeEntry(suggestion: string): Promise<void> {
    await this.loadHistory();

    const normalized = suggestion.toLowerCase().trim();
    if (!(normalized in this.history)) {
      return;
    }

    delete this.history[normalized];
    this.updateCache();

    await this.saveHistory();
  }

  /**
   * Récupère toutes les entrées de l'historique, triées par pertinence
   * (voir computeScore()), avec leurs métadonnées -- utilisé par l'interface
   * de gestion fine de l'historique (affichage + suppression individuelle).
   * Contrairement à getTopSuggestionsSync()/getTopSuggestions(), qui ne
   * renvoient que le texte affiché, ceci renvoie aussi la clé brute (pour
   * removeEntry()) et les métadonnées count/lastUsed (pour l'affichage).
   */
  async getEntriesForManagement(): Promise<Array<{ key: string; display: string; count: number; lastUsed: number }>> {
    await this.loadHistory();

    const now = Date.now();
    return Object.entries(this.history)
      .sort((a, b) => this.computeScore(b[1], now) - this.computeScore(a[1], now))
      .map(([key, entry]) => ({
        key,
        display: this.normalizeSuggestion(key),
        count: entry.count,
        lastUsed: entry.lastUsed,
      }));
  }

  /**
   * Nettoie les ressources lors de la destruction de l'instance
   */
  destroy(): void {
    this.stopPeriodicCleanup();
  }

  /**
   * Récupère l'historique complet (pour debug)
   */
  async getHistory(): Promise<SelectionHistory> {
    await this.loadHistory();
    return { ...this.history };
  }
}
