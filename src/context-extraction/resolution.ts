import type { CanvasObject } from '../objects/canvas-object.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import { boxesIntersect } from '../utils/geometry.ts';

// Tunable constants for adaptive resolution.
// These are documented starting guesses and should ideally be re-tuned once real trace data exists (Phase 13).
const SPARSE_OBJ_THRESHOLD = 10;
const SPARSE_DENSITY_THRESHOLD = 0.15;
const TYPICAL_OBJ_THRESHOLD = 30;
const TYPICAL_DENSITY_THRESHOLD = 0.4;

/**
 * Computes a rough "ink density" ratio (0 to 1) for a given set of objects and a bounding box.
 * Ratio = (sum of area of objects intersecting the bounds) / (area of bounds)
 */
export function computeInkDensity(objects: CanvasObject[], bounds: BoundingBox): number {
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  
  if (boundsWidth <= 0 || boundsHeight <= 0) {
    return 0;
  }
  
  const boundsArea = boundsWidth * boundsHeight;
  let totalInkArea = 0;

  for (const obj of objects) {
    if (boxesIntersect(obj.bounds, bounds)) {
      const objWidth = Math.max(0, obj.bounds.maxX - obj.bounds.minX);
      const objHeight = Math.max(0, obj.bounds.maxY - obj.bounds.minY);
      totalInkArea += (objWidth * objHeight);
    }
  }

  // Cap ratio at 1.0 (though it could theoretically exceed 1.0 if objects overlap heavily)
  return Math.min(1.0, totalInkArea / boundsArea);
}

/**
 * Chooses an adaptive resolution based on scene density and complexity.
 */
export function chooseResolution(objectCount: number, inkDensity: number): 512 | 1024 | 1536 {
  if (objectCount < SPARSE_OBJ_THRESHOLD && inkDensity < SPARSE_DENSITY_THRESHOLD) {
    return 512;
  }
  
  if (objectCount < TYPICAL_OBJ_THRESHOLD || inkDensity < TYPICAL_DENSITY_THRESHOLD) {
    return 1024;
  }
  
  return 1536;
}
