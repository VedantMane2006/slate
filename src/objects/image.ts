import type { BoundingBox } from '../utils/geometry.ts';
import type { CanvasObject, Serializable, AIPayloadFragment } from './canvas-object.ts';

export interface ImageObject extends CanvasObject, Serializable {
  type: 'image';
  dataUrl: string;
}

export function createImage(
  id: string,
  bounds: BoundingBox,
  dataUrl: string
): ImageObject {
  const imageObj = {
    id,
    type: 'image' as const,
    bounds: { ...bounds },
    dataUrl
  };

  Object.defineProperty(imageObj, 'toAIPayload', {
    value: function (): AIPayloadFragment {
      return {
        kind: 'image',
        data: this.dataUrl
      };
    },
    enumerable: false,
    writable: true,
    configurable: true
  });

  return imageObj as ImageObject;
}
