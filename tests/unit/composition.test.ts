// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { composeMultimodalRequest, canonicalSerialize } from '../../src/ai/composition.ts';
import type { CanvasObject, Serializable/*, AIPayloadFragment*/ } from '../../src/objects/canvas-object.ts';
import type { ExtractionResult } from '../../src/context-extraction/extractor.ts';
import type { Stroke } from '../../src/objects/stroke.ts';

// We mock renderCrop because it is already tested in renderer.test.ts
vi.mock('../../src/canvas/renderer.ts', () => ({
  renderCrop: vi.fn().mockReturnValue('mock-data-url')
}));

describe('composeMultimodalRequest', () => {
  it('correctly separates image-producing object types from fragment-producing types', async () => {
    const strokeObj: Stroke = {
      id: 'stroke-1',
      type: 'stroke',
      points: [],
      timestamp: 0,
      width: 2,
      color: 'black',
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      toAIPayload: () => ({ kind: 'image', data: '' })
    };

    interface TextObject extends CanvasObject, Serializable {
      type: 'text';
      text: string;
    }
    const textObj: TextObject = {
      id: 'text-1',
      type: 'text',
      bounds: { minX: 10, minY: 10, maxX: 20, maxY: 20 },
      text: 'hello',
      toAIPayload: () => ({ kind: 'text', data: 'hello' })
    };

    const allObjects: CanvasObject[] = [strokeObj, textObj];
    const result: ExtractionResult = {
      objectIds: ['stroke-1', 'text-1'],
      bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
      strategy: 'selection',
      confidence: { level: 'high', reasons: [] },
      expanded: false
    };

    const { payload } = await composeMultimodalRequest(result, allObjects);

    expect(payload.image).toBe('mock-data-url');
    expect(payload.fragments).toHaveLength(1);
    expect(payload.fragments[0]).toEqual({ kind: 'text', data: 'hello' });
  });

  it('a scene mixing strokes + a table + text produces a payload with one image field and correctly-typed fragments for each structured object', async () => {
    const stroke1 = { id: 's1', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } } as CanvasObject;
    const stroke2 = { id: 's2', type: 'stroke', bounds: { minX: 5, minY: 5, maxX: 10, maxY: 10 } } as CanvasObject;
    const imageObj = { id: 'img1', type: 'image', bounds: { minX: 0, minY: 0, maxX: 2, maxY: 2 } } as CanvasObject;

    const tableObj = {
      id: 't1',
      type: 'table',
      bounds: { minX: 20, minY: 20, maxX: 30, maxY: 30 },
      toAIPayload: () => ({ kind: 'json', data: { rows: [] } })
    } as unknown as CanvasObject;

    const equationObj = {
      id: 'e1',
      type: 'equation',
      bounds: { minX: 40, minY: 40, maxX: 50, maxY: 50 },
      toAIPayload: () => ({ kind: 'text', data: '\\sum x' })
    } as unknown as CanvasObject;

    const allObjects = [stroke1, stroke2, imageObj, tableObj, equationObj];
    const result: ExtractionResult = {
      objectIds: ['s1', 's2', 'img1', 't1', 'e1'],
      bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      strategy: 'recent',
      confidence: { level: 'medium', reasons: [] },
      expanded: false
    };

    const { payload } = await composeMultimodalRequest(result, allObjects);

    expect(payload.image).toBe('mock-data-url');
    expect(payload.fragments).toHaveLength(2);

    const payloadTypes = payload.fragments.map(f => f.kind);
    expect(payloadTypes).toContain('json');
    expect(payloadTypes).toContain('text');
  });
});

describe('canonicalSerialize', () => {
  it('is deterministic (same input called twice -> identical string)', () => {
    const stroke1 = { id: 's1', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } } as CanvasObject;
    const stroke2 = { id: 's2', type: 'stroke', bounds: { minX: 5, minY: 5, maxX: 10, maxY: 10 } } as CanvasObject;
    const allObjects = [stroke1, stroke2];
    const result: ExtractionResult = {
      objectIds: ['s1', 's2'],
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      strategy: 'recent',
      confidence: { level: 'medium', reasons: [] },
      expanded: false
    };

    const firstCall = canonicalSerialize(result, allObjects);
    const secondCall = canonicalSerialize(result, allObjects);

    expect(firstCall).toBe(secondCall);
  });

  it('changes when object data changes (e.g. one stroke moved)', () => {
    const stroke1 = { id: 's1', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } } as CanvasObject;
    const allObjects1 = [stroke1];

    // Create a modified copy (e.g., moved stroke)
    const stroke1Moved = { id: 's1', type: 'stroke', bounds: { minX: 10, minY: 10, maxX: 15, maxY: 15 } } as CanvasObject;
    const allObjects2 = [stroke1Moved];

    const result: ExtractionResult = {
      objectIds: ['s1'],
      bounds: { minX: 0, minY: 0, maxX: 15, maxY: 15 },
      strategy: 'selection',
      confidence: { level: 'high', reasons: [] },
      expanded: false
    };

    const firstCall = canonicalSerialize(result, allObjects1);
    const secondCall = canonicalSerialize(result, allObjects2);

    expect(firstCall).not.toBe(secondCall);
  });

  it('is stable regardless of object array ordering (sorting by ID makes this true)', () => {
    const stroke1 = { id: 'a-stroke', type: 'stroke', bounds: { minX: 0, minY: 0, maxX: 5, maxY: 5 } } as CanvasObject;
    const stroke2 = { id: 'z-stroke', type: 'stroke', bounds: { minX: 5, minY: 5, maxX: 10, maxY: 10 } } as CanvasObject;
    const stroke3 = { id: 'm-stroke', type: 'stroke', bounds: { minX: 15, minY: 15, maxX: 20, maxY: 20 } } as CanvasObject;

    const allObjectsOrder1 = [stroke1, stroke2, stroke3];
    const allObjectsOrder2 = [stroke3, stroke2, stroke1];
    const allObjectsOrder3 = [stroke2, stroke1, stroke3];

    const result: ExtractionResult = {
      objectIds: ['a-stroke', 'z-stroke', 'm-stroke'],
      bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
      strategy: 'selection',
      confidence: { level: 'high', reasons: [] },
      expanded: false
    };

    const hash1 = canonicalSerialize(result, allObjectsOrder1);
    const hash2 = canonicalSerialize(result, allObjectsOrder2);
    const hash3 = canonicalSerialize(result, allObjectsOrder3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });
});
