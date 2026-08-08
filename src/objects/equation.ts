import type { BoundingBox } from '../utils/geometry.ts';
import type { CanvasObject, Serializable, AIPayloadFragment } from './canvas-object.ts';

export interface EquationObject extends CanvasObject, Serializable {
  type: 'equation';
  latex: string;
}

export function createEquation(
  id: string,
  bounds: BoundingBox,
  latex: string
): EquationObject {
  const equationObj = {
    id,
    type: 'equation' as const,
    bounds: { ...bounds },
    latex
  };

  Object.defineProperty(equationObj, 'toAIPayload', {
    value: function (): AIPayloadFragment {
      return {
        kind: 'text',
        data: this.latex
      };
    },
    enumerable: false,
    writable: true,
    configurable: true
  });

  return equationObj as EquationObject;
}
