import React, { useState } from 'react';
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

export function TableEditor({
  id,
  initialBounds,
  initialCells = [['', ''], ['', '']],
  viewport,
  onComplete,
  onCancel
}: TableEditorProps) {
  const [cells, setCells] = useState<string[][]>(initialCells);

  const screenMin = worldToScreen({ x: initialBounds.minX, y: initialBounds.minY }, viewport);
  const screenMax = worldToScreen({ x: initialBounds.maxX, y: initialBounds.maxY }, viewport);

  const handleChange = (rowIndex: number, colIndex: number, value: string) => {
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
      <div style={{ display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${cells[0].length}, 1fr)` }}>
        {cells.map((row, r) =>
          row.map((cell, c) => (
            <input
              key={`${r}-${c}`}
              value={cell}
              onChange={(e) => handleChange(r, c, e.target.value)}
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
