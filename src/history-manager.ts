import { Plugin, normalizePath } from "obsidian";

export interface SelectionHistory {
  [suggestion: string]: number; // Number of times this suggestion has been selected
}

const MAX_HISTORY_SIZE = 100; // Maximum number of entries in history
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
   * Loads history from storage
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
      // If the file doesn't exist, it's normal (first use)
      this.history = {};
    }
    this.historyLoaded = true;
  }

  /**
   * Saves history to storage
   */
  async saveHistory(): Promise<void> {
    try {
      const path = normalizePath(HISTORY_FILE);
      const dir = path.substring(0, path.lastIndexOf("/"));
      
      // Create directory if necessary
      const dirExists = await this.plugin.app.vault.adapter.exists(dir);
      if (!dirExists) {
        await this.plugin.app.vault.adapter.mkdir(dir);
      }
      
      await this.plugin.app.vault.adapter.write(path, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error("Error saving history:", error);
    }
  }

  /**
   * Normalizes a suggestion by capitalizing the first letter
   * Example: "demain" -> "Demain", "lundi prochain" -> "Lundi prochain"
   */
  private normalizeSuggestion(suggestion: string): string {
    if (!suggestion || suggestion.length === 0) {
      return suggestion;
    }
    
    const trimmed = suggestion.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }
    
    // Capitalize first letter (handles Unicode characters)
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  /**
   * Records a selection in history
   */
  async recordSelection(suggestion: string): Promise<void> {
    await this.loadHistory();

    // Normalize suggestion (lowercase for key, avoids duplicates)
    const normalized = suggestion.toLowerCase().trim();

    if (!normalized) {
      return;
    }

    // Increment counter (use lowercase key)
    this.history[normalized] = (this.history[normalized] || 0) + 1;

    // Limit history size if necessary
    if (Object.keys(this.history).length > MAX_HISTORY_SIZE) {
      this.trimHistory();
    }

    // Update cache
    this.updateCache();

    // Save (asynchronously, don't block)
    this.saveHistory().catch(err => {
      console.error("Error saving history:", err);
    });
  }

  /**
   * Reduces history size by keeping the most frequent entries
   */
  private trimHistory(): void {
    const entries = Object.entries(this.history);
    
    // Sort by frequency (descending)
    entries.sort((a, b) => b[1] - a[1]);
    
    // Keep only the MAX_HISTORY_SIZE most frequent entries
    const trimmed = entries.slice(0, MAX_HISTORY_SIZE);
    
    this.history = Object.fromEntries(trimmed);
  }

  /**
   * Loads history and updates cache (to be called at startup)
   */
  async initialize(): Promise<void> {
    await this.loadHistory();
    this.updateCache();
  }

  /**
   * Updates cache of most frequent suggestions
   */
  private updateCache(): void {
    const entries = Object.entries(this.history);
    
    // Sort by frequency (descending)
    entries.sort((a, b) => b[1] - a[1]);
    
    // Cache top suggestions with first letter capitalized
    this.cachedTopSuggestions = entries.slice(0, 50).map(([suggestion]) => 
      this.normalizeSuggestion(suggestion)
    );
    this.cacheValid = true;
  }

  /**
   * Gets most frequent suggestions synchronously (uses cache)
   * @param limit Maximum number of suggestions to return
   */
  getTopSuggestionsSync(limit: number = 10): string[] {
    if (!this.cacheValid) {
      // If cache is not valid, return empty array
      // Cache will be updated during initialization
      return [];
    }
    return this.cachedTopSuggestions.slice(0, limit);
  }

  /**
   * Gets most frequent suggestions, sorted by frequency (async, updates cache)
   * @param limit Maximum number of suggestions to return
   */
  async getTopSuggestions(limit: number = 10): Promise<string[]> {
    await this.loadHistory();
    this.updateCache();
    return this.cachedTopSuggestions.slice(0, limit);
  }

  /**
   * Resets history
   */
  async clearHistory(): Promise<void> {
    this.history = {};
    this.cachedTopSuggestions = [];
    this.cacheValid = true;
    await this.saveHistory();
  }

  /**
   * Gets complete history (for debugging)
   */
  async getHistory(): Promise<SelectionHistory> {
    await this.loadHistory();
    return { ...this.history };
  }
}
