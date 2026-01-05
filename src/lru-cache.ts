/**
 * Implémentation d'un cache LRU (Least Recently Used) avec limite de taille
 * Utilisé pour limiter la mémoire utilisée par les caches
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number = 500) {
    if (maxSize <= 0) {
      throw new Error("LRU Cache maxSize must be greater than 0");
    }
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Obtient une valeur du cache et la marque comme récemment utilisée
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
   * Si la taille maximale est atteinte, supprime l'entrée la moins récemment utilisée
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
   * Vérifie si une clé existe dans le cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Supprime une entrée du cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Retourne la taille actuelle du cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Retourne la taille maximale du cache
   */
  get maxSizeLimit(): number {
    return this.maxSize;
  }

  /**
   * Retourne un itérateur sur toutes les entrées du cache
   * Utile pour le nettoyage périodique
   */
  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  /**
   * Retourne un itérateur sur toutes les clés du cache
   */
  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}

