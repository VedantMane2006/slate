import type { BoundingBox } from '../utils/geometry.ts';
import type { CanvasObject, Serializable, AIPayloadFragment } from './canvas-object.ts';

export interface Table extends CanvasObject, Serializable {
  type: 'table';
  cells: string[][];
}

export function createTable(
  id: string,
  bounds: BoundingBox,
  cells: string[][]
): Table {
  const table = {
    id,
    type: 'table' as const,
    bounds: { ...bounds },
    cells: cells.map(row => [...row])
  };

  Object.defineProperty(table, 'toAIPayload', {
    value: function (): AIPayloadFragment {
      return {
        kind: 'json',
        data: this.cells
      };
    },
    enumerable: false,
    writable: true,
    configurable: true
  });

  return table as Table;
}
