export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Returns a new bounding box that entirely contains both input bounding boxes.
 */
export function unionBoundingBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Returns true if the point lies inside or on the edge of the bounding box.
 */
export function pointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.y >= box.minY &&
    point.y <= box.maxY
  );
}

/**
 * Returns the Euclidean distance between two points.
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Returns true if two bounding boxes intersect.
 */
export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}
