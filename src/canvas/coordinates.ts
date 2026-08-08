/** A point in world space (where canvas objects live). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** A point in screen space (where rendering and cursor events happen). */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Viewport state: pan offset and zoom level. */
export interface Viewport {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoom: number;
}

/**
 * Convert a world-space point to screen-space given the current viewport.
 *
 * screen = world * zoom + offset
 */
export function worldToScreen(point: WorldPoint, viewport: Viewport): ScreenPoint {
  return {
    x: point.x * viewport.zoom + viewport.offsetX,
    y: point.y * viewport.zoom + viewport.offsetY,
  };
}

/**
 * Convert a screen-space point to world-space given the current viewport.
 *
 * world = (screen - offset) / zoom
 */
export function screenToWorld(point: ScreenPoint, viewport: Viewport): WorldPoint {
  return {
    x: (point.x - viewport.offsetX) / viewport.zoom,
    y: (point.y - viewport.offsetY) / viewport.zoom,
  };
}
