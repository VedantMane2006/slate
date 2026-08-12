import { describe, it, expect } from 'vitest';
import { extractContext } from '../../src/context-extraction/extractor.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

describe('Connected-Component Clustering (Union-Find)', () => {
  it('correctly clusters a chain of objects into a single component', () => {
    // Proximity threshold is 5.
    // Box A: (0,0)-(10,10)
    // Box B: (14,0)-(24,10) - distance to A is 4 (union with A)
    // Box C: (28,0)-(38,10) - distance to B is 4 (union with B), but distance to A is 18 (far)
    // With iterative proximity (old), if selection is A, B is within 5 of A, so B is added.
    // Then C is within 5 of B. Wait, the old iterative loop would add C in the NEXT iteration.
    // The old loop was capped at 5 iterations. So it would work for short chains.
    // Let's make a longer chain to prove Union-Find gets it all at once without iteration caps,
    // OR we just verify that it successfully groups A, B, and C as required.
    const objects: CanvasObject[] = [
      { id: 'A', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      { id: 'B', bounds: { minX: 14, minY: 0, maxX: 24, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      { id: 'C', bounds: { minX: 28, minY: 0, maxX: 38, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      { id: 'D', bounds: { minX: 42, minY: 0, maxX: 52, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
    ];

    const result = extractContext(objects, { ids: ['A'] }, 100);
    
    // It should expand to include all 4 objects.
    expect(result.objectIds.length).toBe(4);
    expect(result.objectIds).toContain('A');
    expect(result.objectIds).toContain('B');
    expect(result.objectIds).toContain('C');
    expect(result.objectIds).toContain('D');
    expect(result.expanded).toBe(true);
    
    // Bounds should cover the entire chain minX: 0, maxX: 52
    expect(result.bounds).toEqual({ minX: 0, minY: 0, maxX: 52, maxY: 10 });
  });

  it('keeps clearly disjoint groups as separate components', () => {
    // Group 1
    const objects: CanvasObject[] = [
      { id: 'A1', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      { id: 'A2', bounds: { minX: 12, minY: 0, maxX: 22, maxY: 10 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      // Group 2 (far away)
      { id: 'B1', bounds: { minX: 100, minY: 100, maxX: 110, maxY: 110 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
      { id: 'B2', bounds: { minX: 112, minY: 100, maxX: 122, maxY: 110 }, type: 'stroke', color: '#000', width: 1, points: [], timestamp: 0 } as any,
    ];

    const resultGroup1 = extractContext(objects, { ids: ['A1'] }, 100);
    expect(resultGroup1.objectIds.length).toBe(2);
    expect(resultGroup1.objectIds).toContain('A1');
    expect(resultGroup1.objectIds).toContain('A2');
    expect(resultGroup1.bounds).toEqual({ minX: 0, minY: 0, maxX: 22, maxY: 10 });
    
    const resultGroup2 = extractContext(objects, { ids: ['B2'] }, 100);
    expect(resultGroup2.objectIds.length).toBe(2);
    expect(resultGroup2.objectIds).toContain('B1');
    expect(resultGroup2.objectIds).toContain('B2');
    expect(resultGroup2.bounds).toEqual({ minX: 100, minY: 100, maxX: 122, maxY: 110 });
  });
});
