import type { BoundingBox } from '../utils/geometry.ts';
import { unionBoundingBoxes } from '../utils/geometry.ts';
import type { CanvasObject } from '../objects/canvas-object.ts';

export interface ContextConfidence {
  score: number;
  reason: string;
}

export interface ExtractionResult {
  bounds: BoundingBox | null;
  objectIds: string[];
  strategy: 'selection' | 'recent' | 'cluster' | 'none';
  confidence: ContextConfidence;
}

const DEFAULT_RECENT_WINDOW_MS = 10000;

export function extractContext(
  objects: CanvasObject[],
  selection: { ids: string[] } | null,
  now: number
): ExtractionResult {
  // 1. Selection-first strategy
  if (selection && selection.ids.length > 0) {
    const selectedObjects = objects.filter(obj => selection.ids.includes(obj.id));
    if (selectedObjects.length > 0) {
      let unionBounds = selectedObjects[0].bounds;
      for (let i = 1; i < selectedObjects.length; i++) {
        unionBounds = unionBoundingBoxes(unionBounds, selectedObjects[i].bounds);
      }
      return {
        bounds: unionBounds,
        objectIds: selectedObjects.map(o => o.id),
        strategy: 'selection',
        confidence: { score: 1.0, reason: 'Explicit user selection' }
      };
    }
  }

  // 2. Recent-strokes fallback strategy
  const recentObjects = objects.filter(obj => {
    // We safely check for a timestamp property since only some objects (like Stroke) have it currently.
    if ('timestamp' in obj && typeof obj.timestamp === 'number') {
      return now - obj.timestamp <= DEFAULT_RECENT_WINDOW_MS;
    }
    return false;
  });

  if (recentObjects.length > 0) {
    let unionBounds = recentObjects[0].bounds;
    for (let i = 1; i < recentObjects.length; i++) {
      unionBounds = unionBoundingBoxes(unionBounds, recentObjects[i].bounds);
    }
    return {
      bounds: unionBounds,
      objectIds: recentObjects.map(o => o.id),
      strategy: 'recent',
      confidence: { score: 0.8, reason: 'Recent activity fallback' }
    };
  }

  // 3. Fallback: No selection, no recent objects
  return {
    bounds: null,
    objectIds: [],
    strategy: 'none',
    confidence: { score: 0.0, reason: 'No context found' }
  };
}
