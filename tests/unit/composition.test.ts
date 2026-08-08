// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { composeMultimodalRequest } from '../../src/ai/composition.ts';
import type { CanvasObject, Serializable, AIPayloadFragment } from '../../src/objects/canvas-object.ts';
import type { ExtractionResult } from '../../src/context-extraction/extractor.ts';
import type { Stroke } from '../../src/objects/stroke.ts';

// We mock renderCrop because it is already tested in renderer.test.ts
vi.mock('../../src/canvas/renderer.ts', () => ({
  renderCrop: vi.fn().mockReturnValue('mock-data-url')
}));

describe('composeMultimodalRequest', () => {
  it('correctly separates image-producing object types from fragment-producing types', () => {
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

    const payload = composeMultimodalRequest(result, allObjects);
    
    expect(payload.image).toBe('mock-data-url');
    expect(payload.fragments).toHaveLength(1);
    expect(payload.fragments[0]).toEqual({ kind: 'text', data: 'hello' });
  });

  it('a scene mixing strokes + a table + text produces a payload with one image field and correctly-typed fragments for each structured object', () => {
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

    const payload = composeMultimodalRequest(result, allObjects);
    
    expect(payload.image).toBe('mock-data-url');
    expect(payload.fragments).toHaveLength(2);
    
    const payloadTypes = payload.fragments.map(f => f.kind);
    expect(payloadTypes).toContain('json');
    expect(payloadTypes).toContain('text');
  });
});
