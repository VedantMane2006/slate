import { describe, it, expect } from 'vitest';
import {
  unionBoundingBoxes,
  pointInBox,
  distance,
  type BoundingBox,
  type Point,
} from '../../src/utils/geometry.ts';

describe('geometry utils', () => {
  describe('unionBoundingBoxes', () => {
    it('unions two distinct bounding boxes', () => {
      const a: BoundingBox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const b: BoundingBox = { minX: 5, minY: 5, maxX: 20, maxY: 15 };
      expect(unionBoundingBoxes(a, b)).toEqual({
        minX: 0,
        minY: 0,
        maxX: 20,
        maxY: 15,
      });
    });

    it('handles one box completely inside another', () => {
      const outer: BoundingBox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const inner: BoundingBox = { minX: 10, minY: 10, maxX: 20, maxY: 20 };
      expect(unionBoundingBoxes(outer, inner)).toEqual(outer);
      expect(unionBoundingBoxes(inner, outer)).toEqual(outer);
    });

    it('handles zero-area boxes', () => {
      const a: BoundingBox = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
      const b: BoundingBox = { minX: 10, minY: 10, maxX: 10, maxY: 10 };
      expect(unionBoundingBoxes(a, b)).toEqual({
        minX: 5,
        minY: 5,
        maxX: 10,
        maxY: 10,
      });
    });
  });

  describe('pointInBox', () => {
    const box: BoundingBox = { minX: 10, minY: 10, maxX: 20, maxY: 20 };

    it('returns true for points inside the box', () => {
      expect(pointInBox({ x: 15, y: 15 }, box)).toBe(true);
    });

    it('returns true for points on the edge', () => {
      expect(pointInBox({ x: 10, y: 15 }, box)).toBe(true);
      expect(pointInBox({ x: 20, y: 15 }, box)).toBe(true);
      expect(pointInBox({ x: 15, y: 10 }, box)).toBe(true);
      expect(pointInBox({ x: 15, y: 20 }, box)).toBe(true);
    });

    it('returns true for points on the corners', () => {
      expect(pointInBox({ x: 10, y: 10 }, box)).toBe(true);
      expect(pointInBox({ x: 20, y: 20 }, box)).toBe(true);
    });

    it('returns false for points outside the box', () => {
      expect(pointInBox({ x: 5, y: 15 }, box)).toBe(false);
      expect(pointInBox({ x: 25, y: 15 }, box)).toBe(false);
      expect(pointInBox({ x: 15, y: 5 }, box)).toBe(false);
      expect(pointInBox({ x: 15, y: 25 }, box)).toBe(false);
    });

    it('handles zero-area boxes', () => {
      const zeroBox: BoundingBox = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
      expect(pointInBox({ x: 5, y: 5 }, zeroBox)).toBe(true);
      expect(pointInBox({ x: 6, y: 5 }, zeroBox)).toBe(false);
    });
  });

  describe('distance', () => {
    it('calculates distance between two distinct points', () => {
      // 3-4-5 triangle
      const a: Point = { x: 0, y: 0 };
      const b: Point = { x: 3, y: 4 };
      expect(distance(a, b)).toBe(5);
    });

    it('calculates distance for negative coordinates', () => {
      const a: Point = { x: -3, y: -4 };
      const b: Point = { x: 0, y: 0 };
      expect(distance(a, b)).toBe(5);
    });

    it('returns 0 for identical points', () => {
      const a: Point = { x: 42, y: -17 };
      expect(distance(a, a)).toBe(0);
    });
  });
});
