import type { PointerSample } from '../hooks/usePointerEvents.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import type { CanvasObject, Serializable } from './canvas-object.ts';

export interface Stroke extends CanvasObject, Serializable {
  type: 'stroke';
  points: PointerSample[];
  timestamp: number;
  width: number;
  color: string;
}

export class StrokeBuilder {
  private id: string;
  private width: number;
  private color: string;
  private timestamp: number;
  
  private points: PointerSample[] = [];
  private bounds: BoundingBox | null = null;

  constructor(id: string, width: number, color: string, timestamp: number) {
    this.id = id;
    this.width = width;
    this.color = color;
    this.timestamp = timestamp;
  }

  addPoint(point: PointerSample): void {
    this.points.push(point);
    
    const radius = this.width / 2;
    const ptMinX = point.x - radius;
    const ptMaxX = point.x + radius;
    const ptMinY = point.y - radius;
    const ptMaxY = point.y + radius;

    if (!this.bounds) {
      this.bounds = {
        minX: ptMinX,
        minY: ptMinY,
        maxX: ptMaxX,
        maxY: ptMaxY
      };
    } else {
      this.bounds.minX = Math.min(this.bounds.minX, ptMinX);
      this.bounds.minY = Math.min(this.bounds.minY, ptMinY);
      this.bounds.maxX = Math.max(this.bounds.maxX, ptMaxX);
      this.bounds.maxY = Math.max(this.bounds.maxY, ptMaxY);
    }
  }

  build(): Stroke {
    if (!this.bounds) {
      throw new Error("Cannot build a stroke with no points");
    }
    
    const stroke = {
      id: this.id,
      type: 'stroke' as const,
      points: [...this.points],
      timestamp: this.timestamp,
      width: this.width,
      color: this.color,
      bounds: { ...this.bounds }
    };

    Object.defineProperty(stroke, 'toAIPayload', {
      value: () => ({ kind: 'image', data: '' }),
      enumerable: false,
      writable: true,
      configurable: true
    });

    return stroke as Stroke;
  }
}
