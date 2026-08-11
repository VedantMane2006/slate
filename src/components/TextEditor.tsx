import { useState } from 'react';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { createText, type TextObject } from '../objects/text.ts';

interface TextEditorProps {
  id?: string;
  initialBounds: BoundingBox;
  initialText?: string;
  viewport: Viewport;
  onComplete: (textObj: TextObject) => void;
  onCancel: () => void;
}

export function TextEditor({
  id,
  initialBounds,
  initialText = '',
  viewport,
  onComplete,
  onCancel
}: TextEditorProps) {
  const [text, setText] = useState(initialText);

  const screenMin = worldToScreen({ x: initialBounds.minX, y: initialBounds.minY }, viewport);
  const screenMax = worldToScreen({ x: initialBounds.maxX, y: initialBounds.maxY }, viewport);

  const handleSave = () => {
    const textId = id || Math.random().toString(36).substring(2);
    onComplete(createText(textId, initialBounds, text));
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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', height: '60px' }}
      />
      <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
