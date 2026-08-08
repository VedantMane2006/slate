import type { BoundingBox } from '../utils/geometry.ts';
import { unionBoundingBoxes, boxesIntersect } from '../utils/geometry.ts';
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
  expanded: boolean;
}

const DEFAULT_RECENT_WINDOW_MS = 10000;
const DEFAULT_PROXIMITY_THRESHOLD = 5;
const DEFAULT_EXPANSION_CAP = 5;

export function extractContext(
  objects: CanvasObject[],
  selection: { ids: string[] } | null,
  now: number
): ExtractionResult {
  let initialBounds: BoundingBox | null = null;
  let initialObjectIds: string[] = [];
  let strategy: 'selection' | 'recent' | 'none' = 'none';
  let confidence: ContextConfidence = { score: 0.0, reason: 'No context found' };

  // 1. Selection-first strategy
  if (selection && selection.ids.length > 0) {
    const selectedObjects = objects.filter((obj) => selection.ids.includes(obj.id));
    if (selectedObjects.length > 0) {
      let unionBounds = selectedObjects[0].bounds;
      for (let i = 1; i < selectedObjects.length; i++) {
        unionBounds = unionBoundingBoxes(unionBounds, selectedObjects[i].bounds);
      }
      initialBounds = unionBounds;
      initialObjectIds = selectedObjects.map((o) => o.id);
      strategy = 'selection';
      confidence = { score: 1.0, reason: 'Explicit user selection' };
    }
  }

  // 2. Recent-strokes fallback strategy
  if (strategy === 'none') {
    const recentObjects = objects.filter((obj) => {
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
      initialBounds = unionBounds;
      initialObjectIds = recentObjects.map((o) => o.id);
      strategy = 'recent';
      confidence = { score: 0.8, reason: 'Recent activity fallback' };
    }
  }

  // 3. Fallback: No selection, no recent objects
  if (strategy === 'none' || !initialBounds) {
    return {
      bounds: null,
      objectIds: [],
      strategy: 'none',
      confidence,
      expanded: false,
    };
  }

  // 4. Cluster expansion
  // NOTE: this is a SIMPLE bounding-box proximity version; Phase 11 will replace this 
  // with true connected-component graph analysis — the public extractContext signature 
  // must not change when that happens.
  
  let currentBounds = initialBounds;
  const currentObjectIds = new Set(initialObjectIds);
  let expanded = false;
  
  for (let iteration = 0; iteration < DEFAULT_EXPANSION_CAP; iteration++) {
    const proximityBox: BoundingBox = {
      minX: currentBounds.minX - DEFAULT_PROXIMITY_THRESHOLD,
      minY: currentBounds.minY - DEFAULT_PROXIMITY_THRESHOLD,
      maxX: currentBounds.maxX + DEFAULT_PROXIMITY_THRESHOLD,
      maxY: currentBounds.maxY + DEFAULT_PROXIMITY_THRESHOLD,
    };
    
    let addedInThisIteration = false;
    for (const obj of objects) {
      if (!currentObjectIds.has(obj.id) && boxesIntersect(obj.bounds, proximityBox)) {
        currentObjectIds.add(obj.id);
        currentBounds = unionBoundingBoxes(currentBounds, obj.bounds);
        addedInThisIteration = true;
        expanded = true;
      }
    }
    
    if (!addedInThisIteration) {
      break;
    }
  }

  return {
    bounds: currentBounds,
    objectIds: Array.from(currentObjectIds),
    strategy,
    confidence,
    expanded,
  };
}
