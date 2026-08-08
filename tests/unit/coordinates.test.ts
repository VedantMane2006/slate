import { describe, it, expect } from 'vitest';
import {
  worldToScreen,
  screenToWorld,
  type Viewport,
  type WorldPoint,
} from '../../src/canvas/coordinates.ts';

/**
 * Helper: assert that a round-trip worldToScreen(screenToWorld(p)) ≈ p
 * within floating-point tolerance.
 */
function expectRoundTrip(point: WorldPoint, viewport: Viewport) {
  const screen = worldToScreen(point, viewport);
  const back = screenToWorld(screen, viewport);
  expect(back.x).toBeCloseTo(point.x, 10);
  expect(back.y).toBeCloseTo(point.y, 10);
}

describe('coordinates', () => {
  const origin: WorldPoint = { x: 0, y: 0 };

  it('identity viewport (no pan, zoom=1)', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    const s = worldToScreen({ x: 5, y: 10 }, vp);
    expect(s).toEqual({ x: 5, y: 10 });
    expectRoundTrip({ x: 5, y: 10 }, vp);
  });

  it('zoom only (zoom=2, no pan)', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, zoom: 2 };
    const s = worldToScreen({ x: 3, y: 4 }, vp);
    expect(s).toEqual({ x: 6, y: 8 });
    expectRoundTrip({ x: 3, y: 4 }, vp);
  });

  it('pan only (zoom=1, offset)', () => {
    const vp: Viewport = { offsetX: 100, offsetY: -50, zoom: 1 };
    const s = worldToScreen({ x: 10, y: 20 }, vp);
    expect(s).toEqual({ x: 110, y: -30 });
    expectRoundTrip({ x: 10, y: 20 }, vp);
  });

  it('combined pan and zoom', () => {
    const vp: Viewport = { offsetX: 50, offsetY: 30, zoom: 0.5 };
    const s = worldToScreen({ x: 100, y: 200 }, vp);
    expect(s).toEqual({ x: 100, y: 130 });
    expectRoundTrip({ x: 100, y: 200 }, vp);
  });

  it('round-trip with negative coordinates', () => {
    const vp: Viewport = { offsetX: -200, offsetY: 150, zoom: 3 };
    expectRoundTrip({ x: -40, y: -60 }, vp);
  });

  it('round-trip at origin for various viewports', () => {
    const viewports: Viewport[] = [
      { offsetX: 0, offsetY: 0, zoom: 1 },
      { offsetX: 500, offsetY: -300, zoom: 0.25 },
      { offsetX: -100, offsetY: -100, zoom: 4 },
    ];
    for (const vp of viewports) {
      expectRoundTrip(origin, vp);
    }
  });

  it('screenToWorld inverts worldToScreen', () => {
    const vp: Viewport = { offsetX: 42, offsetY: -17, zoom: 1.5 };
    const world: WorldPoint = { x: 7.7, y: -3.3 };
    const screen = worldToScreen(world, vp);
    const result = screenToWorld(screen, vp);
    expect(result.x).toBeCloseTo(world.x, 10);
    expect(result.y).toBeCloseTo(world.y, 10);
  });
});
