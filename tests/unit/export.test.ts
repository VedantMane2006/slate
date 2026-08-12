import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportPNG } from '../../src/persistence/export.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';
import type { Viewport } from '../../src/canvas/coordinates.ts';

describe('exportPNG', () => {
  let mockCreateElement: any;
  let mockGetContext: any;
  let mockFillRect: any;
  let mockToDataURL: any;

  beforeEach(() => {
    mockFillRect = vi.fn();
    mockGetContext = vi.fn().mockReturnValue({
      fillStyle: '',
      fillRect: mockFillRect,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      font: '',
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
    });
    mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,123');

    const originalCreateElement = document.createElement;
    mockCreateElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: mockGetContext,
          toDataURL: mockToDataURL,
          width: 0,
          height: 0,
        } as unknown as HTMLCanvasElement;
      }
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement.call(document, tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const dummyViewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };

  it('correctly computes full content bounding box and triggers download with padded dimensions', () => {
    const objects: CanvasObject[] = [
      { id: '1', type: 'text', bounds: { minX: 10, minY: 10, maxX: 50, maxY: 50 } } as any,
      { id: '2', type: 'image', bounds: { minX: 100, minY: 100, maxX: 150, maxY: 150 } } as any,
    ];

    exportPNG(objects, dummyViewport);

    // fullBounds = minX: 10, minY: 10, maxX: 150, maxY: 150
    // padding = 20
    // exportBounds = minX: -10, minY: -10, maxX: 170, maxY: 170
    // width = 180, height = 180

    // We can't directly inspect canvas width/height since it's a mocked DOM object with just width/height props,
    // but we can spy on fillRect because it fills the entire width and height:
    expect(mockFillRect).toHaveBeenCalledWith(0, 0, 180, 180);
    expect(mockToDataURL).toHaveBeenCalledWith('image/png');
  });

  it('does nothing if objects array is empty', () => {
    exportPNG([], dummyViewport);
    expect(mockCreateElement).not.toHaveBeenCalled();
  });
});
