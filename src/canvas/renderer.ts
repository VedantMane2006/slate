import { worldToScreen, type Viewport } from './coordinates.ts';
import type { Stroke } from '../objects/stroke.ts';

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
