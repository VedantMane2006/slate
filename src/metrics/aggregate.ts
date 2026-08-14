export type RequestOutcome = 'accepted' | 'discarded' | 'error' | 'cancelled' | 'superseded' | 'timeout';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MetricsRecord {
  endToEndLatency?: number;
  costUsd: number;
  totalTokens: number;
  outcome: RequestOutcome;
  confidenceLevel: ConfidenceLevel;
}

export interface ConfidenceStats {
  count: number;
  percentage: number;
}

export interface AggregatedMetrics {
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  averageCostUsd: number;
  cpadUsd: number;
  acceptanceRate: number;
  wastedTokenRatio: number;
  confidenceDistribution: {
    high: ConfidenceStats;
    medium: ConfidenceStats;
    low: ConfidenceStats;
  };
}

export function aggregate(records: MetricsRecord[]): AggregatedMetrics {
  if (records.length === 0) {
    return {
      averageLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      averageCostUsd: 0,
      cpadUsd: 0,
      acceptanceRate: 0,
      wastedTokenRatio: 0,
      confidenceDistribution: {
        high: { count: 0, percentage: 0 },
        medium: { count: 0, percentage: 0 },
        low: { count: 0, percentage: 0 }
      }
    };
  }

  let totalLatency = 0;
  let totalCost = 0;
  
  let acceptedCount = 0;
  let totalTokens = 0;
  let wastedTokens = 0;

  const latencies: number[] = [];

  const confCount = {
    high: 0,
    medium: 0,
    low: 0
  };

  for (const record of records) {
    if (record.endToEndLatency !== undefined) {
      totalLatency += record.endToEndLatency;
      latencies.push(record.endToEndLatency);
    }

    totalCost += record.costUsd;
    totalTokens += record.totalTokens;

    if (record.outcome === 'accepted') {
      acceptedCount++;
    }

    const isWasted = ['discarded', 'error', 'cancelled', 'superseded', 'timeout'].includes(record.outcome);
    if (isWasted) {
      wastedTokens += record.totalTokens;
    }

    if (record.confidenceLevel === 'high' || record.confidenceLevel === 'medium' || record.confidenceLevel === 'low') {
      confCount[record.confidenceLevel]++;
    }
  }

  const totalRecords = records.length;
  
  // Percentile math
  latencies.sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  return {
    averageLatencyMs: latencies.length > 0 ? totalLatency / latencies.length : 0,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    averageCostUsd: totalCost / totalRecords,
    cpadUsd: acceptedCount > 0 ? totalCost / acceptedCount : totalCost,
    acceptanceRate: acceptedCount / totalRecords,
    wastedTokenRatio: totalTokens > 0 ? wastedTokens / totalTokens : 0,
    confidenceDistribution: {
      high: { count: confCount.high, percentage: confCount.high / totalRecords },
      medium: { count: confCount.medium, percentage: confCount.medium / totalRecords },
      low: { count: confCount.low, percentage: confCount.low / totalRecords }
    }
  };
}
