import type { CanvasObject, AIPayloadFragment, Serializable } from '../objects/canvas-object.ts';
import type { ExtractionResult } from '../context-extraction/extractor.ts';
import { renderCrop } from '../canvas/renderer.ts';
import { chooseResolution, computeInkDensity } from '../context-extraction/resolution.ts';
import { FORCE_FIXED_RESOLUTION } from '../config/experiment.ts';

export interface MultimodalRequestPayload {
  image: string;
  fragments: AIPayloadFragment[];
}

export interface CompositionMetadata {
  resolution: number;
  inkDensity: number;
  imageObjectCount: number;
}

export async function composeMultimodalRequest(
  result: ExtractionResult,
  allObjects: CanvasObject[]
): Promise<{ payload: MultimodalRequestPayload; metadata: CompositionMetadata }> {
  const extractedObjects = allObjects.filter((obj) => result.objectIds.includes(obj.id));
  
  const imageObjects: CanvasObject[] = [];
  const fragments: AIPayloadFragment[] = [];
  
  for (const obj of extractedObjects) {
    if (obj.type === 'stroke' || obj.type === 'image') {
      imageObjects.push(obj);
    } else {
      const serializableObj = obj as unknown as Serializable;
      if (typeof serializableObj.toAIPayload === 'function') {
        fragments.push(serializableObj.toAIPayload());
      } else if (obj.type === 'text') {
        fragments.push({ kind: 'text', data: (obj as any).text });
      } else if (obj.type === 'equation') {
        fragments.push({ kind: 'text', data: (obj as any).latex });
      } else if (obj.type === 'table') {
        fragments.push({ kind: 'json', data: { rows: (obj as any).rows } });
      }
    }
  }
  
  let image = '';
  let resolution = 1024;
  let inkDensity = 0;
  if (extractedObjects.length > 0 && result.bounds) {
    inkDensity = computeInkDensity(imageObjects, result.bounds);
    resolution = FORCE_FIXED_RESOLUTION !== null
      ? FORCE_FIXED_RESOLUTION
      : chooseResolution(extractedObjects.length, inkDensity);
    image = await renderCrop(extractedObjects, result.bounds, resolution);
  }
  
  return {
    payload: { image, fragments },
    metadata: { resolution, inkDensity, imageObjectCount: imageObjects.length }
  };
}

export function canonicalSerialize(
  result: ExtractionResult,
  allObjects: CanvasObject[]
): string {
  const extractedObjects = allObjects.filter((obj) => result.objectIds.includes(obj.id));
  
  // Sort objects by ID to ensure deterministic ordering regardless of input array order
  const sortedObjects = [...extractedObjects].sort((a, b) => a.id.localeCompare(b.id));

  const payload = {
    bounds: result.bounds,
    strategy: result.strategy,
    objects: sortedObjects
  };
  
  return JSON.stringify(payload);
}
