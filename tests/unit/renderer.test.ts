// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderCrop } from '../../src/canvas/renderer.ts';
import type { Stroke } from '../../src/objects/stroke.ts';

describe('renderCrop', () => {
  it('produces an image data URL matching the output dimensions', async () => {
    const stroke: Stroke = {
      id: 'stroke1',
      type: 'stroke',
      points: [
        { x: 10, y: 10, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 0 },
        { x: 20, y: 20, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 1 }
      ],
      bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 },
      width: 2,
      color: '#000000',
      timestamp: 0,
      toAIPayload: () => ({ kind: 'image', data: '' })
    } as Stroke;

    const bounds = { minX: 5, minY: 5, maxX: 25, maxY: 25 }; // width 20, height 20

    // JSDOM canvas mock will just return a data URL. 
    // We can't perfectly assert pixels here without a real canvas backing (like canvas pkg),
    // but we can assert it returns a string and handles the size correctly in its logic.
    // Also we spy on document.createElement to check properties if we want.
    
    const mockCtx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    };
    const mockGetContext = vi.fn().mockReturnValue(mockCtx);
    const mockToDataURL = vi.fn().mockReturnValue('data:image/png;mock');
    
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: mockGetContext,
          toDataURL: mockToDataURL,
          width: 0,
          height: 0
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    });
    
    const dataUrl = await renderCrop([stroke], bounds, 20);
    
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:')).toBe(true);

    const mockCanvas = createElementSpy.mock.results[0].value as HTMLCanvasElement;
    expect(mockCanvas.width).toBe(20);
    expect(mockCanvas.height).toBe(20);
    
    createElementSpy.mockRestore();
  });

  it('filters objects correctly by bounds', async () => {
    const strokeInside: Stroke = {
      id: 'inside',
      type: 'stroke',
      points: [{ x: 15, y: 15, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 0 }],
      bounds: { minX: 15, minY: 15, maxX: 15, maxY: 15 },
      width: 2,
      color: '#000000',
      timestamp: 0,
      toAIPayload: () => ({ kind: 'image', data: '' })
    } as Stroke;

    const strokeOutside: Stroke = {
      id: 'outside',
      type: 'stroke',
      points: [{ x: 100, y: 100, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 0 }],
      bounds: { minX: 100, minY: 100, maxX: 100, maxY: 100 },
      width: 2,
      color: '#000000',
      timestamp: 0,
      toAIPayload: () => ({ kind: 'image', data: '' })
    } as Stroke;
    
    const bounds = { minX: 10, minY: 10, maxX: 20, maxY: 20 };
    
    // We mock canvas to spy on what gets drawn
    const beginPathSpy = vi.fn();
    const moveToSpy = vi.fn();
    const lineToSpy = vi.fn();
    const strokeSpy = vi.fn();
    
    const mockCtx = {
      beginPath: beginPathSpy,
      moveTo: moveToSpy,
      lineTo: lineToSpy,
      stroke: strokeSpy,
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    };

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: () => mockCtx,
          toDataURL: () => 'data:',
          width: 0,
          height: 0
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    });
    
    await renderCrop([strokeInside, strokeOutside], bounds, 20);
    
    // strokeOutside should be skipped. 
    // Therefore renderStrokes should only process strokeInside.
    expect(beginPathSpy).toHaveBeenCalledTimes(1);
    
    // x: 15 with bounds minX: 10 -> offsetX is -10. 15 - 10 = 5.
    // So moveTo should be called with (5, 5)
    expect(moveToSpy).toHaveBeenCalledWith(5, 5);

    createElementSpy.mockRestore();
  });
});

import { renderDraftObjects } from '../../src/canvas/renderer.ts';
import type { DraftObject } from '../../src/objects/draft-object.ts';

describe('renderDraftObjects', () => {
  it('renders table and latex placeholders if present in draft data', () => {
    const draft: DraftObject = {
      id: 'draft-1',
      type: 'draft',
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 200 },
      data: {
        explanation: 'Here is your data:',
        table: [['A', 'B'], ['1', '2']],
        latex: '\\frac{1}{2}'
      },
      toAIPayload: () => ({ kind: 'json', data: {} })
    };

    const mockCtx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    } as unknown as CanvasRenderingContext2D;

    const viewport = { offsetX: 0, offsetY: 0, zoom: 1 };

    renderDraftObjects(mockCtx, [draft], viewport);

    // Verify it attempted to draw the table cells
    expect(mockCtx.fillText).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(mockCtx.fillText).toHaveBeenCalledWith('B', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(mockCtx.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(mockCtx.fillText).toHaveBeenCalledWith('2', expect.any(Number), expect.any(Number), expect.any(Number));

    // Verify it drew the latex placeholder (which takes 3 args: text, x, y)
    expect(mockCtx.fillText).toHaveBeenCalledWith('LaTeX Formula', expect.any(Number), expect.any(Number));
  });
});
