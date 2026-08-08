import type { BoundingBox } from '../utils/geometry.ts';
import type { CanvasObject, Serializable, AIPayloadFragment } from './canvas-object.ts';

export interface TextObject extends CanvasObject, Serializable {
  type: 'text';
  text: string;
}

export function createText(
  id: string,
  bounds: BoundingBox,
  text: string
): TextObject {
  const textObj = {
    id,
    type: 'text' as const,
    bounds: { ...bounds },
    text
  };

  Object.defineProperty(textObj, 'toAIPayload', {
    value: function (): AIPayloadFragment {
      return {
        kind: 'text',
        data: this.text
      };
    },
    enumerable: false,
    writable: true,
    configurable: true
  });

  return textObj as TextObject;
}
