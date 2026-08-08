import { describe, it, expect } from 'vitest';
import { createTable, type Table } from '../../src/objects/table.ts';

describe('TableObject', () => {
  it('toAIPayload returns correct json shape', () => {
    const table = createTable(
      'table-1',
      { minX: 10, minY: 10, maxX: 100, maxY: 100 },
      [['A1', 'B1'], ['A2', 'B2']]
    );

    const payload = table.toAIPayload();
    expect(payload).toEqual({
      kind: 'json',
      data: [['A1', 'B1'], ['A2', 'B2']]
    });
  });

  it('round-trips correctly through JSON.stringify/parse', () => {
    const table = createTable(
      'table-2',
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      [['Header'], ['Data']]
    );

    const serialized = JSON.stringify(table);
    const parsedTable: Table = JSON.parse(serialized);

    expect(parsedTable).toEqual(table);
    expect(parsedTable.id).toBe('table-2');
    expect(parsedTable.type).toBe('table');
    expect(parsedTable.cells).toEqual([['Header'], ['Data']]);
    expect(parsedTable.bounds).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
  });
});
