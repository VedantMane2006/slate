import { describe, it, expect } from 'vitest';
import { extractContext } from '../../src/context-extraction/extractor.ts';
import { traceWriter } from '../../src/metrics/trace-writer.ts';
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

import { beforeEach } from 'vitest';

describe('Context Extraction Strategies', () => {
  beforeEach(() => {
    traceWriter.clear();
  });
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

  it('true connected-component clustering groups all intersecting/nearby objects in a dense chain', () => {
    // Create a chain of objects, each 2px apart.
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
    
    // Since Phase 11 implemented true Union-Find clustering without an arbitrary cap,
    // it should successfully group all 11 objects in this connected chain.
    expect(result.expanded).toBe(true);
    expect(result.objectIds.length).toBe(11);
    expect(result.objectIds.includes('chain-10')).toBe(true);
  });

  it('confidence is "high" for a real, dense, non-expanded selection', () => {
    // We need objectCount >= 30, inkDensity >= 0.4, area > 100, strategy = 'selection', expanded = false
    const objects: TestObject[] = [];
    for (let i = 0; i < 35; i++) {
      // 35 overlapping objects of 10x10 -> area is 100 per object.
      // But bounds will be [0,0] to [10,10], area = 100.
      // Wait, area must be > 100 to clear the TRIVIAL_AREA_FLOOR (<=100 is low).
      // Let's use 20x20 -> area 400.
      objects.push({
        id: `dense-${i}`,
        type: 'stroke',
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        timestamp: Date.now()
      });
    }
    const selection = { ids: objects.map(o => o.id) };
    const result = extractContext(objects, selection, Date.now());
    
    expect(result.confidence.level).toBe('high');
    expect(result.confidence.reasons).toContain('explicit selection with rich content and no expansion needed');
  });

  it('confidence is "low" for a trivial/near-empty scene (regression)', () => {
    // Only 2 objects, fails SPARSE_FLOOR (<= 15)
    const objects = [obj1, obj2];
    const selection = { ids: ['obj-1', 'obj-2'] };
    const result = extractContext(objects, selection, Date.now());
    
    expect(result.confidence.level).toBe('low');
    expect(result.confidence.reasons).toContain('object count below the sparse floor');
  });

  it('confidence is "medium" for a real selection with SPARSE content', () => {
    // Object count = 20 (> 15 sparse floor), area > 100, but fails RICH_DENSITY_THRESHOLD (0.4) or RICH_OBJ_THRESHOLD (30)
    // 20 objects, each 1x1 scattered, bounding box 100x100 (area=10000). Ink area = 20. Density = 20/10000 = 0.002
    // Oh wait, ink density < 0.15 is SPARSE_DENSITY_FLOOR, which triggers 'low'.
    // To clear the low floor, density must be >= 0.15.
    // 20 objects, each 10x10 (area=100). Bounding box 100x100 (area=10000). Ink area = 2000. Density = 0.2
    // object count = 20 (clears 15). area = 10000 (clears 100). density = 0.2 (clears 0.15).
    // Fails high because objectCount (20) < 30.
    const objects: TestObject[] = [];
    for (let i = 0; i < 20; i++) {
      // position objects diagonally to expand the bounding box
      objects.push({
        id: `sparse-${i}`,
        type: 'stroke',
        bounds: { minX: i*5, minY: i*5, maxX: i*5 + 10, maxY: i*5 + 10 },
        timestamp: Date.now()
      });
    }
    const selection = { ids: objects.map(o => o.id) };
    const result = extractContext(objects, selection, Date.now());
    
    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasons).toContain('cleared low floor, but content is sparse/not rich enough for high confidence');
  });

  it('confidence is "medium" for a recent-fallback with decent density', () => {
    // Clears all floors, has rich content, but uses recent-fallback instead of explicit selection
    const objects: TestObject[] = [];
    const now = Date.now();
    for (let i = 0; i < 35; i++) {
      objects.push({
        id: `recent-${i}`,
        type: 'stroke',
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
        timestamp: now // within recent window
      });
    }
    // No explicit selection
    const result = extractContext(objects, null, now);
    
    expect(result.strategy).toBe('recent');
    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.reasons).toContain('recent-fallback used instead of explicit selection');
  });

  it('calling extractContext appends a correctly-shaped trace entry to the in-memory array', () => {
    const objects = [obj1, obj2];
    const selection = { ids: ['obj-1'] };
    
    // We expect traceWriter to be empty before the call (due to beforeEach)
    expect(traceWriter.getPendingExtractions().length).toBe(0);

    const result = extractContext(objects, selection, Date.now());

    const pending = traceWriter.getPendingExtractions();
    expect(pending.length).toBe(1);
    
    const trace = pending[0];
    expect(typeof trace.timestamp).toBe('number');
    expect(trace.strategy).toBe(result.strategy);
    expect(trace.confidence).toEqual(result.confidence);
    expect(trace.objectCount).toBe(result.objectIds.length);
    expect(trace.bounds).toEqual(result.bounds);
  });
});
