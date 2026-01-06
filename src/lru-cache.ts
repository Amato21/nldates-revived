/**
 * Simple LRU (Least Recently Used) Cache implementation
 * 
 * This cache maintains a fixed-size cache and evicts the least recently used
 * items when the size limit is reached.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  /**
   * Creates a new LRU cache with the specified maximum size
   * 
   * @param maxSize - Maximum number of items to store in the cache
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('LRU cache size must be greater than 0');
    }
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Checks if a key exists in the cache
   * 
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Gets a value from the cache by key
   * If the key exists, it is moved to the end (most recently used)
   * 
   * @param key - The key to retrieve
   * @returns The value associated with the key, or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }
    
    // Move to end (most recently used) by removing and re-adding
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * Sets a value in the cache
   * If the key already exists, it is updated and moved to the end
   * If the cache is full, the least recently used item is evicted
   * 
   * @param key - The key to set
   * @param value - The value to store
   */
  set(key: K, value: V): void {
    // If key exists, remove it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    // Add to end (most recently used)
    this.cache.set(key, value);
  }

  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets the current size of the cache
   * 
   * @returns The number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

