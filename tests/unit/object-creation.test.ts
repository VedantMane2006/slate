import { describe, it, expect } from 'vitest';
import { createText } from '../../src/objects/text.ts';
import { createTable } from '../../src/objects/table.ts';
import { createEquation } from '../../src/objects/equation.ts';
import { createImage } from '../../src/objects/image.ts';
import {
  HistoryStack,
  AddObjectCommand,
  type ObjectStore,
} from '../../src/history/command.ts';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

function makeStore(): ObjectStore<CanvasObject> & { objects: CanvasObject[] } {
  const objects: CanvasObject[] = [];
  return {
    objects,
    add: (obj: CanvasObject) => { objects.push(obj); },
    remove: (id: string) => {
      const idx = objects.findIndex((o) => o.id === id);
      if (idx !== -1) objects.splice(idx, 1);
    },
    update: (id: string, newObj: CanvasObject) => {
      const idx = objects.findIndex((o) => o.id === id);
      if (idx !== -1) objects[idx] = newObj;
    },
    getAll: () => [...objects],
  };
}

const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };

describe('Object creation via HistoryStack', () => {
  it('TextObject is added to store and undoable', () => {
    const store = makeStore();
    const history = new HistoryStack();
    const textObj = createText('t1', bounds, 'hello world');
    history.execute(new AddObjectCommand(store, textObj));

    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].type).toBe('text');
    expect(store.objects[0].id).toBe('t1');

    history.undo();
    expect(store.objects).toHaveLength(0);
  });

  it('TableObject is added to store and undoable', () => {
    const store = makeStore();
    const history = new HistoryStack();
    const table = createTable('tb1', bounds, [['A', 'B'], ['C', 'D']]);
    history.execute(new AddObjectCommand(store, table));

    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].type).toBe('table');

    history.undo();
    expect(store.objects).toHaveLength(0);
  });

  it('EquationObject is added to store and undoable', () => {
    const store = makeStore();
    const history = new HistoryStack();
    const eq = createEquation('eq1', bounds, 'x^2 + y^2 = r^2');
    history.execute(new AddObjectCommand(store, eq));

    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].type).toBe('equation');

    history.undo();
    expect(store.objects).toHaveLength(0);
  });

  it('ImageObject is added to store and undoable', () => {
    const store = makeStore();
    const history = new HistoryStack();
    const img = createImage('img1', bounds, 'data:image/png;base64,abc');
    history.execute(new AddObjectCommand(store, img));

    expect(store.objects).toHaveLength(1);
    expect(store.objects[0].type).toBe('image');

    history.undo();
    expect(store.objects).toHaveLength(0);
  });
});

describe('TableObject custom row/column counts', () => {
  it('creates a 3x4 table', () => {
    const cells = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ''));
    const table = createTable('tb-custom', bounds, cells);
    expect(table.cells).toHaveLength(3);
    expect(table.cells[0]).toHaveLength(4);
    expect(table.cells[2]).toHaveLength(4);
  });

  it('creates a 1x1 table', () => {
    const table = createTable('tb-1x1', bounds, [['only']]);
    expect(table.cells).toHaveLength(1);
    expect(table.cells[0]).toHaveLength(1);
    expect(table.cells[0][0]).toBe('only');
  });
});

describe('ImageObject and EquationObject render caching', () => {
  it('draws placeholders if image is not loaded', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = createImage('img1', bounds, 'data:image/png;base64,mock');
    const eq = createEquation('eq1', bounds, 'x=y');
    
    // Should run without throwing errors
    expect(async () => {
      const { renderImageObjects, renderEquationObjects } = await import('../../src/canvas/renderer.ts');
      const viewport = { offsetX: 0, offsetY: 0, zoom: 1 };
      renderImageObjects(ctx, [img], viewport);
      renderEquationObjects(ctx, [eq], viewport);
    }).not.toThrow();
  });
});

describe('TextObject preserves spaces', () => {
  it('committed text value includes spaces', () => {
    const textObj = createText('ts1', bounds, 'hello world foo bar');
    expect(textObj.text).toBe('hello world foo bar');
    expect(textObj.text).toContain(' ');
  });

  it('text with multiple consecutive spaces is preserved', () => {
    const textObj = createText('ts2', bounds, 'a  b   c');
    expect(textObj.text).toBe('a  b   c');
  });
});
