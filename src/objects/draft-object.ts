import type { CanvasObject, Serializable, AIPayloadFragment } from './canvas-object.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import type { AIOutputSchema } from '../ai/rendering/schema.ts';

export interface DraftObject extends CanvasObject, Serializable {
  type: 'draft';
  data: AIOutputSchema;
}

export function createDraftObject(
  id: string,
  data: AIOutputSchema,
  bounds: BoundingBox
): DraftObject {
  const obj = {
    id,
    type: 'draft' as const,
    bounds,
    data
  };

  Object.defineProperty(obj, 'toAIPayload', {
    enumerable: false,
    value: function(): AIPayloadFragment {
      return {
        kind: 'json',
        data: this.data
      };
    }
  });

  return obj as DraftObject;
}
