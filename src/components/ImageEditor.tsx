import React, { useState } from 'react';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { createImage, type ImageObject } from '../objects/image.ts';

interface ImageEditorProps {
  id?: string;
  initialBounds: BoundingBox;
  initialDataUrl?: string;
  viewport: Viewport;
  onComplete: (imageObj: ImageObject) => void;
  onCancel: () => void;
}

export function ImageEditor({
  id,
  initialBounds,
  initialDataUrl = '',
  viewport,
  onComplete,
  onCancel
}: ImageEditorProps) {
  const [dataUrl, setDataUrl] = useState(initialDataUrl);

  const screenMin = worldToScreen({ x: initialBounds.minX, y: initialBounds.minY }, viewport);
  const screenMax = worldToScreen({ x: initialBounds.maxX, y: initialBounds.maxY }, viewport);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDataUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!dataUrl) return;
    const imageId = id || Math.random().toString(36).substring(2);
    onComplete(createImage(imageId, initialBounds, dataUrl));
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
        width: Math.max(200, screenMax.x - screenMin.x),
        background: 'white',
        border: '1px solid black',
        padding: '8px',
        zIndex: 10
      }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="Preview" style={{ width: '100%', display: 'block', marginBottom: '8px' }} />
      ) : (
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: '8px' }} />
      )}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={handleSave} disabled={!dataUrl}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
