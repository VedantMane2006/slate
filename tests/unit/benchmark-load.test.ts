import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deserializeCanvas, serializeCanvas } from '../../src/persistence/serialization.ts';

const benchmarkDir = path.resolve(__dirname, '../../benchmarks');

describe('Benchmark canvas loading', () => {
  describe('sparse.json', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'sparse.json'), 'utf-8'));

    it('deserializes to exactly 2 stroke objects with correct IDs', () => {
      const objects = deserializeCanvas(raw);
      expect(objects).toHaveLength(2);
      expect(objects[0].id).toBe('sparse-1');
      expect(objects[1].id).toBe('sparse-2');
      expect(objects.every(o => o.type === 'stroke')).toBe(true);
    });

    it('round-trips through serialize → deserialize without data loss', () => {
      const objects = deserializeCanvas(raw);
      const reserialized = serializeCanvas(objects);
      const roundTripped = deserializeCanvas(reserialized);

      expect(roundTripped).toHaveLength(objects.length);
      for (let i = 0; i < objects.length; i++) {
        expect(roundTripped[i].id).toBe(objects[i].id);
        expect(roundTripped[i].type).toBe(objects[i].type);
        expect(roundTripped[i].bounds).toEqual(objects[i].bounds);
      }
    });
  });

  describe('dense.json', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'dense.json'), 'utf-8'));

    it('deserializes to the expected number of stroke objects', () => {
      const objects = deserializeCanvas(raw);
      // Dense benchmark has 40+ strokes plus a table and a text object
      expect(objects.length).toBeGreaterThanOrEqual(30);
      const strokeCount = objects.filter(o => o.type === 'stroke').length;
      expect(strokeCount).toBeGreaterThanOrEqual(30);
    });

    it('all object IDs start with "dense-"', () => {
      const objects = deserializeCanvas(raw);
      const strokeObjects = objects.filter(o => o.type === 'stroke');
      for (const obj of strokeObjects) {
        expect(obj.id).toMatch(/^dense-/);
      }
    });

    it('round-trips through serialize → deserialize without data loss', () => {
      const objects = deserializeCanvas(raw);
      const reserialized = serializeCanvas(objects);
      const roundTripped = deserializeCanvas(reserialized);

      expect(roundTripped).toHaveLength(objects.length);
      for (let i = 0; i < objects.length; i++) {
        expect(roundTripped[i].id).toBe(objects[i].id);
        expect(roundTripped[i].type).toBe(objects[i].type);
        expect(roundTripped[i].bounds).toEqual(objects[i].bounds);
      }
    });
  });
});
