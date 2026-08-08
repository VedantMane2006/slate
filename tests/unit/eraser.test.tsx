import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';
import * as renderer from '../../src/canvas/renderer.ts';

describe('Eraser Tool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly identifies and removes a stroke under the pointer', async () => {
    const renderSpy = vi.spyOn(renderer, 'renderStrokes');
    
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    if (!canvas.setPointerCapture) {
      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
    }

    // 1. Draw a stroke
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 110 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    await waitFor(() => {
      const allCalls = renderSpy.mock.calls;
      const finalCalls = allCalls.filter(call => call[1].length === 1 && call[1][0].points && call[1][0].points.length === 3);
      expect(finalCalls.length).toBeGreaterThan(0);
    });

    renderSpy.mockClear();

    // 2. Enable Eraser Mode
    fireEvent.keyDown(window, { code: 'KeyE' });

    // 3. Erase the stroke (hit testing at 110, 110 which is on the stroke)
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 110, clientY: 110 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 110, clientY: 110 });

    // 4. Verify it was removed
    await waitFor(() => {
      // The state should be updated to empty strokes
      const lastCall = renderSpy.mock.calls[renderSpy.mock.calls.length - 1];
      expect(lastCall).toBeDefined();
      expect(lastCall[1]).toHaveLength(0); // strokes array is now empty
    });
  });

  it('does not remove strokes outside its hit-test tolerance', async () => {
    const renderSpy = vi.spyOn(renderer, 'renderStrokes');
    
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    if (!canvas.setPointerCapture) {
      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
    }

    // 1. Draw a stroke at 100,100
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 110 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    await waitFor(() => {
      const allCalls = renderSpy.mock.calls;
      const finalCalls = allCalls.filter(call => call[1].length === 1 && call[1][0].points && call[1][0].points.length === 3);
      expect(finalCalls.length).toBeGreaterThan(0);
    });

    renderSpy.mockClear();

    // 2. Enable Eraser Mode
    fireEvent.keyDown(window, { code: 'KeyE' });

    // 3. Erase FAR AWAY from the stroke (at 500, 500)
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 500, clientY: 500 });

    // 4. Verify it was NOT removed by drawing another stroke and expecting 2 total strokes
    fireEvent.keyDown(window, { code: 'KeyD' }); // exit eraser mode
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 210, clientY: 210 });
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 220, clientY: 220 });

    await waitFor(() => {
      const finalCalls = renderSpy.mock.calls.filter(call => call[1].length === 2 && call[1][0].points && call[1][1].points);
      expect(finalCalls.length).toBeGreaterThan(0);
    });
  });
});
