import type { BoundingBox } from '../utils/geometry.ts';
import { unionBoundingBoxes, boxesIntersect } from '../utils/geometry.ts';
import type { CanvasObject } from '../objects/canvas-object.ts';

export interface ContextConfidence {
  level: 'high' | 'medium' | 'low';
  reasons: string[];
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
      strategy = 'selection';
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
      strategy = 'recent';
    }
  }

  // 3. Fallback: No selection, no recent objects
  if (strategy === 'none' || !initialBounds) {
    const partial = {
      bounds: null,
      objectIds: [],
      strategy: 'none' as const,
      expanded: false,
    };
    return {
      ...partial,
      confidence: computeConfidence(partial, objects),
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

  const partialResult = {
    bounds: currentBounds,
    objectIds: Array.from(currentObjectIds),
    strategy,
    expanded,
  };

  return {
    ...partialResult,
    confidence: computeConfidence(partialResult, objects),
  };
}

export function computeConfidence(
  result: Omit<ExtractionResult, 'confidence'>,
  objects: CanvasObject[]
): ContextConfidence {
  if (result.strategy === 'none') {
    return { level: 'low', reasons: ['No context found'] };
  }

  let score = 0;
  const reasons: string[] = [];

  if (result.strategy === 'selection') {
    score += 50;
    reasons.push('Extraction derived from explicit user selection');
  } else if (result.strategy === 'recent') {
    score += 20;
    reasons.push('Extraction derived from recent activity fallback');
  }

  if (result.objectIds.length > 5) {
    score += 20;
    reasons.push('High density of objects within context bounds');
  } else if (result.objectIds.length > 0) {
    score += 10;
    reasons.push('Context contains some objects');
  }

  if (result.expanded) {
    score -= 10;
    reasons.push('Cluster expansion required (confidence reduced due to distance)');
  }

  let level: 'high' | 'medium' | 'low' = 'low';
  if (score >= 50) {
    level = 'high';
  } else if (score >= 30) {
    level = 'medium';
  }

  return { level, reasons };
}
