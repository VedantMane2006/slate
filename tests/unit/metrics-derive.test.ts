import { describe, it, expect } from 'vitest';
import { deriveMetrics } from '../../src/metrics/derive.ts';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';

describe('Metrics Derivation', () => {
  it('produces correct values against a hand-computed fixture with known timestamps', () => {
    const fixture: AIRequest = {
      id: 'test-1',
      state: 'completed',
      payload: { image: '', fragments: [] },
      timestamps: {
        encoding: 1000,
        context_extraction: 1050,
        sending: 1200,
        waiting: 1250,
        streaming: 1500,
        rendering: 3000,
        completed: 3100
      }
    };

    const metrics = deriveMetrics(fixture);

    expect(metrics.state).toBe('completed');
    expect(metrics.encodingTime).toBe(50); // 1050 - 1000
    expect(metrics.captureTime).toBe(150); // 1200 - 1050
    expect(metrics.dispatchTime).toBe(50); // 1250 - 1200
    expect(metrics.ttfb).toBe(250); // 1500 - 1250
    expect(metrics.ttft).toBe(250); // 1500 - 1250
    expect(metrics.estimatedTtft).toBe(false);
    expect(metrics.renderingLatency).toBe(100); // 3100 - 3000
    expect(metrics.endToEndLatency).toBe(2100); // 3100 - 1000
  });

  it('a fixture missing an expected timestamp field degrades gracefully, not a crash', () => {
    const fixture: AIRequest = {
      id: 'test-2',
      state: 'error',
      payload: { image: '', fragments: [] },
      timestamps: {
        encoding: 1000,
        // missing context_extraction
        sending: 1200,
        waiting: 1250,
        error: 5000
      }
    };

    const metrics = deriveMetrics(fixture);

    expect(metrics.state).toBe('error');
    expect(metrics.encodingTime).toBeUndefined();
    expect(metrics.captureTime).toBeUndefined();
    expect(metrics.dispatchTime).toBe(50); // 1250 - 1200
    expect(metrics.ttfb).toBeUndefined(); // no streaming or rendering
    expect(metrics.ttft).toBeUndefined();
    expect(metrics.renderingLatency).toBeUndefined();
    expect(metrics.endToEndLatency).toBe(4000); // 5000 - 1000
  });
});
