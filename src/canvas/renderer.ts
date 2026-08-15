import { worldToScreen, type Viewport } from './coordinates.ts';
import type { Stroke } from '../objects/stroke.ts';
import type { ImageObject } from '../objects/image.ts';
import type { TextObject } from '../objects/text.ts';
import type { Table } from '../objects/table.ts';
import type { EquationObject } from '../objects/equation.ts';
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
      textY += lineHeight;
    } else if (line) {
      // Just advance textY even if clipped
      textY += lineHeight;
    }
    
    // Draw table if present
    if (draft.data.table && draft.data.table.length > 0 && textY <= y + h - padding) {
      textY += 4; // spacing
      const rows = draft.data.table.length;
      const cols = draft.data.table[0].length || 1;
      const cellW = Math.max((w - padding * 2) / cols, 20);
      const cellH = 20;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = x + padding + c * cellW;
          const cy = textY + r * cellH;
          if (cy + cellH > y + h - padding) break; // Don't overflow draft card
          
          ctx.strokeRect(cx, cy, cellW, cellH);
          ctx.fillStyle = r === 0 ? '#f1f5f9' : '#ffffff';
          ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);

          ctx.fillStyle = '#333';
          ctx.font = r === 0 ? 'bold 10px sans-serif' : '10px sans-serif';
          ctx.textBaseline = 'middle';
          const cellText = draft.data.table[r][c] || '';
          ctx.fillText(cellText, cx + 4, cy + cellH / 2, cellW - 8);
        }
      }
      textY += rows * cellH + 4;
    }

    // Draw latex placeholder if present (actual latex is complex to draw synchronously here)
    if (draft.data.latex && textY <= y + h - padding) {
      textY += 4;
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(x + padding, textY, w - padding * 2, 24);
      ctx.strokeStyle = '#dee2e6';
      ctx.strokeRect(x + padding, textY, w - padding * 2, 24);
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'italic 11px serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('LaTeX Formula', x + padding + 4, textY + 12);
      textY += 28;
    }
  }
}

/** Renders text objects as labelled boxes with word-wrapped text. */
export function renderTextObjects(ctx: CanvasRenderingContext2D, texts: TextObject[], viewport: Viewport) {
  for (const textObj of texts) {
    const topLeft = worldToScreen({ x: textObj.bounds.minX, y: textObj.bounds.minY }, viewport);
    const bottomRight = worldToScreen({ x: textObj.bounds.maxX, y: textObj.bounds.maxY }, viewport);

    const x = topLeft.x;
    const y = topLeft.y;
    const w = Math.max(bottomRight.x - topLeft.x, 100);
    const h = Math.max(bottomRight.y - topLeft.y, 40);

    // Background
    ctx.fillStyle = '#fffde7';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f9a825';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = '#f9a825';
    ctx.fillRect(x, y, w, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Text', x + 4, y + 8);

    // Word-wrapped body text
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    const padding = 4;
    const lineHeight = 15;
    const maxW = w - padding * 2;
    const words = textObj.text.split(' ');
    let line = '';
    let textY = y + 16 + padding;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x + padding, textY);
        line = word;
        textY += lineHeight;
        if (textY > y + h - padding) break;
      } else {
        line = test;
      }
    }
    if (line && textY <= y + h - padding) {
      ctx.fillText(line, x + padding, textY);
    }
  }
}

/** Renders table objects as a grid of cells. */
export function renderTableObjects(ctx: CanvasRenderingContext2D, tables: Table[], viewport: Viewport) {
  for (const table of tables) {
    const topLeft = worldToScreen({ x: table.bounds.minX, y: table.bounds.minY }, viewport);
    const bottomRight = worldToScreen({ x: table.bounds.maxX, y: table.bounds.maxY }, viewport);

    const x = topLeft.x;
    const y = topLeft.y;
    const rows = table.cells.length;
    const cols = table.cells[0]?.length || 1;
    const cellW = Math.max((bottomRight.x - topLeft.x) / cols, 40);
    const cellH = Math.max((bottomRight.y - topLeft.y) / rows, 24);
    const w = cellW * cols;
    const h = cellH * rows;

    // Background
    ctx.fillStyle = '#e8f5e9';
    ctx.fillRect(x, y, w, h);

    // Grid lines and cell text
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#333';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + c * cellW;
        const cy = y + r * cellH;
        ctx.strokeRect(cx, cy, cellW, cellH);
        const cellText = table.cells[r]?.[c] || '';
        ctx.fillText(cellText, cx + 4, cy + cellH / 2, cellW - 8);
      }
    }
  }
}

import katex from 'katex';

const equationCache = new Map<string, HTMLImageElement>();

/** Renders equation objects showing LaTeX source. */
export function renderEquationObjects(ctx: CanvasRenderingContext2D, equations: EquationObject[], viewport: Viewport) {
  for (const eq of equations) {
    const topLeft = worldToScreen({ x: eq.bounds.minX, y: eq.bounds.minY }, viewport);
    const bottomRight = worldToScreen({ x: eq.bounds.maxX, y: eq.bounds.maxY }, viewport);

    const x = topLeft.x;
    const y = topLeft.y;
    const w = Math.max(bottomRight.x - topLeft.x, 100);
    const h = Math.max(bottomRight.y - topLeft.y, 40);

    let img = equationCache.get(eq.latex);
    if (!img) {
      let html = '';
      try {
        html = katex.renderToString(eq.latex, { throwOnError: false });
      } catch (err) {
        html = `<span style="color:red">Error</span>`;
      }

      // We must embed KaTeX styles inside the SVG so it renders correctly
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 16px; padding: 4px; display: flex; align-items: center; justify-content: center; height: 100%; box-sizing: border-box;">
              <!-- Injecting basic KaTeX CSS to ensure math renders reasonably without external stylesheet requests failing in data URIs -->
              <style>
                .katex { font-family: KaTeX_Main, 'Times New Roman', serif; line-height: 1.2; text-rendering: auto; font-size: 1.1em; }
                .katex .mathdefault { font-family: KaTeX_Math, italic; }
              </style>
              ${html}
            </div>
          </foreignObject>
        </svg>
      `;

      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
      img = new Image();
      img.src = dataUrl;
      equationCache.set(eq.latex, img);
      
      img.onload = () => {
        window.dispatchEvent(new CustomEvent('force-render'));
      };
    }

    if (img.complete) {
      ctx.drawImage(img, x, y, w, h);
    } else {
      // Background placeholder while loading
      ctx.fillStyle = '#f3e5f5';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ab47bc';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#ab47bc';
      ctx.font = 'italic 12px serif';
      ctx.fillText('Rendering...', x + 8, y + h / 2);
    }
  }
}

// Cache loaded HTMLImageElements so we can draw them synchronously in the render loop
const imageCache = new Map<string, HTMLImageElement>();

/** Renders image objects by drawing their dataUrl. */
export function renderImageObjects(ctx: CanvasRenderingContext2D, images: ImageObject[], viewport: Viewport) {
  for (const imgObj of images) {
    const topLeft = worldToScreen({ x: imgObj.bounds.minX, y: imgObj.bounds.minY }, viewport);
    const bottomRight = worldToScreen({ x: imgObj.bounds.maxX, y: imgObj.bounds.maxY }, viewport);

    const x = topLeft.x;
    const y = topLeft.y;
    const w = Math.max(bottomRight.x - topLeft.x, 60);
    const h = Math.max(bottomRight.y - topLeft.y, 60);

    let img = imageCache.get(imgObj.dataUrl);
    if (!img) {
      img = new Image();
      img.src = imgObj.dataUrl;
      imageCache.set(imgObj.dataUrl, img);
      
      // When it finishes loading, trigger a re-render
      img.onload = () => {
        window.dispatchEvent(new CustomEvent('force-render'));
      };
    }

    if (img.complete) {
      // Image is loaded, draw it
      ctx.drawImage(img, x, y, w, h);
      
      // Optional subtle border
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    } else {
      // Placeholder while loading
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading...', x + w / 2 - 25, y + h / 2);
    }
  }
}

export async function renderCrop(objects: CanvasObject[], bounds: BoundingBox, targetResolution: number = 1024): Promise<string> {
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  
  const scale = targetResolution / Math.max(worldWidth, worldHeight);
  
  const width = Math.round(worldWidth * scale);
  const height = Math.round(worldHeight * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const viewport: Viewport = {
    offsetX: -bounds.minX,
    offsetY: -bounds.minY,
    zoom: scale
  };

  const strokes: Stroke[] = [];
  const images: ImageObject[] = [];

  const texts = objects.filter(o => o.type === 'text' && boxesIntersect(o.bounds, bounds)) as any[];
  const tables = objects.filter(o => o.type === 'table' && boxesIntersect(o.bounds, bounds)) as any[];
  const equations = objects.filter(o => o.type === 'equation' && boxesIntersect(o.bounds, bounds)) as any[];

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

  // Draw structured objects so they appear in the AI crop
  if (texts.length > 0) renderTextObjects(ctx, texts, viewport);
  if (tables.length > 0) renderTableObjects(ctx, tables, viewport);
  if (equations.length > 0) renderEquationObjects(ctx, equations, viewport);

  // Await all images
  const imagePromises = images.map(imgObj => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const x = imgObj.bounds.minX * viewport.zoom + viewport.offsetX;
        const y = imgObj.bounds.minY * viewport.zoom + viewport.offsetY;
        const w = (imgObj.bounds.maxX - imgObj.bounds.minX) * viewport.zoom;
        const h = (imgObj.bounds.maxY - imgObj.bounds.minY) * viewport.zoom;
        ctx.drawImage(img, x, y, w, h);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imgObj.dataUrl;
    });
  });

  await Promise.all(imagePromises);

  return canvas.toDataURL('image/png');
}
