import { useMemo } from 'react';
import type { AIRequest } from '../ai/lifecycle/state-machine.ts';
import { deriveTokenUsageAndCost } from '../metrics/cost.ts';
import { useMetrics } from '../providers/MetricsProvider.tsx';

interface CostPreviewProps {
  request: AIRequest | null;
}

export function CostPreview({ request }: CostPreviewProps) {
  const { aggregated } = useMetrics();

  const preview = useMemo(() => {
    if (!request) return null;
    
    // Estimate cost with 0 response tokens for the preview
    const est = deriveTokenUsageAndCost(request, "");
    
    return {
      promptTokens: est.promptTokens,
      estimatedLatencyMs: aggregated.averageLatencyMs > 0 ? aggregated.averageLatencyMs : 2500, // Static fallback 2.5s
      estimatedCostUsd: est.costUsd
    };
  }, [request, aggregated]);

  if (!request || !preview) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 100,
      display: 'flex',
      gap: '16px',
      fontSize: '14px',
      alignItems: 'center',
      border: '1px solid #dee2e6'
    }}>
      <div><strong>Est. Tokens:</strong> {preview.promptTokens}</div>
      <div><strong>Est. Latency:</strong> {(preview.estimatedLatencyMs / 1000).toFixed(1)}s</div>
      <div><strong>Est. Cost:</strong> ${preview.estimatedCostUsd.toFixed(6)}</div>
      <div style={{ fontSize: '12px', color: '#6c757d' }}>State: {request.state}</div>
    </div>
  );
}
