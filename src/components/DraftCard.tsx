import { useMemo, useEffect, useState } from 'react';
import type { AIRequest } from '../ai/lifecycle/state-machine.ts';
import type { BoundingBox } from '../utils/geometry.ts';
import type { Viewport } from '../canvas/coordinates.ts';
import { worldToScreen } from '../canvas/coordinates.ts';
import { renderMarkdown, renderLatex, renderTable, renderGraph } from '../ai/rendering/renderers.tsx';

export interface DraftCardProps {
  request: AIRequest;
  roiBounds: BoundingBox | null;
  viewport: Viewport;
  onAccept: () => void;
  onDiscard: () => void;
}

export function DraftCard({ request, roiBounds, viewport, onAccept, onDiscard }: DraftCardProps) {
  console.log("DraftCard rendering. request state:", request.state, "id:", request.id);
  const [screenBounds, setScreenBounds] = useState({ width: 1024, height: 768 });

  useEffect(() => {
    // Only access window in browser environment
    if (typeof window !== 'undefined') {
      const updateBounds = () => setScreenBounds({ width: window.innerWidth, height: window.innerHeight });
      updateBounds();
      window.addEventListener('resize', updateBounds);
      return () => window.removeEventListener('resize', updateBounds);
    }
    return undefined;
  }, []);

  const style = useMemo(() => {
    let top = 50;
    let left = 50;
    
    if (roiBounds) {
      // Anchor to top-right of ROI
      const screenPoint = worldToScreen({ x: roiBounds.maxX, y: roiBounds.minY }, viewport);
      left = screenPoint.x + 20; // 20px padding
      top = screenPoint.y;
      
      // Clamp horizontally
      const cardWidth = 350;
      if (left + cardWidth > screenBounds.width) {
        left = screenBounds.width - cardWidth - 20; // push left if it goes off right edge
      }
      left = Math.max(20, left); // clamp to left edge
      
      // Clamp vertically
      const cardHeightEst = 400; // rough estimate
      if (top + cardHeightEst > screenBounds.height) {
        top = screenBounds.height - cardHeightEst - 20;
      }
      top = Math.max(20, top);
    }

    return {
      position: 'absolute' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: '350px',
      maxHeight: '80vh',
      overflowY: 'auto' as const,
      backgroundColor: '#fff',
      border: '1px solid #ced4da',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      padding: '16px',
      zIndex: 1000,
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '16px'
    };
  }, [roiBounds, viewport, screenBounds]);

  if (request.state !== 'completed' && request.state !== 'error') {
    return null;
  }

  const isError = request.state === 'error' || !request.parsedData;

  return (
    <div style={style} data-testid="draft-card">
      <div style={{ flexGrow: 1 }}>
        {isError ? (
          <div style={{ color: '#dc3545', fontWeight: 'bold' }}>
            Error: {request.error || 'Unknown error occurred'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div data-testid="draft-explanation">
              {renderMarkdown(request.parsedData!.explanation)}
            </div>
            {request.parsedData!.latex && (
              <div data-testid="draft-latex" style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
                {renderLatex(request.parsedData!.latex)}
              </div>
            )}
            {request.parsedData!.table && (
              <div data-testid="draft-table">
                {renderTable(request.parsedData!.table)}
              </div>
            )}
            {request.parsedData!.graph && (
              <div data-testid="draft-graph" style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                {renderGraph(request.parsedData!.graph)}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <button 
          onClick={onDiscard} 
          style={{ padding: '6px 12px', background: '#f8f9fa', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}
        >
          Discard
        </button>
        {!isError && (
          <button 
            onClick={onAccept}
            style={{ padding: '6px 12px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Accept
          </button>
        )}
      </div>
    </div>
  );
}
