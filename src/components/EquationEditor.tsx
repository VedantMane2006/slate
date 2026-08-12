import { useState } from 'react';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { createEquation, type EquationObject } from '../objects/equation.ts';
import { renderLatex } from '../ai/rendering/renderers.tsx';

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

  const handleSave = () => {
    const eqId = id || Math.random().toString(36).substring(2);
    onComplete(createEquation(eqId, initialBounds, latex));
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: screenMin.x,
        top: screenMin.y,
        minWidth: 300,
        maxWidth: 600,
        background: 'white',
        border: '1px solid black',
        padding: '8px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div 
        style={{ 
          padding: '8px', 
          background: '#f8f9fa', 
          border: '1px solid #ced4da', 
          borderRadius: '4px',
          overflowX: 'auto',
          minHeight: '40px'
        }}
      >
        {latex ? renderLatex(latex) : <span style={{ color: '#adb5bd' }}>Preview...</span>}
      </div>
      <textarea
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        placeholder="Enter LaTeX..."
        style={{ 
          width: '100%', 
          minHeight: '60px',
          resize: 'vertical',
          fontFamily: 'monospace'
        }}
      />
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
