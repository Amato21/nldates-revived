import { Plugin, normalizePath } from "obsidian";
import { logger } from "./logger";

export interface SelectionHistory {
  [suggestion: string]: number; // Nombre de fois que cette suggestion a été sélectionnée
}

const MAX_HISTORY_SIZE = 100; // Limite du nombre d'entrées dans l'historique
const HISTORY_FILE = ".obsidian/plugins/nldates-revived/history.json";
const CLEANUP_INTERVAL = 300000; // Nettoyage périodique toutes les 5 minutes

export default class HistoryManager {
  private plugin: Plugin;
  private history: SelectionHistory = {};
  private historyLoaded: boolean = false;
  private cachedTopSuggestions: string[] = [];
  private cacheValid: boolean = false;
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
   * Charge l'historique depuis le stockage
   */
  async loadHistory(): Promise<void> {
    if (this.historyLoaded) {
      return;
    }

    try {
      const path = normalizePath(HISTORY_FILE);
      const exists = await this.plugin.app.vault.adapter.exists(path);
      if (exists) {
        const data = await this.plugin.app.vault.adapter.read(path);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed === "object") {
            this.history = parsed as SelectionHistory;
          }
        }
      }
    } catch (error) {
      // Si le fichier n'existe pas, c'est normal (première utilisation)
      this.history = {};
    }
    this.historyLoaded = true;
  }

  /**
   * Enregistre l'historique dans le stockage
   */
  async saveHistory(): Promise<void> {
    try {
      const path = normalizePath(HISTORY_FILE);
      const dir = path.substring(0, path.lastIndexOf("/"));
      
      // Créer le dossier si nécessaire
      const dirExists = await this.plugin.app.vault.adapter.exists(dir);
      if (!dirExists) {
        await this.plugin.app.vault.adapter.mkdir(dir);
      }
      
      await this.plugin.app.vault.adapter.write(path, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'historique:", error);
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
    
    // Capitaliser la première lettre (gère les caractères Unicode)
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
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

    // Incrémenter le compteur (utiliser la clé en minuscules)
    this.history[normalized] = (this.history[normalized] || 0) + 1;

    // Limiter la taille de l'historique si nécessaire
    if (Object.keys(this.history).length > MAX_HISTORY_SIZE) {
      this.trimHistory();
    }

    // Mettre à jour le cache
    this.updateCache();

    // Sauvegarder (de manière asynchrone, ne pas bloquer)
    this.saveHistory().catch(err => {
      console.error("Erreur lors de la sauvegarde de l'historique:", err);
    });
  }

  /**
   * Réduit la taille de l'historique en gardant les entrées les plus fréquentes
   */
  private trimHistory(): void {
    const entries = Object.entries(this.history);
    
    // Trier par fréquence (décroissant)
    entries.sort((a, b) => b[1] - a[1]);
    
    // Garder uniquement les MAX_HISTORY_SIZE entrées les plus fréquentes
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
   * Met à jour le cache des suggestions les plus fréquentes
   */
  private updateCache(): void {
    const entries = Object.entries(this.history);
    
    // Trier par fréquence (décroissant)
    entries.sort((a, b) => b[1] - a[1]);
    
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
  getTopSuggestionsSync(limit: number = 10): string[] {
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
  async getTopSuggestions(limit: number = 10): Promise<string[]> {
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
