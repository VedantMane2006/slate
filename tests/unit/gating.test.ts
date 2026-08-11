import { describe, it, expect } from 'vitest';
import { evaluateGate } from '../../src/ai/gating/gate.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';
import type { ExtractionResult } from '../../src/context-extraction/extractor.ts';

describe('evaluateGate', () => {
  const dummyObject: CanvasObject = {
    id: '1',
    type: 'stroke',
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }
  };
  
  // Creates an array of N dummy objects
  const createObjects = (n: number) => Array.from({ length: n }, (_, i) => ({ ...dummyObject, id: String(i) }));
  
  const dummyExtraction: ExtractionResult = {
    bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
    objectIds: createObjects(20).map(o => o.id), // 20 object ids
    strategy: 'recent',
    expanded: false,
    confidence: { level: 'high', reasons: [] }
  };

  it('allows valid large inactive extractions', () => {
    const result = evaluateGate(createObjects(20), dummyExtraction, 1000, 4000, false);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('bypasses heuristics when isManualTrigger is true', () => {
    // Fails everything: blank canvas, 0 objects, 0 bounds area, 0 idle time
    const result = evaluateGate(
      [],
      { ...dummyExtraction, objectIds: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } },
      1000,
      1000,
      true
    );
    
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual(['manual override']);
  });

  it('accumulates reasons for all failed conditions', () => {
    const result = evaluateGate(
      createObjects(1), // NOT blank, but too few
      { 
        ...dummyExtraction, 
        objectIds: ['1'], 
        bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } // area = 25 (<= 100)
      },
      1000,
      1500, // idle time = 500ms (<= 2000ms)
      false
    );
    
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('too-few-strokes');
    expect(result.reasons).toContain('too-small-area');
    expect(result.reasons).toContain('too-recent-change');
    expect(result.reasons).not.toContain('blank-canvas');
  });

  it('returns blank-canvas when canvas is completely empty', () => {
    const result = evaluateGate([], dummyExtraction, 1000, 4000, false);
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('blank-canvas');
  });
});
