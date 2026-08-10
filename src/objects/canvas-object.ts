import type { BoundingBox } from '../utils/geometry.ts';

export type CanvasObjectType = 'stroke' | 'table' | 'text' | 'image' | 'equation' | 'draft';

export interface CanvasObject {
  id: string;
  type: CanvasObjectType;
  bounds: BoundingBox;
}

export type AIPayloadFragment =
  | { kind: 'image'; data: string }
  | { kind: 'json'; data: unknown }
  | { kind: 'text'; data: string };

export interface Serializable {
  toAIPayload(): AIPayloadFragment;
}
