import { describe, it, expect } from 'vitest';
import { extractContext } from '../../src/context-extraction/extractor.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

// Mock CanvasObject that also includes a timestamp for testing purposes
interface TestObject extends CanvasObject {
  timestamp?: number;
}

const obj1: TestObject = {
  id: 'obj-1',
  type: 'stroke',
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  timestamp: 1000
};

const obj2: TestObject = {
  id: 'obj-2',
  type: 'text',
  bounds: { minX: 20, minY: 20, maxX: 40, maxY: 40 },
  timestamp: 5000
};

const obj3: TestObject = {
  id: 'obj-3',
  type: 'stroke',
  bounds: { minX: 100, minY: 100, maxX: 150, maxY: 150 },
  timestamp: 15000
};

describe('Context Extraction Strategies', () => {
  it('selection present -> strategy is "selection", bounds match selection exactly', () => {
    const objects = [obj1, obj2, obj3];
    const selection = { ids: ['obj-1', 'obj-2'] };
    const now = 20000;

    const result = extractContext(objects, selection, now);

    expect(result.strategy).toBe('selection');
    expect(result.objectIds).toEqual(['obj-1', 'obj-2']);
    expect(result.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 40,
      maxY: 40
    });
  });

  it('no selection, recent objects exist -> strategy is "recent", excludes objects outside time window', () => {
    const objects = [obj1, obj2, obj3];
    // 10s window (10000ms). now is 12000.
    // obj1 (1000) is outside (11000ms ago)
    // obj2 (5000) is within (7000ms ago)
    // obj3 (15000) is in the future, should be included technically, or within 10s if we say now-timestamp <= 10000. 12000 - 15000 = -3000 <= 10000, so included. Let's adjust 'now' to 14000.
    // At now=14000:
    // obj1 (1000) -> 13000ms ago (excluded)
    // obj2 (5000) -> 9000ms ago (included)
    // obj3 (15000) -> -1000ms ago (included, assuming tests could have slightly newer timestamps or we just keep it simple)
    const now = 14000;
    
    const result = extractContext(objects, null, now);

    expect(result.strategy).toBe('recent');
    expect(result.objectIds).toEqual(['obj-2', 'obj-3']);
    expect(result.bounds).toEqual({
      minX: 20,
      minY: 20,
      maxX: 150,
      maxY: 150
    });
  });

  it('no selection and no recent objects -> returns sensible empty/null-bounds result', () => {
    const objects = [obj1, obj2];
    const now = 20000; // Both obj1 and obj2 are > 10s old

    const result = extractContext(objects, null, now);

    expect(result.strategy).toBe('none');
    expect(result.objectIds).toEqual([]);
    expect(result.bounds).toBeNull();
    expect(result.confidence.level).toBe('low');
    expect(result.confidence.reasons).toContain('No context found');
    expect(result.expanded).toBe(false);
  });

  it('cluster expansion pulls in a nearby object but not a far one', () => {
    // Threshold is 5.
    const centerObj: TestObject = {
      id: 'center', type: 'stroke',
      bounds: { minX: 100, minY: 100, maxX: 110, maxY: 110 },
      timestamp: 20000 // recent
    };
    const nearbyObj: TestObject = {
      id: 'nearby', type: 'text',
      bounds: { minX: 112, minY: 100, maxX: 120, maxY: 110 }, // 2px away (112 - 110 = 2) <= 5
      timestamp: 0 // very old, won't be picked up by recent strategy
    };
    const farObj: TestObject = {
      id: 'far', type: 'image',
      bounds: { minX: 150, minY: 100, maxX: 160, maxY: 110 }, // 40px away, > 5
      timestamp: 0
    };

    const objects = [centerObj, nearbyObj, farObj];
    const now = 20000;

    const result = extractContext(objects, null, now); // uses recent strategy

    expect(result.strategy).toBe('recent');
    expect(result.expanded).toBe(true);
    // Should include center and nearby, but not far
    expect(result.objectIds.sort()).toEqual(['center', 'nearby'].sort());
    expect(result.bounds).toEqual({
      minX: 100,
      minY: 100,
      maxX: 120,
      maxY: 110
    });
  });

  it('expansion cap prevents runaway growth on a dense synthetic scene', () => {
    // Create a chain of objects, each 2px apart.
    // If cap is 5, it should only expand 5 times.
    const objects: TestObject[] = [];
    
    // First object is recent
    objects.push({
      id: 'chain-0', type: 'stroke',
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      timestamp: 20000
    });

    // Add 10 more objects in a chain
    for (let i = 1; i <= 10; i++) {
      objects.push({
        id: `chain-${i}`, type: 'stroke',
        bounds: { minX: i * 12, minY: 0, maxX: i * 12 + 10, maxY: 10 },
        timestamp: 0 // old
      });
    }

    const now = 20000;
    const result = extractContext(objects, null, now);
    
    // It starts with 'chain-0'.
    // Iteration 1 pulls in 'chain-1' (minX: 12, maxX: 22), bounds become minX: 0, maxX: 22
    // Iteration 2 pulls in 'chain-2' (minX: 24, maxX: 34), bounds become minX: 0, maxX: 34
    // Iteration 3 pulls in 'chain-3' ... maxX: 46
    // Iteration 4 pulls in 'chain-4' ... maxX: 58
    // Iteration 5 pulls in 'chain-5' ... maxX: 70
    // Then cap is hit. So total 6 objects (chain-0 to chain-5).
    expect(result.expanded).toBe(true);
    expect(result.objectIds.length).toBe(6);
    expect(result.objectIds.includes('chain-5')).toBe(true);
    expect(result.objectIds.includes('chain-6')).toBe(false);
  });

  it('confidence is "high" for a clean, real selection', () => {
    const objects = [obj1, obj2];
    const selection = { ids: ['obj-1'] };
    const result = extractContext(objects, selection, Date.now());
    
    expect(result.confidence.level).toBe('high');
    expect(result.confidence.reasons.length).toBeGreaterThan(0);
    expect(result.confidence.reasons).toContain('Extraction derived from explicit user selection');
  });

  it('confidence is "low" for a sparse, heavily-expanded recent-fallback case', () => {
    // Only 1 object (sparse), and it causes an expansion (so expanded is true)
    const objects: TestObject[] = [
      { id: '1', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, timestamp: 20000 },
      { id: '2', type: 'stroke', bounds: { minX: 12, minY: 0, maxX: 20, maxY: 10 }, timestamp: 0 },
    ];
    // Uses recent fallback, then expands to include '2'
    const result = extractContext(objects, null, 20000);
    
    expect(result.strategy).toBe('recent');
    expect(result.expanded).toBe(true);
    // Sparse (2 objects <= 5), recent (20 - 10 = 10, plus 10 = 20 score). 20 means 'medium' or 'low'?
    // Wait, recent (20) + sparse (10) = 30. But expanded (-10) = 20.
    // Score 20 is < 30, so level is 'low'.
    expect(result.confidence.level).toBe('low');
    expect(result.confidence.reasons).toContain('Extraction derived from recent activity fallback');
    expect(result.confidence.reasons).toContain('Context contains some objects');
    expect(result.confidence.reasons).toContain('Cluster expansion required (confidence reduced due to distance)');
  });
});
