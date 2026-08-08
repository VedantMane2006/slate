import { describe, it, expect } from 'vitest';
import { StrokeBuilder, type Stroke } from '../../src/objects/stroke.ts';
import type { PointerSample } from '../../src/hooks/usePointerEvents.ts';

describe('StrokeBuilder', () => {
  const createSample = (x: number, y: number): PointerSample => ({
    x,
    y,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    timestamp: Date.now(),
  });

  it('produces correct bounds for a single point', () => {
    const builder = new StrokeBuilder('stroke-1', 10, '#000000', 1234);
    builder.addPoint(createSample(50, 50));
    
    const stroke = builder.build();
    // width is 10, radius is 5. So bounds should be [45, 45, 55, 55]
    expect(stroke.bounds).toEqual({
      minX: 45,
      minY: 45,
      maxX: 55,
      maxY: 55,
    });
  });

  it('produces correct bounds for a straight line', () => {
    const builder = new StrokeBuilder('stroke-2', 4, '#ff0000', 1234);
    // Line from x=10 to x=100
    builder.addPoint(createSample(10, 20));
    builder.addPoint(createSample(50, 20));
    builder.addPoint(createSample(100, 20));
    
    const stroke = builder.build();
    // radius = 2
    expect(stroke.bounds).toEqual({
      minX: 8,
      minY: 18,
      maxX: 102,
      maxY: 22,
    });
  });

  it('produces correct bounds for an L-shape', () => {
    const builder = new StrokeBuilder('stroke-3', 2, '#00ff00', 1234);
    // L-shape: down then right
    builder.addPoint(createSample(0, 0));
    builder.addPoint(createSample(0, 50));
    builder.addPoint(createSample(50, 50));
    
    const stroke = builder.build();
    // radius = 1
    expect(stroke.bounds).toEqual({
      minX: -1,
      minY: -1,
      maxX: 51,
      maxY: 51,
    });
  });

  it('throws when building a stroke with no points', () => {
    const builder = new StrokeBuilder('stroke-empty', 2, '#000000', 1234);
    expect(() => builder.build()).toThrow('Cannot build a stroke with no points');
  });

  it('JSON.stringify/parse round-trip preserves all fields exactly', () => {
    const builder = new StrokeBuilder('stroke-roundtrip', 5, '#abcdef', 987654321);
    builder.addPoint(createSample(10, 10));
    builder.addPoint(createSample(20, 25));
    
    const originalStroke = builder.build();
    const serialized = JSON.stringify(originalStroke);
    const parsedStroke: Stroke = JSON.parse(serialized);
    
    expect(parsedStroke).toEqual(originalStroke);
    // Explicitly check fields to ensure they survived the round trip
    expect(parsedStroke.id).toBe('stroke-roundtrip');
    expect(parsedStroke.type).toBe('stroke');
    expect(parsedStroke.points).toHaveLength(2);
    expect(parsedStroke.width).toBe(5);
    expect(parsedStroke.color).toBe('#abcdef');
    expect(parsedStroke.timestamp).toBe(987654321);
    expect(parsedStroke.bounds).toEqual({ minX: 7.5, minY: 7.5, maxX: 22.5, maxY: 27.5 });
  });
});
