import type { CanvasObject } from '../objects/canvas-object.ts';
import { createDraftObject } from '../objects/draft-object.ts';
import { createEquation } from '../objects/equation.ts';
import { createImage } from '../objects/image.ts';
import { createTable } from '../objects/table.ts';
import { createText } from '../objects/text.ts';
import type { Stroke } from '../objects/stroke.ts';

export interface SerializedCanvas {
  version: string;
  objects: unknown[];
}

export function serializeCanvas(objects: CanvasObject[]): SerializedCanvas {
  // The objects are already pure data (with non-enumerable toAIPayload methods),
  // so we can serialize them exactly as they are.
  // We map them to ensure we strip out any runtime state that might have been accidentally added,
  // but JSON.stringify (which the caller will likely use) naturally ignores non-enumerables.
  // For serialization itself, we just return the array.
  return {
    version: '1.0.0',
    objects: objects.map(obj => ({ ...obj }))
  };
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function validateBounds(val: unknown): val is CanvasObject['bounds'] {
  if (!isObject(val)) return false;
  return typeof val.minX === 'number' &&
         typeof val.minY === 'number' &&
         typeof val.maxX === 'number' &&
         typeof val.maxY === 'number';
}

function reconstructStroke(data: Record<string, unknown>): Stroke {
  if (typeof data.timestamp !== 'number') throw new Error("Stroke is missing 'timestamp' (number)");
  if (typeof data.width !== 'number') throw new Error("Stroke is missing 'width' (number)");
  if (typeof data.color !== 'string') throw new Error("Stroke is missing 'color' (string)");
  if (!Array.isArray(data.points)) throw new Error("Stroke is missing 'points' (array)");
  
  // Basic point validation
  for (const pt of data.points) {
    if (!isObject(pt) || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
      throw new Error("Stroke 'points' array contains invalid point data");
    }
  }

  const stroke = {
    id: data.id as string,
    type: 'stroke' as const,
    bounds: data.bounds as CanvasObject['bounds'],
    timestamp: data.timestamp,
    width: data.width,
    color: data.color,
    points: data.points as Stroke['points']
  } as unknown as Stroke;

  Object.defineProperty(stroke, 'toAIPayload', {
    value: () => ({ kind: 'image', data: '' }),
    enumerable: false,
    writable: true,
    configurable: true
  });

  return stroke;
}

export function deserializeCanvas(json: unknown): CanvasObject[] {
  if (!isObject(json)) {
    throw new Error("Invalid serialized canvas: expected an object");
  }

  if (json.version !== '1.0.0') {
    throw new Error(`Unsupported canvas version: '${json.version}'. Expected '1.0.0'.`);
  }

  if (!Array.isArray(json.objects)) {
    throw new Error("Invalid serialized canvas: 'objects' must be an array");
  }

  const result: CanvasObject[] = [];

  for (let i = 0; i < json.objects.length; i++) {
    const raw = json.objects[i];
    if (!isObject(raw)) {
      throw new Error(`Object at index ${i} is not a valid JSON object`);
    }

    if (typeof raw.id !== 'string') {
      throw new Error(`Object at index ${i} is missing an 'id' (string)`);
    }

    if (!validateBounds(raw.bounds)) {
      throw new Error(`Object ${raw.id} has invalid or missing 'bounds'`);
    }

    const type = raw.type;
    if (typeof type !== 'string') {
      throw new Error(`Object ${raw.id} is missing a 'type' (string)`);
    }

    switch (type) {
      case 'stroke':
        result.push(reconstructStroke(raw));
        break;
      case 'table':
        if (!Array.isArray(raw.cells)) throw new Error(`Table ${raw.id} is missing 'cells' array`);
        result.push(createTable(raw.id, raw.bounds, raw.cells as string[][]));
        break;
      case 'text':
        if (typeof raw.text !== 'string') throw new Error(`TextObject ${raw.id} is missing 'text' string`);
        result.push(createText(raw.id, raw.bounds, raw.text));
        break;
      case 'image':
        if (typeof raw.dataUrl !== 'string') throw new Error(`ImageObject ${raw.id} is missing 'dataUrl' string`);
        result.push(createImage(raw.id, raw.bounds, raw.dataUrl));
        break;
      case 'equation':
        if (typeof raw.latex !== 'string') throw new Error(`EquationObject ${raw.id} is missing 'latex' string`);
        result.push(createEquation(raw.id, raw.bounds, raw.latex));
        break;
      case 'draft':
        if (!isObject(raw.data)) throw new Error(`DraftObject ${raw.id} is missing 'data' object`);
        // AIOutputSchema is flexible but requires arrays for certain things. 
        // We do a light check, but assume it matches the schema since it was valid when serialized.
        result.push(createDraftObject(raw.id, raw.data as any, raw.bounds));
        break;
      default:
        throw new Error(`Object ${raw.id} has unrecognized type: '${type}'`);
    }
  }

  return result;
}
