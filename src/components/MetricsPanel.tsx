import { useMetrics } from '../providers/MetricsProvider.tsx';
import { CURRENT_EXPERIMENT_CONFIG } from '../config/experiment.ts';

export function MetricsPanel() {
  const { aggregated, records } = useMetrics();

  return (
    <div 
      className="absolute top-4 right-4 w-72 bg-white/90 backdrop-blur-md shadow-lg rounded-xl border border-gray-200 p-4 text-xs font-mono text-gray-700 flex flex-col gap-3 z-50 pointer-events-auto"
      data-testid="metrics-panel"
    >
      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
        <h3 className="font-bold text-gray-900 uppercase tracking-wider">Live Metrics</h3>
        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
          n={records.length}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Config:</span>
          <span className="font-semibold text-gray-900">{CURRENT_EXPERIMENT_CONFIG.configId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Prompt:</span>
          <span className="font-semibold text-gray-900">v{CURRENT_EXPERIMENT_CONFIG.promptVersion}</span>
        </div>
      </div>

      <div className="h-px bg-gray-200 w-full" />

      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Avg Latency:</span>
          <span className="font-semibold text-gray-900">
            {aggregated.averageLatencyMs ? `${Math.round(aggregated.averageLatencyMs)}ms` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Avg Cost:</span>
          <span className="font-semibold text-emerald-600">
            {aggregated.averageCostUsd ? `$${aggregated.averageCostUsd.toFixed(6)}` : '-'}
          </span>
        </div>
      </div>

      <div className="h-px bg-gray-200 w-full" />

      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Acceptance Rate:</span>
          <span className="font-semibold text-gray-900">
            {(aggregated.acceptanceRate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Wasted Tokens:</span>
          <span className="font-semibold text-rose-500">
            {(aggregated.wastedTokenRatio * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="h-px bg-gray-200 w-full" />

      <div className="flex flex-col gap-1">
        <span className="text-gray-500 mb-1">Confidence Dist:</span>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-100 rounded p-1.5 text-center">
            <div className="text-[10px] text-gray-400">HIGH</div>
            <div className="font-bold text-gray-900">{aggregated.confidenceDistribution.high.count}</div>
          </div>
          <div className="flex-1 bg-gray-100 rounded p-1.5 text-center">
            <div className="text-[10px] text-gray-400">MED</div>
            <div className="font-bold text-gray-900">{aggregated.confidenceDistribution.medium.count}</div>
          </div>
          <div className="flex-1 bg-gray-100 rounded p-1.5 text-center">
            <div className="text-[10px] text-gray-400">LOW</div>
            <div className="font-bold text-gray-900">{aggregated.confidenceDistribution.low.count}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
