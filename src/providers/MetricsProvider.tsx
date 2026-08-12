import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { AIRequest } from '../ai/lifecycle/state-machine.ts';
import { deriveMetrics } from '../metrics/derive.ts';
import { deriveTokenUsageAndCost } from '../metrics/cost.ts';
import { aggregate, type MetricsRecord, type AggregatedMetrics, type RequestOutcome, type ConfidenceLevel } from '../metrics/aggregate.ts';
import { traceWriter } from '../metrics/trace-writer.ts';

interface MetricsContextValue {
  records: MetricsRecord[];
  aggregated: AggregatedMetrics;
  logOutcome: (
    request: AIRequest,
    outcome: RequestOutcome,
    responseText: string,
    confidenceLevel: ConfidenceLevel
  ) => void;
}

const MetricsContext = createContext<MetricsContextValue | null>(null);

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<MetricsRecord[]>([]);

  const logOutcome = useCallback((
    request: AIRequest,
    outcome: RequestOutcome,
    responseText: string,
    confidenceLevel: ConfidenceLevel
  ) => {
    const latencyMetrics = deriveMetrics(request);
    const costMetrics = deriveTokenUsageAndCost(request, responseText);

    const record: MetricsRecord = {
      endToEndLatency: latencyMetrics.endToEndLatency,
      costUsd: costMetrics.costUsd,
      totalTokens: costMetrics.totalTokens,
      outcome,
      confidenceLevel
    };

    traceWriter.logOutcome(request, outcome, latencyMetrics);

    setRecords((prev) => [...prev, record]);
  }, []);

  const aggregated = useMemo(() => aggregate(records), [records]);

  return (
    <MetricsContext.Provider value={{ records, aggregated, logOutcome }}>
      {children}
    </MetricsContext.Provider>
  );
}

export function useMetrics() {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error('useMetrics must be used within a MetricsProvider');
  return ctx;
}
