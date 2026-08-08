import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';

describe('Integration: Draw -> Select -> Move -> Undo -> Redo -> Delete -> Undo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs full sequence maintaining expected state', async () => {
    const strokeSpy = vi.fn();
    const translateSpy = vi.fn();
    const strokeRectSpy = vi.fn();
    
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: strokeSpy,
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: strokeRectSpy,
      save: vi.fn(),
      restore: vi.fn(),
      translate: translateSpy,
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    // 1. Draw a stroke (100, 100) -> (120, 120)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    // 2. Select the stroke
    fireEvent.keyDown(window, { code: 'KeyV' });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 150, clientY: 150 });

    // 3. Move the stroke
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 110, clientY: 110 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 160, clientY: 160 });
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 160, clientY: 160 });

    // Wait for the state to settle
    await waitFor(() => {
      // Offset applied during drag (before pointerUp) or after (permanently moved)
      // Once pointerUp, stroke coordinates are updated permanently, 
      // so it will be drawn at the new place without translateSpy.
      // But the highlight box will be drawn around the new coordinates (144, 144)
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 144 && args[1] === 144);
      expect(highlightCalls.length).toBeGreaterThan(0);
    });

    strokeRectSpy.mockClear();

    // 4. Undo Move
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true });
    await waitFor(() => {
      // Stroke bounds returned to 98, so highlight is at 94
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 94 && args[1] === 94);
      expect(highlightCalls.length).toBeGreaterThan(0);
    });

    strokeRectSpy.mockClear();

    // 5. Redo Move
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true, shiftKey: true });
    await waitFor(() => {
      // Back to 144
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 144 && args[1] === 144);
      expect(highlightCalls.length).toBeGreaterThan(0);
    });

    strokeRectSpy.mockClear();

    // 6. Delete
    fireEvent.keyDown(window, { code: 'Delete' });
    await waitFor(() => {
      // Both highlights should be gone
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 144 || args[0] === 94);
      expect(highlightCalls.length).toBe(0);
    });

    strokeRectSpy.mockClear();

    // 7. Undo Delete
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true });
    await waitFor(() => {
      // Back to 144
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 144 && args[1] === 144);
      expect(highlightCalls.length).toBeGreaterThan(0);
    });
  });
});
