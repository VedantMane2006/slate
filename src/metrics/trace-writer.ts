import type { RequestOutcome } from './aggregate.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import type { AIRequest } from '../ai/lifecycle/state-machine.ts';
import type { RequestMetrics } from './derive.ts';

export interface ContextConfidence {
  level: 'high' | 'medium' | 'low';
  reasons: string[];
}

export interface FullTraceRecord {
  timestamp: number;
  strategy: string;
  confidence: ContextConfidence;
  objectCount: number;
  bounds: BoundingBox | null;
  requestMetrics: RequestMetrics;
  outcome: RequestOutcome;
  configId: string;
  promptVersion: string;
}

export interface PartialExtractionTrace {
  timestamp: number;
  strategy: string;
  confidence: ContextConfidence;
  objectCount: number;
  bounds: BoundingBox | null;
}

class TraceWriter {
  private traces: FullTraceRecord[] = [];
  private pendingExtractions: PartialExtractionTrace[] = [];

  logExtraction(trace: PartialExtractionTrace) {
    this.pendingExtractions.push(trace);
  }

  logOutcome(
    request: AIRequest,
    outcome: RequestOutcome,
    requestMetrics: RequestMetrics
  ) {
    // Pop the most recent pending extraction (since it's a single-user UI, 
    // the most recent extraction perfectly corresponds to this request).
    // If none exists (shouldn't happen), provide safe defaults.
    const extraction = this.pendingExtractions.pop() || {
      timestamp: Date.now(),
      strategy: 'unknown',
      confidence: { level: 'low', reasons: [] },
      objectCount: 0,
      bounds: null
    };

    const record: FullTraceRecord = {
      timestamp: extraction.timestamp,
      strategy: extraction.strategy,
      confidence: extraction.confidence,
      objectCount: extraction.objectCount,
      bounds: extraction.bounds,
      requestMetrics,
      outcome,
      configId: request.configId,
      promptVersion: request.promptVersion
    };

    this.traces.push(record);
  }

  downloadTraces() {
    if (this.traces.length === 0) {
      alert('No traces to download.');
      return;
    }
    const json = JSON.stringify(this.traces, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slate-traces-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // For testing
  getTraces() { return this.traces; }
  getPendingExtractions() { return this.pendingExtractions; }
  clear() { this.traces = []; this.pendingExtractions = []; }
}

export const traceWriter = new TraceWriter();
