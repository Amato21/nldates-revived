import { Plugin, normalizePath } from "obsidian";

export interface SelectionHistory {
  [suggestion: string]: number; // Nombre de fois que cette suggestion a été sélectionnée
}

const MAX_HISTORY_SIZE = 100; // Limite du nombre d'entrées dans l'historique
const HISTORY_FILE = ".obsidian/plugins/nldates-revived/history.json";

export default class HistoryManager {
  private plugin: Plugin;
  private history: SelectionHistory = {};
  private historyLoaded: boolean = false;
  private cachedTopSuggestions: string[] = [];
  private cacheValid: boolean = false;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
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
   * Enregistre une sélection dans l'historique
   */
  async recordSelection(suggestion: string): Promise<void> {
    await this.loadHistory();

    // Normaliser la suggestion (en minuscules pour éviter les doublons)
    const normalized = suggestion.toLowerCase().trim();

    if (!normalized) {
      return;
    }

    // Incrémenter le compteur
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
    
    // Mettre en cache les top suggestions
    this.cachedTopSuggestions = entries.slice(0, 50).map(([suggestion]) => suggestion);
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
   * Récupère l'historique complet (pour debug)
   */
  async getHistory(): Promise<SelectionHistory> {
    await this.loadHistory();
    return { ...this.history };
  }
}
