import type { CanvasObject } from '../objects/canvas-object.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import type { Stroke } from '../objects/stroke.ts';
import type { DraftObject } from '../objects/draft-object.ts';
import type { TextObject } from '../objects/text.ts';
import type { Table } from '../objects/table.ts';
import type { EquationObject } from '../objects/equation.ts';
import type { ImageObject } from '../objects/image.ts';
import { 
  renderStrokes, 
  renderDraftObjects, 
  renderTextObjects, 
  renderTableObjects, 
  renderEquationObjects, 
  renderImageObjects 
} from '../canvas/renderer.ts';
import { unionBoundingBoxes, type BoundingBox } from '../utils/geometry.ts';

/**
 * DECISION: We export the FULL CONTENT BOUNDS rather than just the current viewport.
 * 
 * RATIONALE: 
 * 1. Users typically expect a "Save to PNG" feature to capture everything they've drawn
 *    in the document, not just what happens to be framed on screen at the moment.
 * 2. It avoids cropping off parts of objects that straddle the viewport edge.
 * 3. It's conceptually simpler to reproduce exactly what the document contains.
 */
export function exportPNG(objects: CanvasObject[], _viewport: Viewport): void {
  if (objects.length === 0) return;

  // Compute full content bounding box
  let fullBounds = objects[0].bounds;
  for (let i = 1; i < objects.length; i++) {
    fullBounds = unionBoundingBoxes(fullBounds, objects[i].bounds);
  }

  // Add a small padding around the content
  const padding = 20;
  const exportBounds: BoundingBox = {
    minX: fullBounds.minX - padding,
    minY: fullBounds.minY - padding,
    maxX: fullBounds.maxX + padding,
    maxY: fullBounds.maxY + padding,
  };

  const width = Math.max(1, exportBounds.maxX - exportBounds.minX);
  const height = Math.max(1, exportBounds.maxY - exportBounds.minY);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fill background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Create a local viewport that maps the exportBounds to the canvas perfectly (zoom = 1)
  const exportViewport: Viewport = {
    offsetX: -exportBounds.minX,
    offsetY: -exportBounds.minY,
    zoom: 1
  };

  const strokes = objects.filter((o) => o.type === 'stroke') as Stroke[];
  const drafts = objects.filter((o) => o.type === 'draft') as DraftObject[];
  const texts = objects.filter((o) => o.type === 'text') as TextObject[];
  const tables = objects.filter((o) => o.type === 'table') as Table[];
  const equations = objects.filter((o) => o.type === 'equation') as EquationObject[];
  const images = objects.filter((o) => o.type === 'image') as ImageObject[];

  renderStrokes(ctx, strokes, exportViewport);
  renderDraftObjects(ctx, drafts, exportViewport);
  renderTextObjects(ctx, texts, exportViewport);
  renderTableObjects(ctx, tables, exportViewport);
  renderEquationObjects(ctx, equations, exportViewport);
  renderImageObjects(ctx, images, exportViewport);

  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'slate-export.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
