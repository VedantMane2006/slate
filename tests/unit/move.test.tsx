import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';

describe('Move Tool', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('translates selected strokes visually and commits exactly one Command to the HistoryStack', async () => {
    const fillRectSpy = vi.fn();
    const strokeRectSpy = vi.fn();
    const translateSpy = vi.fn();
    
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
      translate: translateSpy,
    } as unknown as CanvasRenderingContext2D);

    const { container } = render(<CanvasViewport />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();

    // 1. Draw a stroke at (100, 100) -> (120, 120)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    // 2. Select the stroke
    fireEvent.keyDown(window, { code: 'KeyV' });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 150, clientY: 150 });
    
    // Check if it got selected
    await waitFor(() => {
      expect(strokeRectSpy).toHaveBeenCalled();
    });
    
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 150, clientY: 150 });

    translateSpy.mockClear();
    strokeRectSpy.mockClear();

    // 3. Move the stroke (clicking ON the stroke bounds, dragging to +50, +50)
    // The stroke bounds are 98 to 122. So 110, 110 is inside it.
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 110, clientY: 110 });
    
    // Drag multiple times
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 130, clientY: 130 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 160, clientY: 160 });
    
    // Wait for the render loop to catch the dragOffset
    await waitFor(() => {
      // Offset should be (160 - 110) = 50
      // ctx.translate should be called with (50, 50) since zoom = 1
      expect(translateSpy).toHaveBeenCalledWith(50, 50);
    });

    // 4. Release mouse
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 160, clientY: 160 });

    translateSpy.mockClear();
    strokeRectSpy.mockClear();

    // Now if we undo, the stroke should go back to its original position
    // Since exactly ONE command was added, one undo should suffice
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true }); // Undo

    await waitFor(() => {
      // Stroke is back to 98-122
      // The highlight box (x - 4) should be drawn at 94, 94
      const calls = strokeRectSpy.mock.calls;
      const highlightCall = calls.find(args => args[0] === 94 && args[1] === 94);
      expect(highlightCall).toBeDefined();
    });
  });
});
