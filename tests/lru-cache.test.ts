import { describe, it, expect } from "vitest";
import { LRUCache } from "../src/lru-cache";

describe("LRUCache", () => {
  it("defaults maxSizeLimit to 500", () => {
    const cache = new LRUCache<string, number>();
    expect(cache.maxSizeLimit).toBe(500);
  });

  it("accepts a custom maxSize", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.maxSizeLimit).toBe(3);
  });

  it("throws if maxSize is 0 or negative", () => {
    expect(() => new LRUCache<string, number>(0)).toThrow("LRU Cache maxSize must be greater than 0");
    expect(() => new LRUCache<string, number>(-5)).toThrow("LRU Cache maxSize must be greater than 0");
  });

  it("has() reflects whether a key is present", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.has("a")).toBe(false);
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
  });

  it("get() returns undefined for a missing key", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("get() returns the stored value for an existing key", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("set() updates the value for an existing key without growing the cache", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
  });

  it("evicts the least recently used entry when the cache is full", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // evicts "a"
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.size).toBe(2);
  });

  it("get() marks a key as recently used, protecting it from eviction", () => {
    const cache = new LRUCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // "a" is now most recently used
    cache.set("c", 3); // should evict "b", not "a"
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("delete() removes an entry and returns true, or false if absent", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.has("a")).toBe(false);
    expect(cache.delete("a")).toBe(false);
  });

  it("clear() empties the cache", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has("a")).toBe(false);
  });

  it("size reflects the current number of entries", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.size).toBe(0);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
  });

  it("entries() iterates over [key, value] pairs", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(Array.from(cache.entries())).toEqual([["a", 1], ["b", 2]]);
  });

  it("keys() iterates over keys", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(Array.from(cache.keys())).toEqual(["a", "b"]);
  });
});
