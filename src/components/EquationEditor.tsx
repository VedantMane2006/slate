import React, { useState } from 'react';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { createEquation, type EquationObject } from '../objects/equation.ts';

interface EquationEditorProps {
  id?: string;
  initialBounds: BoundingBox;
  initialLatex?: string;
  viewport: Viewport;
  onComplete: (eqObj: EquationObject) => void;
  onCancel: () => void;
}

export function EquationEditor({
  id,
  initialBounds,
  initialLatex = '',
  viewport,
  onComplete,
  onCancel
}: EquationEditorProps) {
  const [latex, setLatex] = useState(initialLatex);

  const screenMin = worldToScreen({ x: initialBounds.minX, y: initialBounds.minY }, viewport);
  const screenMax = worldToScreen({ x: initialBounds.maxX, y: initialBounds.maxY }, viewport);

  const handleSave = () => {
    const eqId = id || Math.random().toString(36).substring(2);
    onComplete(createEquation(eqId, initialBounds, latex));
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
      <input
        type="text"
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        placeholder="Enter LaTeX..."
        style={{ width: '100%', marginBottom: '8px' }}
      />
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
