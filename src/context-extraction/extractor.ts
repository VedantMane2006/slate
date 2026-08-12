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

export interface TraceEntry {
  timestamp: number;
  strategy: string;
  confidence: ContextConfidence;
  objectCount: number;
  bounds: BoundingBox | null;
}

// NOTE: This is an in-memory stub only; real file/local persistence for 
// traces is built later (Phase 13, per Architecture.md) — do not implement file I/O here.
export const __EXTRACTION_TRACES: TraceEntry[] = [];

export function writeExtractionTrace(result: ExtractionResult, confidence: ContextConfidence): void {
  __EXTRACTION_TRACES.push({
    timestamp: Date.now(),
    strategy: result.strategy,
    confidence,
    objectCount: result.objectIds.length,
    bounds: result.bounds ? { ...result.bounds } : null,
  });
}

const DEFAULT_RECENT_WINDOW_MS = 10000;
const DEFAULT_PROXIMITY_THRESHOLD = 5;

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
    const finalResult = {
      ...partial,
      confidence: computeConfidence(partial),
    };
    writeExtractionTrace(finalResult, finalResult.confidence);
    return finalResult;
  }

  // 4. Cluster expansion (Union-Find Connected Components)
  
  let currentBounds = initialBounds;
  const currentObjectIds = new Set(initialObjectIds);
  let expanded = false;

  const n = objects.length;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
  }

  function find(i: number): number {
    let root = i;
    while (root !== parent[root]) {
      root = parent[root];
    }
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
    }
  }

  const expandBox = (box: BoundingBox) => ({
    minX: box.minX - DEFAULT_PROXIMITY_THRESHOLD,
    minY: box.minY - DEFAULT_PROXIMITY_THRESHOLD,
    maxX: box.maxX + DEFAULT_PROXIMITY_THRESHOLD,
    maxY: box.maxY + DEFAULT_PROXIMITY_THRESHOLD,
  });

  // O(N^2) pairwise proximity/overlap check
  for (let i = 0; i < n; i++) {
    const expandedI = expandBox(objects[i].bounds);
    for (let j = i + 1; j < n; j++) {
      if (boxesIntersect(expandedI, objects[j].bounds)) {
        union(i, j);
      }
    }
  }

  // Identify roots corresponding to the initial working set
  const targetRoots = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (currentObjectIds.has(objects[i].id)) {
      targetRoots.add(find(i));
    }
  }

  // Expand working set to include the full connected components
  for (let i = 0; i < n; i++) {
    if (targetRoots.has(find(i))) {
      const obj = objects[i];
      if (!currentObjectIds.has(obj.id)) {
        currentObjectIds.add(obj.id);
        currentBounds = unionBoundingBoxes(currentBounds, obj.bounds);
        expanded = true;
      }
    }
  }

  const partialResult = {
    bounds: currentBounds,
    objectIds: Array.from(currentObjectIds),
    strategy,
    expanded,
  };

  const finalResult = {
    ...partialResult,
    confidence: computeConfidence(partialResult),
  };

  writeExtractionTrace(finalResult, finalResult.confidence);

  return finalResult;
}

export function computeConfidence(
  result: Omit<ExtractionResult, 'confidence'>
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
