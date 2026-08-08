import { describe, it, expect } from 'vitest';
import { zoomAtPoint, screenToWorld, type Viewport, type ScreenPoint } from '../../src/canvas/coordinates.ts';

describe('zoomAtPoint', () => {
  it('keeps the cursor world point fixed after zoom in', () => {
    const viewport: Viewport = { offsetX: 100, offsetY: 50, zoom: 1 };
    const cursor: ScreenPoint = { x: 400, y: 300 };

    const worldBefore = screenToWorld(cursor, viewport);
    const newViewport = zoomAtPoint(viewport, cursor, 1.5);
    const worldAfter = screenToWorld(cursor, newViewport);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('keeps the cursor world point fixed after zoom out', () => {
    const viewport: Viewport = { offsetX: -200, offsetY: 300, zoom: 2 };
    const cursor: ScreenPoint = { x: 960, y: 540 };

    const worldBefore = screenToWorld(cursor, viewport);
    const newViewport = zoomAtPoint(viewport, cursor, 0.5);
    const worldAfter = screenToWorld(cursor, newViewport);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('preserves cursor world point across multiple zoom steps', () => {
    let viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const cursor: ScreenPoint = { x: 500, y: 400 };
    const worldOriginal = screenToWorld(cursor, viewport);

    for (let i = 0; i < 5; i++) {
      viewport = zoomAtPoint(viewport, cursor, 1.1);
    }
    for (let i = 0; i < 5; i++) {
      viewport = zoomAtPoint(viewport, cursor, 1 / 1.1);
    }

    const worldFinal = screenToWorld(cursor, viewport);
    expect(worldFinal.x).toBeCloseTo(worldOriginal.x, 6);
    expect(worldFinal.y).toBeCloseTo(worldOriginal.y, 6);
  });

  it('clamps zoom to minimum bound', () => {
    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 0.1 };
    const cursor: ScreenPoint = { x: 500, y: 500 };
    const result = zoomAtPoint(viewport, cursor, 0.01);
    expect(result.zoom).toBeGreaterThanOrEqual(0.05);
  });

  it('clamps zoom to maximum bound', () => {
    const viewport: Viewport = { offsetX: 0, offsetY: 0, zoom: 15 };
    const cursor: ScreenPoint = { x: 500, y: 500 };
    const result = zoomAtPoint(viewport, cursor, 100);
    expect(result.zoom).toBeLessThanOrEqual(20);
  });

  it('anchoring holds for different cursor positions', () => {
    const viewport: Viewport = { offsetX: 42, offsetY: -17, zoom: 1.5 };
    const cursors: ScreenPoint[] = [
      { x: 0, y: 0 },
      { x: 1920, y: 1080 },
      { x: 960, y: 540 },
      { x: -100, y: 200 },
    ];
    for (const cursor of cursors) {
      const worldBefore = screenToWorld(cursor, viewport);
      const newViewport = zoomAtPoint(viewport, cursor, 2);
      const worldAfter = screenToWorld(cursor, newViewport);
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
    }
  });
});
