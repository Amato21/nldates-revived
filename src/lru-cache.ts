/**
 * Implémentation d'un cache LRU (Least Recently Used) avec limite de taille
 * Utilisé pour limiter la mémoire utilisée par les caches
 */
export class LRUCache<K, V> {
  private readonly maxSize: number;
  private cache: Map<K, V>;

  /**
   * Creates a new LRU cache with the specified maximum size
   * 
   * @param maxSize - Maximum number of items to store in the cache (default: 500)
   */
  constructor(maxSize: number = 500) {
    if (maxSize <= 0) {
      throw new Error("LRU Cache maxSize must be greater than 0");
    }
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Checks if a key exists in the cache
   * Vérifie si une clé existe dans le cache
   * 
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Obtient une valeur du cache et la marque comme récemment utilisée
   * Gets a value from the cache by key
   * If the key exists, it is moved to the end (most recently used)
   * 
   * @param key - The key to retrieve
   * @returns The value associated with the key, or undefined if not found
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Déplacer la clé à la fin (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * Ajoute ou met à jour une valeur dans le cache
   * Sets a value in the cache
   * If the key already exists, it is updated and moved to the end
   * Si la taille maximale est atteinte, supprime l'entrée la moins récemment utilisée
   * 
   * @param key - The key to set
   * @param value - The value to store
   */
  set(key: K, value: V): void {
    // Si la clé existe déjà, la supprimer d'abord pour la déplacer à la fin
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Supprimer l'entrée la moins récemment utilisée (première entrée)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    // Ajouter la nouvelle entrée à la fin
    this.cache.set(key, value);
  }

  /**
   * Supprime une entrée du cache
   * Deletes an entry from the cache
   * 
   * @param key - The key to delete
   * @returns True if the key was deleted, false otherwise
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Vide complètement le cache
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Retourne la taille actuelle du cache
   * Gets the current size of the cache
   * 
   * @returns The number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Retourne la taille maximale du cache
   * Gets the maximum size limit of the cache
   * 
   * @returns The maximum number of items that can be stored
   */
  get maxSizeLimit(): number {
    return this.maxSize;
  }

  /**
   * Retourne un itérateur sur toutes les entrées du cache
   * Returns an iterator over all entries in the cache
   * Utile pour le nettoyage périodique
   * Useful for periodic cleanup
   * 
   * @returns Iterator over [key, value] pairs
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  /**
   * Retourne un itérateur sur toutes les clés du cache
   * Returns an iterator over all keys in the cache
   * 
   * @returns Iterator over keys
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}

