import { describe, it, expect, beforeEach } from 'vitest';
import { traceWriter } from '../../src/metrics/trace-writer.ts';
import type { RequestMetrics } from '../../src/metrics/derive.ts';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';

describe('TraceWriter', () => {
  beforeEach(() => {
    traceWriter.clear();
  });

  it('correctly merges an extraction trace and an outcome log into a single full trace record', () => {
    // 1. Simulate the extraction phase
    traceWriter.logExtraction({
      timestamp: 1000,
      strategy: 'recent',
      confidence: { level: 'medium', reasons: ['test reason'] },
      objectCount: 3,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    });

    expect(traceWriter.getPendingExtractions().length).toBe(1);
    expect(traceWriter.getTraces().length).toBe(0);

    // 2. Simulate the outcome phase
    const mockRequest: AIRequest = {
      id: 'req-1',
      state: 'completed',
      payload: {} as any,
      timestamps: {},
      configId: 'test-config',
      promptVersion: '1.2.3',
      confidenceLevel: 'high'
    };

    const mockMetrics: RequestMetrics = {
      endToEndLatency: 500,
      estimatedTtft: false,
      state: 'completed'
    };

    traceWriter.logOutcome(mockRequest, 'accepted', mockMetrics);

    // 3. Verify the merged trace
    expect(traceWriter.getPendingExtractions().length).toBe(0);
    const traces = traceWriter.getTraces();
    expect(traces.length).toBe(1);

    const record = traces[0];
    // Fields from extraction
    expect(record.timestamp).toBe(1000);
    expect(record.strategy).toBe('recent');
    expect(record.confidence.level).toBe('medium');
    expect(record.objectCount).toBe(3);
    expect(record.bounds).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    
    // Fields from outcome
    expect(record.requestMetrics.endToEndLatency).toBe(500);
    expect(record.outcome).toBe('accepted');
    expect(record.configId).toBe('test-config');
    expect(record.promptVersion).toBe('1.2.3');
  });

  it('provides safe defaults if an outcome is logged without a preceding extraction', () => {
    const mockRequest: AIRequest = {
      id: 'req-2',
      state: 'error',
      payload: {} as any,
      timestamps: {},
      configId: 'fallback-config',
      promptVersion: '1.0.0',
      confidenceLevel: 'low'
    };

    traceWriter.logOutcome(mockRequest, 'error', {
      estimatedTtft: false,
      state: 'error'
    });

    const traces = traceWriter.getTraces();
    expect(traces.length).toBe(1);
    const record = traces[0];
    
    expect(record.strategy).toBe('unknown');
    expect(record.objectCount).toBe(0);
    expect(record.bounds).toBeNull();
    expect(record.outcome).toBe('error');
    expect(record.configId).toBe('fallback-config');
  });
});
