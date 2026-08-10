import { worldToScreen, type Viewport } from './coordinates.ts';
import type { Stroke } from '../objects/stroke.ts';
import type { ImageObject } from '../objects/image.ts';
import type { DraftObject } from '../objects/draft-object.ts';
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

/** Renders draft objects as labelled cards at their world-space bounds. */
export function renderDraftObjects(ctx: CanvasRenderingContext2D, drafts: DraftObject[], viewport: Viewport) {
  for (const draft of drafts) {
    const topLeft = worldToScreen({ x: draft.bounds.minX, y: draft.bounds.minY }, viewport);
    const bottomRight = worldToScreen({ x: draft.bounds.maxX, y: draft.bounds.maxY }, viewport);

    const x = topLeft.x;
    const y = topLeft.y;
    const w = Math.max(bottomRight.x - topLeft.x, 120);
    const h = Math.max(bottomRight.y - topLeft.y, 60);
    const radius = 6;

    // Rounded rectangle background
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();

    ctx.fillStyle = '#eef6ff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Header bar
    const headerH = 22;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, y, w, headerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI Draft', x + 8, y + headerH / 2);

    // Explanation text (word-wrapped)
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    const text = draft.data.explanation;
    const padding = 8;
    const maxTextWidth = w - padding * 2;
    const lineHeight = 16;
    const words = text.split(' ');
    let line = '';
    let textY = y + headerH + padding;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextWidth && line) {
        ctx.fillText(line, x + padding, textY);
        line = word;
        textY += lineHeight;
        if (textY > y + h - padding) break; // stop if overflowing
      } else {
        line = testLine;
      }
    }
    if (line && textY <= y + h - padding) {
      ctx.fillText(line, x + padding, textY);
    }
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
