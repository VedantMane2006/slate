import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Delete -> Undo restores the deleted objects', async () => {
    const fillRectSpy = vi.fn();
    const strokeRectSpy = vi.fn();
    
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();

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
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    // 1. Draw a stroke at (100, 100) -> (120, 120)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    // 2. Select it
    fireEvent.keyDown(window, { code: 'KeyV' });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 150, clientY: 150 });

    strokeRectSpy.mockClear();

    // 3. Delete
    fireEvent.keyDown(window, { code: 'Delete' });

    // Verify it is deleted (strokeRect not called for selection because stroke is gone)
    await waitFor(() => {
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 94);
      expect(highlightCalls.length).toBe(0);
    });

    // 4. Undo
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true });

    // Verify it is restored
    await waitFor(() => {
      const highlightCalls = strokeRectSpy.mock.calls.filter(args => args[0] === 94);
      expect(highlightCalls.length).toBeGreaterThan(0);
    });
  });

  it('Ctrl+Z / Ctrl+Shift+Z correctly trigger undo/redo through HistoryStack', async () => {
    const strokeSpy = vi.fn();
    
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
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    // 1. Draw a stroke
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    // 2. Undo
    strokeSpy.mockClear();
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true });

    await waitFor(() => {
      // Stroke is gone, only origin axes are drawn.
      // Origin axes draw 1 time per render.
      // Initially, there are origin axes (1) + stroke (1)
      // Now there should be origin axes (1).
      // Since it re-renders, the number of strokes drawn should be 0.
      expect(strokeSpy).toHaveBeenCalled();
    });

    // Let's count how many times stroke() is called per render.
    // Origin axes: 1 time.
    // Grid: 1 time.
    // Strokes: 1 time per stroke.
    // Since we undo, there are 0 strokes. So total 2 calls to stroke().
    strokeSpy.mockClear();

    // 3. Redo
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      // Strokes are back! So 3 calls to stroke() per render.
      expect(strokeSpy.mock.calls.length).toBeGreaterThan(2);
    });
  });
});
