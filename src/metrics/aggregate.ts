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
  averageCostUsd: number;
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
      averageCostUsd: 0,
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
  let latencyCount = 0;
  let totalCost = 0;
  
  let acceptedCount = 0;
  let totalTokens = 0;
  let wastedTokens = 0;

  const confCount = {
    high: 0,
    medium: 0,
    low: 0
  };

  for (const record of records) {
    if (record.endToEndLatency !== undefined) {
      totalLatency += record.endToEndLatency;
      latencyCount++;
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

  return {
    averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
    averageCostUsd: totalCost / totalRecords,
    acceptanceRate: acceptedCount / totalRecords,
    wastedTokenRatio: totalTokens > 0 ? wastedTokens / totalTokens : 0,
    confidenceDistribution: {
      high: { count: confCount.high, percentage: confCount.high / totalRecords },
      medium: { count: confCount.medium, percentage: confCount.medium / totalRecords },
      low: { count: confCount.low, percentage: confCount.low / totalRecords }
    }
  };
}
