import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePointerEvents, type PointerSample } from '../../src/hooks/usePointerEvents.ts';
import type { Viewport } from '../../src/canvas/coordinates.ts';
import type React from 'react';

describe('usePointerEvents', () => {
  const defaultViewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  
  // Helper to create a fake React.PointerEvent
  function createFakeEvent(overrides: Record<string, unknown> = {}): React.PointerEvent<HTMLCanvasElement> {
    const nativeEvent = {
      timeStamp: 12345,
      ...(overrides.nativeEvent as Record<string, unknown> || {}),
    };
    
    return {
      clientX: 100,
      clientY: 100,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      },
      nativeEvent,
      ...overrides,
    } as unknown as React.PointerEvent<HTMLCanvasElement>;
  }

  it('a sample without pressure/tilt support falls back to pressure=0.5, tilt=0 without throwing', () => {
    const onSample = vi.fn();
    const { result } = renderHook(() => usePointerEvents(defaultViewport, onSample));
    
    const event = createFakeEvent({
      // nativeEvent omits pressure, tiltX, tiltY
      nativeEvent: {
        timeStamp: 9999,
      }
    });
    
    result.current.onPointerDown(event);
    
    expect(onSample).toHaveBeenCalledOnce();
    const sample: PointerSample = onSample.mock.calls[0][0];
    expect(sample.pressure).toBe(0.5);
    expect(sample.tiltX).toBe(0);
    expect(sample.tiltY).toBe(0);
    expect(sample.timestamp).toBe(9999);
  });

  it('a pointer sample\'s x/y are correctly in world space, not screen space', () => {
    const onSample = vi.fn();
    const viewport: Viewport = { offsetX: 50, offsetY: -50, zoom: 2 };
    const { result } = renderHook(() => usePointerEvents(viewport, onSample));
    
    const event = createFakeEvent({
      clientX: 200,
      clientY: 300,
      currentTarget: {
        // Canvas is offset by 10, 20 on the screen
        getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }),
      },
    });
    
    result.current.onPointerDown(event);
    
    // Screen coords: x = 200 - 10 = 190, y = 300 - 20 = 280
    // World coords: 
    // worldX = (190 - 50) / 2 = 70
    // worldY = (280 - (-50)) / 2 = 165
    expect(onSample).toHaveBeenCalledOnce();
    const sample: PointerSample = onSample.mock.calls[0][0];
    expect(sample.x).toBe(70);
    expect(sample.y).toBe(165);
  });

  it('consumes coalesced events when available', () => {
    const onSample = vi.fn();
    const { result } = renderHook(() => usePointerEvents(defaultViewport, onSample));
    
    const event = createFakeEvent({
      nativeEvent: {
        getCoalescedEvents: () => [
          { clientX: 110, clientY: 110, timeStamp: 1 },
          { clientX: 120, clientY: 120, timeStamp: 2 },
        ]
      }
    });
    
    result.current.onPointerMove(event);
    
    expect(onSample).toHaveBeenCalledTimes(2);
    expect(onSample.mock.calls[0][0].x).toBe(110);
    expect(onSample.mock.calls[1][0].x).toBe(120);
  });
});
