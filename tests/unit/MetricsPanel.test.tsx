import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsPanel } from '../../src/components/MetricsPanel.tsx';
import { MetricsProvider, useMetrics } from '../../src/providers/MetricsProvider.tsx';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';

function TestDriver({ newRequestTrigger }: { newRequestTrigger?: boolean }) {
  const { logOutcome } = useMetrics();
  
  React.useEffect(() => {
    if (newRequestTrigger) {
      const mockReq = {
        id: 'test-2',
        state: 'completed',
        payload: { image: '', fragments: [] },
        timestamps: { encoding: 1000, completed: 3000 },
        configId: 'test-config',
        promptVersion: '1.0.0',
        confidenceLevel: 'medium'
      } as AIRequest;
      logOutcome(mockReq, 'accepted', 'foo', 'medium');
    }
  }, [newRequestTrigger, logOutcome]);

  return <MetricsPanel />;
}

describe('MetricsPanel', () => {
  const mockReq1: AIRequest = {
    id: 'test-1',
    state: 'completed',
    payload: { image: '', fragments: [] },
    timestamps: { encoding: 1000, completed: 2000 },
    configId: 'test-config',
    promptVersion: '1.0.0',
    confidenceLevel: 'high'
  } as AIRequest;

  it('renders correct aggregated values given a fixture list of past requests', () => {
    const Initializer = () => {
      const { logOutcome } = useMetrics();
      React.useEffect(() => {
        logOutcome(mockReq1, 'discarded', 'foo', 'high');
      }, [logOutcome]);
      return <MetricsPanel />;
    };

    render(
      <MetricsProvider>
        <Initializer />
      </MetricsProvider>
    );

    expect(screen.getByText('n=1')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // Acceptance rate
    expect(screen.getByText('100.0%')).toBeInTheDocument(); // Wasted Tokens
    expect(screen.getByText('1000ms')).toBeInTheDocument(); // Avg Latency
  });

  it('updates when a new completed request is added to state', () => {
    const { rerender } = render(
      <MetricsProvider>
        <TestDriver newRequestTrigger={false} />
      </MetricsProvider>
    );

    expect(screen.getByText('n=0')).toBeInTheDocument();

    rerender(
      <MetricsProvider>
        <TestDriver newRequestTrigger={true} />
      </MetricsProvider>
    );

    // It should now have n=1 and updated latency
    expect(screen.getByText('n=1')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument(); // Acceptance rate for 1 accepted
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // Wasted token for 1 accepted
    expect(screen.getByText('2000ms')).toBeInTheDocument(); // latency of 2000
  });
});
