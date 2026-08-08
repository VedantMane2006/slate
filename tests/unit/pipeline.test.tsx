import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';
import * as renderer from '../../src/canvas/renderer.ts';

describe('Draw Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a new Stroke on pointerdown -> move -> up sequence', async () => {
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


    // 1. Pointer Down
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    
    // 2. Pointer Move
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 110 });
    
    // 3. Pointer Up
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 120 });

    await waitFor(() => {
      const allCalls = renderSpy.mock.calls;
      console.log("ALL CALLS:", JSON.stringify(allCalls, null, 2));
      const finalCalls = allCalls.filter(call => call[1].length === 1 && call[1][0].points && call[1][0].points.length === 3);
      expect(finalCalls.length).toBeGreaterThan(0);
      const finalStroke = finalCalls[0][1][0];
      expect(finalStroke.points).toHaveLength(3);
      expect(finalStroke.type).toBe('stroke');
    });
  });
});
