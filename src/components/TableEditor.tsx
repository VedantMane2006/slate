import { useState, useCallback } from 'react';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { createTable, type Table } from '../objects/table.ts';

interface TableEditorProps {
  id?: string;
  initialBounds: BoundingBox;
  initialCells?: string[][];
  viewport: Viewport;
  onComplete: (table: Table) => void;
  onCancel: () => void;
}

function buildGrid(rows: number, cols: number, existing: string[][]): string[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => existing[r]?.[c] ?? '')
  );
}

export function TableEditor({
  id,
  initialBounds,
  initialCells = [['', ''], ['', '']],
  viewport,
  onComplete,
  onCancel
}: TableEditorProps) {
  const [rowCount, setRowCount] = useState(initialCells.length);
  const [colCount, setColCount] = useState(initialCells[0]?.length ?? 2);
  const [cells, setCells] = useState<string[][]>(initialCells);

  const screenMin = worldToScreen({ x: initialBounds.minX, y: initialBounds.minY }, viewport);
  const screenMax = worldToScreen({ x: initialBounds.maxX, y: initialBounds.maxY }, viewport);

  const handleRowChange = useCallback((value: number) => {
    const clamped = Math.max(1, Math.min(value, 20));
    setRowCount(clamped);
    setCells((prev) => buildGrid(clamped, colCount, prev));
  }, [colCount]);

  const handleColChange = useCallback((value: number) => {
    const clamped = Math.max(1, Math.min(value, 20));
    setColCount(clamped);
    setCells((prev) => buildGrid(rowCount, clamped, prev));
  }, [rowCount]);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newCells = cells.map((row, r) =>
      r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row
    );
    setCells(newCells);
  };

  const handleSave = () => {
    const tableId = id || Math.random().toString(36).substring(2);
    onComplete(createTable(tableId, initialBounds, cells));
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: screenMin.x,
        top: screenMin.y,
        width: Math.max(200, screenMax.x - screenMin.x),
        background: 'white',
        border: '1px solid black',
        padding: '8px',
        zIndex: 10
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
        <label>
          Rows:
          <input
            type="number"
            min={1}
            max={20}
            value={rowCount}
            onChange={(e) => handleRowChange(Number(e.target.value))}
            style={{ width: '48px', marginLeft: '4px' }}
          />
        </label>
        <label>
          Cols:
          <input
            type="number"
            min={1}
            max={20}
            value={colCount}
            onChange={(e) => handleColChange(Number(e.target.value))}
            style={{ width: '48px', marginLeft: '4px' }}
          />
        </label>
      </div>
      <div style={{ display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
        {cells.map((row, r) =>
          row.map((cell, c) => (
            <input
              key={`${r}-${c}`}
              value={cell}
              onChange={(e) => handleCellChange(r, c, e.target.value)}
              style={{ width: '100%' }}
            />
          ))
        )}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

