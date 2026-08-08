import type React from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  type Viewport,
  type ScreenPoint,
} from './coordinates.ts';

interface PointerRecord {
  x: number;
  y: number;
}

export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<Viewport>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  });
  const [cursorStyle, setCursorStyle] = useState('default');

  const spaceHeld = useRef(false);
  const isPanning = useRef(false);
  const activePointers = useRef(new Map<number, PointerRecord>());

  // Space key toggles pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
        setCursorStyle('grab');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        isPanning.current = false;
        setCursorStyle('default');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Wheel zoom — native listener so we can use { passive: false }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursor: ScreenPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setViewport((vp) => zoomAtPoint(vp, cursor, factor));
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if ((spaceHeld.current || e.button === 1) && activePointers.current.size === 1) {
        isPanning.current = true;
        setCursorStyle('grabbing');
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const ptrs = activePointers.current;
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;

      // Two-pointer pinch zoom
      if (ptrs.size === 2) {
        const otherId = Array.from(ptrs.keys()).find((id) => id !== e.pointerId);
        if (otherId === undefined) return;
        const other = ptrs.get(otherId);
        if (!other) return;

        const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const currDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);

        if (prevDist > 1) {
          const rect = e.currentTarget.getBoundingClientRect();
          const midpoint: ScreenPoint = {
            x: (e.clientX + other.x) / 2 - rect.left,
            y: (e.clientY + other.y) / 2 - rect.top,
          };
          setViewport((vp) => zoomAtPoint(vp, midpoint, currDist / prevDist));
        }
        return;
      }

      // Single-pointer pan
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (isPanning.current) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        setViewport((vp) => ({
          ...vp,
          offsetX: vp.offsetX + dx,
          offsetY: vp.offsetY + dy,
        }));
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointers.current.delete(e.pointerId);
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (activePointers.current.size === 0) {
        isPanning.current = false;
        setCursorStyle(spaceHeld.current ? 'grab' : 'default');
      }
    },
    [],
  );

  // Render grid
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, w, h);

    // Adaptive grid — keeps roughly the same visual density at any zoom
    const baseSpacing = 50;
    const gridPower = -Math.round(Math.log10(viewport.zoom));
    const gridSpacing = baseSpacing * Math.pow(10, gridPower);
    if (gridSpacing < 1) return;

    const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
    const bottomRight = screenToWorld({ x: w, y: h }, viewport);

    const startX = Math.floor(topLeft.x / gridSpacing) * gridSpacing;
    const startY = Math.floor(topLeft.y / gridSpacing) * gridSpacing;
    const endX = Math.ceil(bottomRight.x / gridSpacing) * gridSpacing;
    const endY = Math.ceil(bottomRight.y / gridSpacing) * gridSpacing;

    // Grid lines
    ctx.strokeStyle = '#e2e6ea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let wx = startX; wx <= endX; wx += gridSpacing) {
      const sx = worldToScreen({ x: wx, y: 0 }, viewport).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let wy = startY; wy <= endY; wy += gridSpacing) {
      const sy = worldToScreen({ x: 0, y: wy }, viewport).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Origin axes
    const origin = worldToScreen({ x: 0, y: 0 }, viewport);
    ctx.strokeStyle = '#adb5bd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, h);
    ctx.moveTo(0, origin.y);
    ctx.lineTo(w, origin.y);
    ctx.stroke();

    // Origin dot
    ctx.fillStyle = '#495057';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [viewport]);

  // Re-render on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setViewport((vp) => ({ ...vp }));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
        cursor: cursorStyle,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
