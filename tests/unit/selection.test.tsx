import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';

describe('Selection Tool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly selects strokes whose bounds intersect it and excludes ones that do not', async () => {
    const fillRectSpy = vi.fn();
    const strokeRectSpy = vi.fn();
    
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: fillRectSpy,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: strokeRectSpy,
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    if (!canvas.setPointerCapture) {
      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
    }

    // 1. Draw first stroke at (100, 100) -> (120, 120)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    // 2. Draw second stroke at (300, 300) -> (320, 320)
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 320, clientY: 320 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 320, clientY: 320 });

    strokeRectSpy.mockClear();
    fillRectSpy.mockClear();

    // 3. Switch to Select Mode (KeyV)
    fireEvent.keyDown(window, { code: 'KeyV' });

    // 4. Rubber-band drag over the first stroke: (50, 50) -> (150, 150)
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 150, clientY: 150 });
    
    // We haven't pointer-upped yet. While moving, selectionBox and stroke highlights should be drawn.
    
    await waitFor(() => {
      // fillRect is called for the background (1), and for the selection box (1)
      expect(fillRectSpy).toHaveBeenCalled();
      
      // strokeRect is called for the selected stroke bounds (1), and the selection box (1)
      expect(strokeRectSpy).toHaveBeenCalled();
      
      // Let's verify the arguments to strokeRect to ensure the selection box AND exactly ONE stroke is highlighted.
      // We can check how many times strokeRect was called in the latest render frame.
      // Or we can just count total strokeRect calls that match the selection box logic.
    });

    // Check calls made to strokeRect during the drag.
    // The selection box draws at (50, 50) with width 100, height 100.
    const calls = strokeRectSpy.mock.calls;
    
    // We expect the selection box to be drawn at least once: (50, 50, 100, 100)
    const selectionBoxCalls = calls.filter(args => args[0] === 50 && args[1] === 50 && args[2] === 100 && args[3] === 100);
    expect(selectionBoxCalls.length).toBeGreaterThan(0);
    
    // The first stroke has bounds min:98, min:98, max:122, max:122 (since width is 4).
    // The highlight draws at minX - 4, minY - 4, width + 8, height + 8
    // So x: 94, y: 94, w: 32, h: 32
    const stroke1HighlightCalls = calls.filter(args => args[0] === 94 && args[1] === 94 && args[2] === 32 && args[3] === 32);
    expect(stroke1HighlightCalls.length).toBeGreaterThan(0);
    
    // The second stroke should NOT be highlighted!
    // bounds: min:298, min:298, max:322, max:322
    // So x: 294, y: 294, w: 32, h: 32
    const stroke2HighlightCalls = calls.filter(args => args[0] === 294 && args[1] === 294 && args[2] === 32 && args[3] === 32);
    expect(stroke2HighlightCalls.length).toBe(0);

    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 150, clientY: 150 });
  });
});
