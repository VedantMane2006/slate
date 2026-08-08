import type React from 'react';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  type Viewport,
  type ScreenPoint,
} from './coordinates.ts';
import { usePointerEvents } from '../hooks/usePointerEvents.ts';
import { StrokeBuilder, type Stroke } from '../objects/stroke.ts';
import { renderStrokes } from './renderer.ts';
import { pointInBox, distance, boxesIntersect, type BoundingBox } from '../utils/geometry.ts';
import {
  HistoryStack,
  AddObjectCommand,
  RemoveObjectCommand,
  CompositeCommand,
  UpdateObjectCommand,
  type ObjectStore,
} from '../history/command.ts';

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
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selection, setSelection] = useState<{ ids: string[] }>({ ids: [] });
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  // Generic object store interface mapped over local state
  const { store, history } = useMemo(() => {
    const hist = new HistoryStack();
    const st: ObjectStore<Stroke> = {
      add: (stroke) => {
        strokesRef.current = [...strokesRef.current, stroke];
        setStrokes(strokesRef.current);
      },
      remove: (id) => {
        strokesRef.current = strokesRef.current.filter((s) => s.id !== id);
        setStrokes(strokesRef.current);
      },
      update: (id, newStroke) => {
        strokesRef.current = strokesRef.current.map((s) => (s.id === id ? newStroke : s));
        setStrokes(strokesRef.current);
      },
      getAll: () => strokesRef.current,
    };
    return { store: st, history: hist };
  }, []);

  const activeStrokeBuilder = useRef<StrokeBuilder | null>(null);
  const isInteracting = useRef(false);
  const selectionStart = useRef<{ x: number; y: number } | null>(null);
  const isDraggingSelection = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

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
      } else if (e.code === 'KeyV' && !e.repeat) {
        setIsSelectMode(true);
        setIsEraserMode(false);
      } else if (e.code === 'KeyE' && !e.repeat) {
        setIsEraserMode(true);
        setIsSelectMode(false);
      } else if (e.code === 'KeyD' && !e.repeat) {
        setIsEraserMode(false);
        setIsSelectMode(false);
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selection.ids.length > 0) {
          e.preventDefault();
          const allStrokes = store.getAll();
          const commands = selection.ids
            .map((id) => {
              const s = allStrokes.find((stroke) => stroke.id === id);
              return s ? new RemoveObjectCommand(store, s) : null;
            })
            .filter(Boolean) as RemoveObjectCommand<Stroke>[];

          if (commands.length > 0) {
            const cmd =
              commands.length === 1
                ? commands[0]
                : new CompositeCommand(commands, 'Delete selected strokes');
            history.execute(cmd);
          }
        }
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
  }, [history, store, selection]);

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

  const {
    onPointerDown: samplePointerDown,
    onPointerMove: samplePointerMove,
    onPointerUp: samplePointerUp,
  } = usePointerEvents(viewport, (sample) => {
    if (isEraserMode) {
      const ERASER_TOLERANCE = 10 / viewport.zoom;
      
      const prevStrokes = store.getAll();
      let commands: RemoveObjectCommand<Stroke>[] = [];

      for (let i = prevStrokes.length - 1; i >= 0; i--) {
        const stroke = prevStrokes[i];
        const expandedBox = {
          minX: stroke.bounds.minX - ERASER_TOLERANCE - stroke.width,
          minY: stroke.bounds.minY - ERASER_TOLERANCE - stroke.width,
          maxX: stroke.bounds.maxX + ERASER_TOLERANCE + stroke.width,
          maxY: stroke.bounds.maxY + ERASER_TOLERANCE + stroke.width,
        };
        
        if (!pointInBox(sample, expandedBox)) continue;
        
        for (const pt of stroke.points) {
          if (distance(sample, pt) <= ERASER_TOLERANCE + stroke.width) {
            // DECIDED: Whole-stroke erase design choice.
            commands.push(new RemoveObjectCommand(store, stroke));
            break;
          }
        }
      }
      
      if (commands.length > 0) {
        const cmd = commands.length === 1 ? commands[0] : new CompositeCommand(commands, 'Erase strokes');
        history.execute(cmd);
      }
    } else if (!isSelectMode && activeStrokeBuilder.current) {
      activeStrokeBuilder.current.addPoint(sample);
      try {
        setActiveStroke(activeStrokeBuilder.current.build());
      } catch {
        // Ignored, builder throws if 0 points
      }
    }
  });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const isPan = spaceHeld.current || e.button === 1 || activePointers.current.size > 1;

      if (isPan) {
        if (activePointers.current.size === 1) {
          isPanning.current = true;
          setCursorStyle('grabbing');
        }
      } else {
        isInteracting.current = true;
        if (isSelectMode) {
          const rect = e.currentTarget.getBoundingClientRect();
          const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const worldPoint = screenToWorld(screenPoint, viewport);
          
          let clickedOnSelection = false;
          if (selection.ids.length > 0) {
            const allStrokes = store.getAll();
            for (const s of allStrokes) {
              if (selection.ids.includes(s.id)) {
                const expandedBox = {
                  minX: s.bounds.minX - s.width,
                  minY: s.bounds.minY - s.width,
                  maxX: s.bounds.maxX + s.width,
                  maxY: s.bounds.maxY + s.width,
                };
                if (pointInBox(worldPoint, expandedBox)) {
                  clickedOnSelection = true;
                  break;
                }
              }
            }
          }

          if (clickedOnSelection) {
            isDraggingSelection.current = true;
            dragStart.current = worldPoint;
            setDragOffset({ dx: 0, dy: 0 });
          } else {
            isDraggingSelection.current = false;
            selectionStart.current = worldPoint;
            setSelectionBox(null);
            setSelection({ ids: [] });
          }
        } else if (!isEraserMode) {
          // Start a new stroke
          activeStrokeBuilder.current = new StrokeBuilder(
            // simple unique ID fallback since crypto.randomUUID isn't guaranteed in all JS environments
            Date.now().toString(36) + Math.random().toString(36).substring(2),
            4,
            '#000000',
            Date.now()
          );
        }
        
        if (!isSelectMode) samplePointerDown(e);
      }
    },
    [samplePointerDown, isEraserMode, isSelectMode, viewport],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      samplePointerMove(e);
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
      } else if (isInteracting.current) {
        if (isSelectMode) {
          const rect = e.currentTarget.getBoundingClientRect();
          const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          const currentWorld = screenToWorld(screenPoint, viewport);
          const startWorld = selectionStart.current;
          
          if (isDraggingSelection.current && dragStart.current) {
            setDragOffset({
              dx: currentWorld.x - dragStart.current.x,
              dy: currentWorld.y - dragStart.current.y,
            });
          } else if (startWorld) {
            const box: BoundingBox = {
              minX: Math.min(startWorld.x, currentWorld.x),
              minY: Math.min(startWorld.y, currentWorld.y),
              maxX: Math.max(startWorld.x, currentWorld.x),
              maxY: Math.max(startWorld.y, currentWorld.y),
            };
            setSelectionBox(box);

            const allStrokes = store.getAll();
            const selectedIds = allStrokes
              .filter((s) => boxesIntersect(s.bounds, box))
              .map((s) => s.id);
            setSelection({ ids: selectedIds });
          }
        } else if (!isSelectMode) {
          samplePointerMove(e);
        }
      }
    },
    [samplePointerMove, isSelectMode, viewport, store],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const ptrs = activePointers.current;
      ptrs.delete(e.pointerId);
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (ptrs.size === 0) {
        isPanning.current = false;
        setCursorStyle(spaceHeld.current ? 'grab' : 'default');
      }

      if (isInteracting.current) {
        if (isSelectMode) {
          if (isDraggingSelection.current && dragOffset) {
            const allStrokes = store.getAll();
            const commands = selection.ids.map((id) => {
              const oldStroke = allStrokes.find((s) => s.id === id);
              if (!oldStroke) return null;
              const newStroke: Stroke = {
                ...oldStroke,
                points: oldStroke.points.map((p) => ({
                  ...p,
                  x: p.x + dragOffset.dx,
                  y: p.y + dragOffset.dy,
                })),
                bounds: {
                  minX: oldStroke.bounds.minX + dragOffset.dx,
                  minY: oldStroke.bounds.minY + dragOffset.dy,
                  maxX: oldStroke.bounds.maxX + dragOffset.dx,
                  maxY: oldStroke.bounds.maxY + dragOffset.dy,
                },
              };
              return new UpdateObjectCommand(store, oldStroke, newStroke);
            }).filter(Boolean) as UpdateObjectCommand<Stroke>[];

            if (commands.length > 0) {
              const cmd = commands.length === 1 ? commands[0] : new CompositeCommand(commands, 'Move strokes');
              history.execute(cmd);
            }

            isDraggingSelection.current = false;
            dragStart.current = null;
            setDragOffset(null);
          } else {
            selectionStart.current = null;
            setSelectionBox(null);
          }
        } else {
          samplePointerUp(e);
          if (activeStrokeBuilder.current) {
            try {
              const finalStroke = activeStrokeBuilder.current.build();
              history.execute(new AddObjectCommand(store, finalStroke));
            } catch {
              // Ignored
            }
            activeStrokeBuilder.current = null;
            setActiveStroke(null);
          }
        }
        isInteracting.current = false;
      }
    },
    [samplePointerUp, history, store, isSelectMode],
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

    // Draw strokes
    const unselectedStrokes = strokes.filter((s) => !selection.ids.includes(s.id));
    const selectedStrokes = strokes.filter((s) => selection.ids.includes(s.id));

    renderStrokes(ctx, unselectedStrokes, viewport);
    if (activeStroke) {
      renderStrokes(ctx, [activeStroke], viewport);
    }

    if (selectedStrokes.length > 0) {
      ctx.save();
      if (dragOffset) {
        ctx.translate(dragOffset.dx * viewport.zoom, dragOffset.dy * viewport.zoom);
      }
      
      renderStrokes(ctx, selectedStrokes, viewport);
      
      ctx.strokeStyle = 'rgba(13, 110, 253, 0.5)';
      ctx.lineWidth = 2;
      for (const stroke of selectedStrokes) {
        const screenMin = worldToScreen({ x: stroke.bounds.minX, y: stroke.bounds.minY }, viewport);
        const screenMax = worldToScreen({ x: stroke.bounds.maxX, y: stroke.bounds.maxY }, viewport);
        ctx.strokeRect(
          screenMin.x - 4,
          screenMin.y - 4,
          screenMax.x - screenMin.x + 8,
          screenMax.y - screenMin.y + 8
        );
      }
      ctx.restore();
    }

    // Draw selection box
    if (selectionBox) {
      const screenMin = worldToScreen({ x: selectionBox.minX, y: selectionBox.minY }, viewport);
      const screenMax = worldToScreen({ x: selectionBox.maxX, y: selectionBox.maxY }, viewport);
      ctx.fillStyle = 'rgba(13, 110, 253, 0.1)';
      ctx.strokeStyle = 'rgba(13, 110, 253, 0.8)';
      ctx.lineWidth = 1;
      const w = screenMax.x - screenMin.x;
      const h = screenMax.y - screenMin.y;
      ctx.fillRect(screenMin.x, screenMin.y, w, h);
      ctx.strokeRect(screenMin.x, screenMin.y, w, h);
    }
  }, [viewport, strokes, activeStroke, selection, selectionBox, dragOffset]);

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
