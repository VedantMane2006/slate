import type { CanvasObject, AIPayloadFragment, Serializable } from '../objects/canvas-object.ts';
import type { ExtractionResult } from '../context-extraction/extractor.ts';
import { renderCrop } from '../canvas/renderer.ts';

export interface MultimodalRequestPayload {
  image: string;
  fragments: AIPayloadFragment[];
}

export function composeMultimodalRequest(
  result: ExtractionResult,
  allObjects: CanvasObject[]
): MultimodalRequestPayload {
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
      }
    }
  }
  
  let image = '';
  if (imageObjects.length > 0 && result.bounds) {
    image = renderCrop(imageObjects, result.bounds);
  }
  
  return { image, fragments };
}
