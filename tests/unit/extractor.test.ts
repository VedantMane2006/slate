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
    expect(result.confidence.score).toBe(0.0);
  });
});
