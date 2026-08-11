import type { CanvasObject } from '../../objects/canvas-object.ts';
import type { ExtractionResult } from '../../context-extraction/extractor.ts';

export interface GateResult {
  allowed: boolean;
  reasons: string[];
}

export function evaluateGate(
  objects: CanvasObject[],
  extraction: ExtractionResult,
  lastChangeTimestamp: number,
  now: number,
  isManualTrigger: boolean
): GateResult {
  // Intentional per Architecture.md: Manual triggers bypass all heuristics.
  if (isManualTrigger) {
    return { allowed: true, reasons: ['manual override'] };
  }

  const reasons: string[] = [];

  if (objects.length === 0) {
    reasons.push('blank-canvas');
  }

  if (extraction.objectIds.length <= 15) {
    reasons.push('too-few-strokes');
  }

  if (!extraction.bounds) {
    reasons.push('too-small-area');
  } else {
    const area = (extraction.bounds.maxX - extraction.bounds.minX) * (extraction.bounds.maxY - extraction.bounds.minY);
    if (area <= 100) {
      reasons.push('too-small-area');
    }
  }

  if (now - lastChangeTimestamp <= 2000) {
    reasons.push('too-recent-change');
  }

  return {
    allowed: reasons.length === 0,
    reasons
  };
}
