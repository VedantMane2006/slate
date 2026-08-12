import { describe, it, expect } from 'vitest';
import { chooseResolution, computeInkDensity } from '../../src/context-extraction/resolution.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

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
          id: '1', type: 'stroke', color: '#000', timestamp: 0, width: 1, points: [],
          // 10x10 object (area 100)
          bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 }
        } as any,
        {
          id: '2', type: 'stroke', color: '#000', timestamp: 0, width: 1, points: [],
          // 20x20 object (area 400)
          bounds: { minX: 30, minY: 30, maxX: 50, maxY: 50 }
        } as any,
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
          id: '1', type: 'stroke', color: '#000', timestamp: 0, width: 1, points: [],
          // Full bounds (area 10000)
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as any,
        {
          id: '2', type: 'stroke', color: '#000', timestamp: 0, width: 1, points: [],
          // Full bounds (area 10000)
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as any,
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
          id: '1', type: 'stroke', color: '#000', timestamp: 0, width: 1, points: [],
          bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
        } as any
      ];
      expect(computeInkDensity(objects, bounds)).toBe(0);
    });
  });
});
