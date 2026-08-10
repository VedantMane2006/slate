import { describe, it, expect } from 'vitest';
import { aggregate, type MetricsRecord } from '../../src/metrics/aggregate.ts';

describe('Metrics Aggregation', () => {
  it('correctly computes acceptance rate across a mixed-outcome fixture list', () => {
    const fixtures: MetricsRecord[] = [
      { endToEndLatency: 1000, costUsd: 0.1, totalTokens: 100, outcome: 'accepted', confidenceLevel: 'high' },
      { endToEndLatency: 2000, costUsd: 0.2, totalTokens: 200, outcome: 'discarded', confidenceLevel: 'medium' },
      { endToEndLatency: 1500, costUsd: 0.15, totalTokens: 150, outcome: 'error', confidenceLevel: 'low' },
      { endToEndLatency: 500, costUsd: 0.05, totalTokens: 50, outcome: 'accepted', confidenceLevel: 'high' }
    ];

    const result = aggregate(fixtures);

    // 2 accepted out of 4 total = 50%
    expect(result.acceptanceRate).toBe(0.5);
    
    // Average latency: (1000 + 2000 + 1500 + 500) / 4 = 1250
    expect(result.averageLatencyMs).toBe(1250);

    // Average cost: (0.1 + 0.2 + 0.15 + 0.05) / 4 = 0.125
    expect(result.averageCostUsd).toBe(0.125);
  });

  it('wastedTokenRatio correctly excludes accepted requests from the wasted numerator', () => {
    const fixtures: MetricsRecord[] = [
      { costUsd: 0.1, totalTokens: 100, outcome: 'accepted', confidenceLevel: 'high' },
      { costUsd: 0.2, totalTokens: 200, outcome: 'discarded', confidenceLevel: 'high' },
      { costUsd: 0.15, totalTokens: 150, outcome: 'timeout', confidenceLevel: 'high' },
      { costUsd: 0.05, totalTokens: 50, outcome: 'accepted', confidenceLevel: 'high' }
    ];

    const result = aggregate(fixtures);

    // total tokens: 100 + 200 + 150 + 50 = 500
    // wasted tokens: 200 (discarded) + 150 (timeout) = 350
    // ratio = 350 / 500 = 0.7
    expect(result.wastedTokenRatio).toBe(0.7);
  });

  it('confidence distribution correctly tallies across a fixture list', () => {
    const fixtures: MetricsRecord[] = [
      { costUsd: 0, totalTokens: 0, outcome: 'accepted', confidenceLevel: 'high' },
      { costUsd: 0, totalTokens: 0, outcome: 'discarded', confidenceLevel: 'medium' },
      { costUsd: 0, totalTokens: 0, outcome: 'error', confidenceLevel: 'low' },
      { costUsd: 0, totalTokens: 0, outcome: 'accepted', confidenceLevel: 'high' },
      { costUsd: 0, totalTokens: 0, outcome: 'cancelled', confidenceLevel: 'low' }
    ];

    const result = aggregate(fixtures);

    // Total: 5. High: 2, Medium: 1, Low: 2
    expect(result.confidenceDistribution.high.count).toBe(2);
    expect(result.confidenceDistribution.high.percentage).toBe(0.4);

    expect(result.confidenceDistribution.medium.count).toBe(1);
    expect(result.confidenceDistribution.medium.percentage).toBe(0.2);

    expect(result.confidenceDistribution.low.count).toBe(2);
    expect(result.confidenceDistribution.low.percentage).toBe(0.4);
  });

  it('handles empty records safely', () => {
    const result = aggregate([]);

    expect(result.averageLatencyMs).toBe(0);
    expect(result.averageCostUsd).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.wastedTokenRatio).toBe(0);
    expect(result.confidenceDistribution.high.count).toBe(0);
  });
});
