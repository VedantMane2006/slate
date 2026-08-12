import { describe, it, expect } from 'vitest';
import { serializeCanvas, deserializeCanvas } from '../../src/persistence/serialization.ts';
import type { Stroke } from '../../src/objects/stroke.ts';
import { createTable } from '../../src/objects/table.ts';
import { createText } from '../../src/objects/text.ts';
import { createImage } from '../../src/objects/image.ts';
import { createEquation } from '../../src/objects/equation.ts';
import { createDraftObject } from '../../src/objects/draft-object.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

describe('Canvas Serialization', () => {
  const dummyBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  const stroke: Stroke = {
    id: 'stroke-1',
    type: 'stroke',
    bounds: dummyBounds,
    points: [{ x: 10, y: 10, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 12345 }],
    timestamp: 12345,
    width: 2,
    color: '#ff0000',
    toAIPayload: () => ({ kind: 'image', data: '' })
  };
  
  Object.defineProperty(stroke, 'toAIPayload', { enumerable: false });

  const table = createTable('table-1', dummyBounds, [['A1', 'B1'], ['A2', 'B2']]);
  const text = createText('text-1', dummyBounds, 'Hello World');
  const image = createImage('image-1', dummyBounds, 'data:image/png;base64,1234');
  const equation = createEquation('eq-1', dummyBounds, 'E=mc^2');
  const draft = createDraftObject('draft-1', { explanation: 'test' }, dummyBounds);

  const allObjects: CanvasObject[] = [stroke, table, text, image, equation, draft];

  describe('serializeCanvas', () => {
    it('serializes objects to JSON structures and attaches version', () => {
      const result = serializeCanvas(allObjects);
      expect(result.version).toBe('1.0.0');
      expect(result.objects.length).toBe(6);
      
      // Verify non-enumerable methods are not part of the plain object keys
      const plainStroke = result.objects[0] as any;
      expect(plainStroke.toAIPayload).toBeUndefined();
      expect(plainStroke.id).toBe('stroke-1');
      expect(plainStroke.type).toBe('stroke');
    });
  });

  describe('deserializeCanvas', () => {
    it('round-trips all object types perfectly and restores AI payload methods', () => {
      const serialized = serializeCanvas(allObjects);
      
      // Simulate real JSON stringify/parse roundtrip
      const jsonStr = JSON.stringify(serialized);
      const parsed = JSON.parse(jsonStr);

      const reconstructed = deserializeCanvas(parsed);
      expect(reconstructed.length).toBe(6);

      // Verify each object got its toAIPayload method back
      reconstructed.forEach((obj, idx) => {
        expect(obj.id).toBe(allObjects[idx].id);
        expect(obj.type).toBe(allObjects[idx].type);
        expect(obj.bounds).toEqual(allObjects[idx].bounds);
        expect(typeof (obj as any).toAIPayload).toBe('function');
      });

      // Verify specific data fields
      const rStroke = reconstructed[0] as Stroke;
      expect(rStroke.points).toEqual(stroke.points);
      expect(rStroke.color).toBe(stroke.color);

      const rTable = reconstructed[1] as any;
      expect(rTable.cells).toEqual([['A1', 'B1'], ['A2', 'B2']]);

      const rDraft = reconstructed[5] as any;
      expect(rDraft.data).toEqual({ explanation: 'test' });
    });

    it('rejects an unknown version with a clear, specific error', () => {
      expect(() => {
        deserializeCanvas({ version: '2.0.0', objects: [] });
      }).toThrowError("Unsupported canvas version: '2.0.0'. Expected '1.0.0'.");
    });

    it('rejects missing or wrong types for structural fields', () => {
      expect(() => deserializeCanvas(null)).toThrowError("Invalid serialized canvas: expected an object");
      expect(() => deserializeCanvas({ version: '1.0.0', objects: {} })).toThrowError("Invalid serialized canvas: 'objects' must be an array");
      
      expect(() => deserializeCanvas({ 
        version: '1.0.0', 
        objects: [{ type: 'text', bounds: dummyBounds }] 
      })).toThrowError("Object at index 0 is missing an 'id'");
      
      expect(() => deserializeCanvas({ 
        version: '1.0.0', 
        objects: [{ id: '1', type: 'text' }] 
      })).toThrowError("Object 1 has invalid or missing 'bounds'");

      expect(() => deserializeCanvas({ 
        version: '1.0.0', 
        objects: [{ id: '1', bounds: dummyBounds }] 
      })).toThrowError("Object 1 is missing a 'type'");
    });

    it('rejects specific malformed object types', () => {
      // Stroke missing points
      expect(() => deserializeCanvas({
        version: '1.0.0',
        objects: [{ id: 's1', type: 'stroke', bounds: dummyBounds, timestamp: 1, width: 2, color: '#000' }]
      })).toThrowError("Stroke is missing 'points' (array)");

      // Text missing text field
      expect(() => deserializeCanvas({
        version: '1.0.0',
        objects: [{ id: 't1', type: 'text', bounds: dummyBounds }]
      })).toThrowError("TextObject t1 is missing 'text' string");
      
      // Unknown type
      expect(() => deserializeCanvas({
        version: '1.0.0',
        objects: [{ id: 'u1', type: 'unknown_type', bounds: dummyBounds }]
      })).toThrowError("Object u1 has unrecognized type: 'unknown_type'");
    });
  });
});
