import { describe, it, expect, vi, afterEach } from 'vitest';
import { chooseResolution, computeInkDensity } from '../../src/context-extraction/resolution.ts';
import { setForceFixedResolution } from '../../src/config/experiment.ts';
import { composeMultimodalRequest } from '../../src/ai/composition.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';
import type { ExtractionResult } from '../../src/context-extraction/extractor.ts';

vi.mock('../../src/canvas/renderer.ts', () => ({
  renderCrop: vi.fn((_objects: CanvasObject[], _bounds: unknown, resolution: number) =>
    `mock-crop-${resolution}`
  )
}));

describe('Adaptive Crop Resolution', () => {
  describe('chooseResolution', () => {
    it('returns 512 for a sparse fixture scene', () => {
      expect(chooseResolution(5, 0.1)).toBe(512); // Under 10 objs, under 0.15 density
      expect(chooseResolution(9, 0.14)).toBe(512);
    });

    it('returns 1024 for a typical scene', () => {
      // High density but few objects
      expect(chooseResolution(5, 0.5)).toBe(1024);
      // Low density but more objects
      expect(chooseResolution(20, 0.1)).toBe(1024);
      // Typical both
      expect(chooseResolution(25, 0.3)).toBe(1024);
    });

    it('returns 1536 for a dense fixture scene', () => {
      // Both thresholds exceeded
      expect(chooseResolution(30, 0.4)).toBe(1536);
      expect(chooseResolution(50, 0.8)).toBe(1536);
    });
  });

  describe('computeInkDensity', () => {
    it('returns a sensible ratio for known synthetic bounds/objects', () => {
      // 100x100 bounding box (area 10,000)
      const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      
      const objects: CanvasObject[] = [
        {
          id: '1', type: 'stroke',
          bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 }
        } as CanvasObject,
        {
          id: '2', type: 'stroke',
          bounds: { minX: 30, minY: 30, maxX: 50, maxY: 50 }
        } as CanvasObject,
      ];
      
      const density = computeInkDensity(objects, bounds);
      // Total ink area = 100 + 400 = 500
      // Bounds area = 10000
      // Expected ratio = 500 / 10000 = 0.05
      expect(density).toBe(0.05);
    });

    it('caps ratio at 1.0 even if objects overlap heavily', () => {
      const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      
      const objects: CanvasObject[] = [
        {
          id: '1', type: 'stroke',
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as CanvasObject,
        {
          id: '2', type: 'stroke',
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as CanvasObject,
      ];
      
      const density = computeInkDensity(objects, bounds);
      // Total ink area = 20000
      // Bounds area = 10000
      // Ratio = 2.0, capped at 1.0
      expect(density).toBe(1.0);
    });

    it('returns 0 if bounds have 0 area', () => {
      const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 100 };
      const objects: CanvasObject[] = [
        {
          id: '1', type: 'stroke',
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as CanvasObject
      ];
      expect(computeInkDensity(objects, bounds)).toBe(0);
    });
  });

  describe('FORCE_FIXED_RESOLUTION override', () => {
    afterEach(() => {
      setForceFixedResolution(null);
    });

    it('bypasses chooseResolution when set to 1024', async () => {
      // Set up a dense scene that would normally produce 1536
      const objects: CanvasObject[] = [];
      for (let i = 0; i < 40; i++) {
        objects.push({
          id: `s-${i}`,
          type: 'stroke',
          bounds: { minX: i * 5, minY: i * 5, maxX: i * 5 + 50, maxY: i * 5 + 50 }
        } as CanvasObject);
      }

      const result: ExtractionResult = {
        objectIds: objects.map(o => o.id),
        bounds: { minX: 0, minY: 0, maxX: 250, maxY: 250 },
        strategy: 'selection',
        confidence: { level: 'high', reasons: [] },
        expanded: false
      };

      // Without override: adaptive should NOT pick 1024 for 40 dense objects
      setForceFixedResolution(null);
      const adaptiveResult = await composeMultimodalRequest(result, objects);
      expect(adaptiveResult.metadata.resolution).not.toBe(1024);

      // With override: should force 1024 regardless
      setForceFixedResolution(1024);
      const fixedResult = await composeMultimodalRequest(result, objects);
      expect(fixedResult.metadata.resolution).toBe(1024);
      expect(fixedResult.payload.image).toBe('mock-crop-1024');
    });

    it('uses adaptive resolution when override is null', async () => {
      setForceFixedResolution(null);

      // Sparse scene: 2 objects, low density → should get 512
      const objects: CanvasObject[] = [
        { id: 'a', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 } } as CanvasObject,
        { id: 'b', type: 'stroke', bounds: { minX: 500, minY: 500, maxX: 510, maxY: 510 } } as CanvasObject
      ];
      const result: ExtractionResult = {
        objectIds: ['a', 'b'],
        bounds: { minX: 0, minY: 0, maxX: 510, maxY: 510 },
        strategy: 'selection',
        confidence: { level: 'high', reasons: [] },
        expanded: false
      };

      const { metadata } = await composeMultimodalRequest(result, objects);
      expect(metadata.resolution).toBe(512);
    });
  });
});

