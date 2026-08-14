import { traceWriter } from '../metrics/trace-writer';
import type { BoundingBox } from '../utils/geometry';
import { unionBoundingBoxes, boxesIntersect } from '../utils/geometry';
import type { CanvasObject } from '../objects/canvas-object';
import { computeInkDensity } from './resolution';

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


export function writeExtractionTrace(result: ExtractionResult, confidence: ContextConfidence): void {
  traceWriter.logExtraction({
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
      confidence: computeConfidence(partial, objects),
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
    confidence: computeConfidence(partialResult, objects),
  };

  writeExtractionTrace(finalResult, finalResult.confidence);

  return finalResult;
}

/**
 * Determines the confidence tier of an extraction using explicit, deterministic rules:
 * 
 * - 'low': Triggers if ANY floor condition is failed. The floors are:
 *          1. Object count below the sparse floor (<= 15)
 *          2. Bounding-box area below the trivial-content floor (<= 100)
 *          3. Ink density near zero (< 0.15)
 * 
 * - 'high': Triggers ONLY if ALL of the following are met:
 *           1. Extraction came from a real user selection (strategy === 'selection')
 *           2. Object count and density are both above a defined "rich content" threshold (>= 30 objects and >= 0.4 density)
 *           3. No cluster expansion was needed (expanded === false)
 * 
 * - 'medium': The explicit default/fallback. Anything that clears the 'low' floor but does NOT
 *             meet ALL of the 'high' conditions. (e.g. real selection but sparse content, OR 
 *             recent-fallback/expanded result with decent density).
 */
export function computeConfidence(
  result: Omit<ExtractionResult, 'confidence'>,
  objects: CanvasObject[]
): ContextConfidence {
  if (result.strategy === 'none' || !result.bounds) {
    return { level: 'low', reasons: ['No context found'] };
  }

  const reasons: string[] = [];
  const objectCount = result.objectIds.length;
  const area = (result.bounds.maxX - result.bounds.minX) * (result.bounds.maxY - result.bounds.minY);
  
  const resultObjects = objects.filter(o => result.objectIds.includes(o.id));
  const inkDensity = computeInkDensity(resultObjects, result.bounds);

  const SPARSE_FLOOR = 15;
  const TRIVIAL_AREA_FLOOR = 100;
  const SPARSE_DENSITY_FLOOR = 0.15;

  // low: triggers if ANY floor condition fails
  if (objectCount <= SPARSE_FLOOR || area <= TRIVIAL_AREA_FLOOR || inkDensity < SPARSE_DENSITY_FLOOR) {
    if (objectCount <= SPARSE_FLOOR) reasons.push('object count below the sparse floor');
    if (area <= TRIVIAL_AREA_FLOOR) reasons.push('bounding-box area below the trivial-content floor');
    if (inkDensity < SPARSE_DENSITY_FLOOR) reasons.push('ink density near zero');
    return { level: 'low', reasons };
  }

  const RICH_OBJ_THRESHOLD = 30;
  const RICH_DENSITY_THRESHOLD = 0.4;

  const isSelection = result.strategy === 'selection';
  const isRichContent = objectCount >= RICH_OBJ_THRESHOLD && inkDensity >= RICH_DENSITY_THRESHOLD;
  const isNotExpanded = !result.expanded;

  // high: triggers ONLY if ALL high conditions are met
  if (isSelection && isRichContent && isNotExpanded) {
    reasons.push('explicit selection with rich content and no expansion needed');
    return { level: 'high', reasons };
  }

  // medium: the explicit default/fallback — cleared the low floor, but did not meet every high-confidence condition
  if (!isSelection) {
    reasons.push('recent-fallback used instead of explicit selection');
  } else if (!isRichContent) {
    reasons.push('cleared low floor, but content is sparse/not rich enough for high confidence');
  } else if (!isNotExpanded) {
    reasons.push('expansion was required to find content');
  } else {
    reasons.push('cleared the low floor, but did not meet every high-confidence condition');
  }

  return { level: 'medium', reasons };
}
