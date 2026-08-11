import type { AIOutputSchema } from '../rendering/schema.ts';

/**
 * Computes a SHA-256 hash of the canonical request data.
 * @param canonicalData The canonical, deterministic JSON string of the request payload.
 * @returns A hex-encoded SHA-256 hash string.
 */
export async function computeRequestHash(canonicalData: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

interface CacheEntry {
  result: AIOutputSchema;
  timestamp: number;
}

/**
 * A simple LRU-ish cache with a TTL for deduplicating identical AI requests.
 */
export class DedupCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 50, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Retrieves a cached result if it exists and hasn't expired.
   */
  get(hash: string, now = Date.now()): AIOutputSchema | null {
    const entry = this.cache.get(hash);
    if (!entry) return null;

    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(hash);
      return null;
    }

    // Refresh position to act as LRU
    this.cache.delete(hash);
    this.cache.set(hash, entry);

    return entry.result;
  }

  /**
   * Caches a result for a given hash.
   */
  set(hash: string, result: AIOutputSchema, now = Date.now()): void {
    if (this.cache.has(hash)) {
      this.cache.delete(hash);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first item in insertion order of Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(hash, { result, timestamp: now });
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}
