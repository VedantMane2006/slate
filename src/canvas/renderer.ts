import { worldToScreen, type Viewport } from './coordinates.ts';
import type { Stroke } from '../objects/stroke.ts';
import type { ImageObject } from '../objects/image.ts';
import type { CanvasObject } from '../objects/canvas-object.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import { boxesIntersect } from '../utils/geometry.ts';

export function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], viewport: Viewport) {
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * viewport.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const firstPoint = worldToScreen(stroke.points[0], viewport);
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = worldToScreen(stroke.points[i], viewport);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

export function renderCrop(objects: CanvasObject[], bounds: BoundingBox): string {
  const canvas = document.createElement('canvas');
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const viewport: Viewport = {
    offsetX: -bounds.minX,
    offsetY: -bounds.minY,
    zoom: 1
  };

  const strokes: Stroke[] = [];
  const images: ImageObject[] = [];

  for (const obj of objects) {
    if (boxesIntersect(obj.bounds, bounds)) {
      if (obj.type === 'stroke') {
        strokes.push(obj as Stroke);
      } else if (obj.type === 'image') {
        images.push(obj as ImageObject);
      }
    }
  }

  renderStrokes(ctx, strokes, viewport);

  for (const imgObj of images) {
    const img = new Image();
    img.src = imgObj.dataUrl;
    
    const x = imgObj.bounds.minX * viewport.zoom + viewport.offsetX;
    const y = imgObj.bounds.minY * viewport.zoom + viewport.offsetY;
    const w = (imgObj.bounds.maxX - imgObj.bounds.minX) * viewport.zoom;
    const h = (imgObj.bounds.maxY - imgObj.bounds.minY) * viewport.zoom;
    
    try {
      ctx.drawImage(img, x, y, w, h);
    } catch (e) {
      // Ignored for synchronous stub
    }
  }

  return canvas.toDataURL('image/png');
}
