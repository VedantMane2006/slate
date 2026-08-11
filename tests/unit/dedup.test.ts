import { describe, it, expect, beforeEach } from 'vitest';
import { computeRequestHash, DedupCache } from '../../src/ai/gating/dedup.ts';
import type { AIOutputSchema } from '../../src/ai/rendering/schema.ts';

describe('computeRequestHash', () => {
  it('is deterministic for identical canonical data', async () => {
    const data = JSON.stringify({ a: 1, b: 2 });
    const hash1 = await computeRequestHash(data);
    const hash2 = await computeRequestHash(data);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it('differs when canonical data changes', async () => {
    const data1 = JSON.stringify({ a: 1, b: 2 });
    const data2 = JSON.stringify({ b: 2, a: 1 }); // different string serialization
    const hash1 = await computeRequestHash(data1);
    const hash2 = await computeRequestHash(data2);
    expect(hash1).not.toBe(hash2);
  });
});

describe('DedupCache', () => {
  let cache: DedupCache;
  const mockResult1: AIOutputSchema = { explanation: '1' };
  const mockResult2: AIOutputSchema = { explanation: '2' };
  const mockResult3: AIOutputSchema = { explanation: '3' };

  beforeEach(() => {
    cache = new DedupCache(2, 1000); // Max 2 items, 1 second TTL
  });

  it('correctly hits and misses', () => {
    cache.set('hash1', mockResult1, 100);
    expect(cache.get('hash1', 200)).toBe(mockResult1);
    expect(cache.get('hash2', 200)).toBeNull();
  });

  it('respects TTL and expires old items', () => {
    cache.set('hash1', mockResult1, 100);
    // 1000ms TTL, so at 1100 it's valid, at 1101 it's expired
    expect(cache.get('hash1', 1100)).toBe(mockResult1);
    expect(cache.get('hash1', 1101)).toBeNull(); // expired
  });

  it('respects size cap and evicts oldest items', () => {
    cache.set('hash1', mockResult1, 100);
    cache.set('hash2', mockResult2, 200);
    expect(cache.get('hash1', 300)).toBe(mockResult1); // hash1 refreshed, so hash2 is now oldest
    
    cache.set('hash3', mockResult3, 400); // this should evict hash2

    expect(cache.get('hash2', 500)).toBeNull(); // evicted
    expect(cache.get('hash1', 500)).toBe(mockResult1); // retained
    expect(cache.get('hash3', 500)).toBe(mockResult3); // retained
  });
});
