import { describe, it, expect } from 'vitest';
import { deriveTokenUsageAndCost } from '../../src/metrics/cost.ts';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';
import type { UsageMetadata } from '@google/generative-ai';

describe('Metrics Cost Derivation', () => {
  const dummyRequest: AIRequest = {
    id: 'req-1',
    state: 'completed',
    payload: {
      image: '',
      fragments: [
        { kind: 'text', data: 'hello world' }, // 11 chars
        { kind: 'json', data: { a: 1 } } // {"a":1} -> 7 chars
      ]
    },
    configId: 'test',
    promptVersion: '1.0',
    confidenceLevel: 'high',
    timestamps: {}
  };

  const responseText = 'this is a test response'; // 23 chars

  it('a fixture response WITH usageMetadata produces estimated: false and uses the real token counts', () => {
    const mockUsage: UsageMetadata = {
      promptTokenCount: 150,
      candidatesTokenCount: 50,
      totalTokenCount: 200
    };

    const metrics = deriveTokenUsageAndCost(dummyRequest, responseText, mockUsage);

    expect(metrics.estimated).toBe(false);
    expect(metrics.promptTokens).toBe(150);
    expect(metrics.responseTokens).toBe(50);
    expect(metrics.totalTokens).toBe(200);
    
    // (150 / 1_000_000) * 0.075 = 0.00001125
    // (50 / 1_000_000) * 0.30 = 0.000015
    // Total = 0.00002625
    expect(metrics.costUsd).toBeCloseTo(0.00002625, 8);
  });

  it('a fixture response WITHOUT usageMetadata produces estimated: true and a reasonable estimated token count', () => {
    const metrics = deriveTokenUsageAndCost(dummyRequest, responseText);

    expect(metrics.estimated).toBe(true);

    // text length = 11 + 7 + 400 = 418. 418 / 4 = 104.5 -> 105 tokens
    expect(metrics.promptTokens).toBe(105);
    
    // response length = 23. 23 / 4 = 5.75 -> 6 tokens
    expect(metrics.responseTokens).toBe(6);
    expect(metrics.totalTokens).toBe(111);

    // Prompt cost: 105 / 1000000 * 0.075 = 0.000007875
    // Response cost: 6 / 1000000 * 0.30 = 0.0000018
    // Total = 0.000009675
    expect(metrics.costUsd).toBeCloseTo(0.000009675, 8);
  });

  it('cost calculation is correct given a known token count and the documented rate', () => {
    // 1 million prompt tokens, 1 million response tokens
    const mockUsage: UsageMetadata = {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 1_000_000,
      totalTokenCount: 2_000_000
    };

    const metrics = deriveTokenUsageAndCost(dummyRequest, responseText, mockUsage);
    
    expect(metrics.promptTokens).toBe(1_000_000);
    expect(metrics.responseTokens).toBe(1_000_000);
    // Cost should be exactly 0.075 + 0.30 = 0.375
    expect(metrics.costUsd).toBe(0.375);
  });

  it('estimates image tokens using crop resolution', () => {
    const imageRequest: AIRequest = {
      ...dummyRequest,
      payload: { image: 'data:image/png;base64,x', fragments: [] },
      contextBounds: { minX: 0, minY: 0, maxX: 1024, maxY: 1024 }
    };

    const metrics = deriveTokenUsageAndCost(imageRequest, responseText);
    expect(metrics.estimated).toBe(true);

    // prompt text = 0 + 400 chars -> 100 tokens
    // image tokens = 258 + (1024*1024 / 256) = 258 + 4096 = 4354 tokens
    // total prompt = 100 + 4354 = 4454 tokens
    expect(metrics.promptTokens).toBe(4454);
  });
});
