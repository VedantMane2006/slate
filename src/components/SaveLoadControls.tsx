import React, { useRef } from 'react';
import { serializeCanvas, deserializeCanvas } from '../persistence/serialization.ts';
import { exportPNG } from '../persistence/export.ts';
import type { CanvasObject } from '../objects/canvas-object.ts';
import type { Viewport } from '../canvas/coordinates.ts';

interface SaveLoadControlsProps {
  objects: CanvasObject[];
  viewport: Viewport;
  onLoadSuccess: (objects: CanvasObject[]) => void;
}

export function SaveLoadControls({ objects, viewport, onLoadSuccess }: SaveLoadControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    try {
      const data = serializeCanvas(objects);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slate-save.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleExportPNG = () => {
    try {
      exportPNG(objects, viewport);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        const parsedObjects = deserializeCanvas(json);
        onLoadSuccess(parsedObjects);
      } catch (err) {
        alert(`Failed to load file: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input so same file can be uploaded again
      }
    };
    reader.onerror = () => {
      alert('Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button 
        onClick={handleSave} 
        data-testid="save-button"
        style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
      >
        Save
      </button>
      <button 
        onClick={() => fileInputRef.current?.click()} 
        data-testid="load-button"
        style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
      >
        Load
      </button>
      <button 
        onClick={handleExportPNG} 
        data-testid="export-png-button"
        style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
      >
        Export PNG
      </button>
      <input 
        type="file" 
        accept=".json" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleLoad}
        data-testid="load-input"
      />
    </div>
  );
}
