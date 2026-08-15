import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AILifecycleProvider, useAILifecycle } from '../../src/providers/AILifecycleProvider.tsx';
import * as GateModule from '../../src/ai/gating/gate.ts';

vi.mock('../../src/canvas/renderer.ts', () => ({
  renderCrop: vi.fn().mockResolvedValue('mock-crop-data-url')
}));

// We mock GeminiClient to assert call count
const mockSendRequest = vi.fn();
vi.mock('../../src/ai/adapters/gemini.ts', () => {
  return {
    GeminiClient: vi.fn().mockImplementation(() => ({
      sendRequest: mockSendRequest,
    }))
  };
});

describe('Wiring Gating and Dedup into Request Flow', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AILifecycleProvider>{children}</AILifecycleProvider>
  );

  const mockObjects = [
    { id: '1', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, points: [], width: 1, color: '#000', timestamp: 0 } as any
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRequest.mockResolvedValue(JSON.stringify({ explanation: "test" }));
  });

  it('an auto-triggered request that fails gating never reaches sending', async () => {
    // Spy on evaluateGate to force a fail
    const evaluateGateSpy = vi.spyOn(GateModule, 'evaluateGate').mockReturnValue({
      allowed: false,
      reasons: ['too-few-strokes']
    });

    const { result } = renderHook(() => useAILifecycle(), { wrapper });

    await act(async () => {
      // isManualTrigger = false
      await result.current.askAI(mockObjects, null, false, 0);
    });

    // Should not have created a request or called gemini
    expect(result.current.activeRequest).toBeNull();
    expect(mockSendRequest).not.toHaveBeenCalled();

    evaluateGateSpy.mockRestore();
  });

  it('a manual request bypasses gating but still checks dedup cache', async () => {
    const evaluateGateSpy = vi.spyOn(GateModule, 'evaluateGate').mockReturnValue({
      allowed: true,
      reasons: ['manual override']
    });

    const { result } = renderHook(() => useAILifecycle(), { wrapper });

    await act(async () => {
      // isManualTrigger = true
      await result.current.askAI(mockObjects, null, true, 0);
    });

    // It should proceed to completed
    expect(result.current.activeRequest?.state).toBe('completed');
    expect(mockSendRequest).toHaveBeenCalledTimes(1);

    evaluateGateSpy.mockRestore();
  });

  it('an identical canonical payload on a second request hits the dedup cache and does NOT call GeminiClient.sendRequest again', async () => {
    const { result } = renderHook(() => useAILifecycle(), { wrapper });

    await act(async () => {
      // First call -> calls Gemini
      await result.current.askAI(mockObjects, null, true, 0);
    });

    expect(mockSendRequest).toHaveBeenCalledTimes(1);
    expect(result.current.activeRequest?.state).toBe('completed');

    await act(async () => {
      // Clear active request just to be safe
      result.current.clearRequest();
    });

    await act(async () => {
      // Second call -> identical payload, should hit dedup cache
      await result.current.askAI(mockObjects, null, true, 0);
    });

    // Call count should STILL be 1
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
    // But it should have completed successfully
    expect(result.current.activeRequest?.state).toBe('completed');
  });
});
