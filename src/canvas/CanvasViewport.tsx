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
import type { CanvasObject } from '../objects/canvas-object.ts';
import { createDraftObject, type DraftObject } from '../objects/draft-object.ts';
import { TextEditor } from '../components/TextEditor.tsx';
import { TableEditor } from '../components/TableEditor.tsx';
import { ImageEditor } from '../components/ImageEditor.tsx';
import { EquationEditor } from '../components/EquationEditor.tsx';
import { renderStrokes, renderDraftObjects, renderTextObjects, renderTableObjects, renderEquationObjects, renderImageObjects } from './renderer.ts';
import type { TextObject } from '../objects/text.ts';
import type { Table } from '../objects/table.ts';
import type { EquationObject } from '../objects/equation.ts';
import type { ImageObject } from '../objects/image.ts';
import { pointInBox, distance, boxesIntersect, type BoundingBox } from '../utils/geometry.ts';
import {
  HistoryStack,
  AddObjectCommand,
  RemoveObjectCommand,
  CompositeCommand,
  UpdateObjectCommand,
  type ObjectStore,
} from '../history/command.ts';
import { useAILifecycle } from '../providers/AILifecycleProvider.tsx';
import { useMetrics } from '../providers/MetricsProvider.tsx';
import { DraftCard } from '../components/DraftCard.tsx';
import { CostPreview } from '../components/CostPreview.tsx';

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
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selection, setSelection] = useState<{ ids: string[] }>({ ids: [] });
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [hideTerminalState, setHideTerminalState] = useState(false);
  const [activeEditor, setActiveEditor] = useState<{ type: 'text' | 'table' | 'image' | 'equation'; bounds: BoundingBox; id: string } | null>(null);

  const { askAI, activeRequest, cancelRequest, clearRequest } = useAILifecycle();
  const { logOutcome } = useMetrics();
  const loggedRequestIds = useRef(new Set<string>());

  useEffect(() => {
    if (activeRequest && ['error', 'cancelled', 'timeout', 'superseded'].includes(activeRequest.state)) {
      if (!loggedRequestIds.current.has(activeRequest.id)) {
        logOutcome(activeRequest, activeRequest.state as any, '', activeRequest.confidenceLevel);
        loggedRequestIds.current.add(activeRequest.id);
      }
      
      if (['error', 'cancelled', 'timeout'].includes(activeRequest.state)) {
        setHideTerminalState(false);
        const timer = setTimeout(() => setHideTerminalState(true), 3000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [activeRequest, logOutcome]);

  const objectsRef = useRef<CanvasObject[]>(objects);
  objectsRef.current = objects;

  // Generic object store interface mapped over local state
  const { store, history } = useMemo(() => {
    const hist = new HistoryStack();
    const st: ObjectStore<CanvasObject> = {
      add: (obj) => {
        objectsRef.current = [...objectsRef.current, obj];
        setObjects(objectsRef.current);
      },
      remove: (id) => {
        objectsRef.current = objectsRef.current.filter((o) => o.id !== id);
        setObjects(objectsRef.current);
      },
      update: (id, newObj) => {
        objectsRef.current = objectsRef.current.map((o) => (o.id === id ? newObj : o));
        setObjects(objectsRef.current);
      },
      getAll: () => objectsRef.current,
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
      // Skip canvas keyboard shortcuts when the user is typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if (isEditing) return;

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
          const allObjects = store.getAll();
          const commands = selection.ids
            .map((id) => {
              const o = allObjects.find((obj) => obj.id === id);
              return o ? new RemoveObjectCommand(store, o) : null;
            })
            .filter(Boolean) as RemoveObjectCommand<CanvasObject>[];

          if (commands.length > 0) {
            const cmd =
              commands.length === 1
                ? commands[0]
                : new CompositeCommand(commands, 'Delete selected objects');
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
      
      const prevObjects = store.getAll();
      const commands: RemoveObjectCommand<CanvasObject>[] = [];

      for (let i = prevObjects.length - 1; i >= 0; i--) {
        const obj = prevObjects[i];
        
        if (obj.type === 'stroke') {
          const stroke = obj as Stroke;
          const expandedBox = {
            minX: stroke.bounds.minX - ERASER_TOLERANCE - stroke.width,
            minY: stroke.bounds.minY - ERASER_TOLERANCE - stroke.width,
            maxX: stroke.bounds.maxX + ERASER_TOLERANCE + stroke.width,
            maxY: stroke.bounds.maxY + ERASER_TOLERANCE + stroke.width,
          };
          
          if (!pointInBox(sample, expandedBox)) continue;
          
          for (const pt of stroke.points) {
            if (distance(sample, pt) <= ERASER_TOLERANCE + stroke.width) {
              commands.push(new RemoveObjectCommand(store, stroke));
              break;
            }
          }
        } else {
          // Erase non-strokes by simple bounding box hit test
          const expandedBox = {
            minX: obj.bounds.minX - ERASER_TOLERANCE,
            minY: obj.bounds.minY - ERASER_TOLERANCE,
            maxX: obj.bounds.maxX + ERASER_TOLERANCE,
            maxY: obj.bounds.maxY + ERASER_TOLERANCE,
          };
          if (pointInBox(sample, expandedBox)) {
            commands.push(new RemoveObjectCommand(store, obj));
          }
        }
      }
      
      if (commands.length > 0) {
        const cmd = commands.length === 1 ? commands[0] : new CompositeCommand(commands, 'Erase objects');
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
            const allObjects = store.getAll();
            for (const o of allObjects) {
              if (selection.ids.includes(o.id)) {
                const width = o.type === 'stroke' ? (o as Stroke).width : 0;
                const expandedBox = {
                  minX: o.bounds.minX - width,
                  minY: o.bounds.minY - width,
                  maxX: o.bounds.maxX + width,
                  maxY: o.bounds.maxY + width,
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
    [samplePointerDown, isEraserMode, isSelectMode, viewport, selection.ids, store],
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

            const allObjects = store.getAll();
            const selectedIds = allObjects
              .filter((o) => boxesIntersect(o.bounds, box))
              .map((o) => o.id);
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
            const allObjects = store.getAll();
            const commands = selection.ids.map((id) => {
              const oldObj = allObjects.find((o) => o.id === id);
              if (!oldObj) return null;
              
              if (oldObj.type === 'stroke') {
                const oldStroke = oldObj as Stroke;
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
              } else {
                const newObj: CanvasObject = {
                  ...oldObj,
                  bounds: {
                    minX: oldObj.bounds.minX + dragOffset.dx,
                    minY: oldObj.bounds.minY + dragOffset.dy,
                    maxX: oldObj.bounds.maxX + dragOffset.dx,
                    maxY: oldObj.bounds.maxY + dragOffset.dy,
                  }
                };
                return new UpdateObjectCommand(store, oldObj, newObj);
              }
            }).filter(Boolean) as UpdateObjectCommand<CanvasObject>[];

            if (commands.length > 0) {
              const cmd = commands.length === 1 ? commands[0] : new CompositeCommand(commands, 'Move objects');
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
    [samplePointerUp, history, store, isSelectMode, selection.ids, dragOffset],
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

    // Separate objects by type for rendering
    const strokeObjects = objects.filter((o) => o.type === 'stroke') as Stroke[];
    const draftObjects = objects.filter((o) => o.type === 'draft') as DraftObject[];
    const textObjects = objects.filter((o) => o.type === 'text') as TextObject[];
    const tableObjects = objects.filter((o) => o.type === 'table') as Table[];
    const equationObjects = objects.filter((o) => o.type === 'equation') as EquationObject[];
    const imageObjects = objects.filter((o) => o.type === 'image') as ImageObject[];

    const isSelected = (id: string) => selection.ids.includes(id);
    const unselectedStrokes = strokeObjects.filter((s) => !isSelected(s.id));
    const selectedStrokes = strokeObjects.filter((s) => isSelected(s.id));
    const unselectedDrafts = draftObjects.filter((d) => !isSelected(d.id));
    const selectedDrafts = draftObjects.filter((d) => isSelected(d.id));
    const unselectedTexts = textObjects.filter((t) => !isSelected(t.id));
    const selectedTexts = textObjects.filter((t) => isSelected(t.id));
    const unselectedTables = tableObjects.filter((t) => !isSelected(t.id));
    const selectedTables = tableObjects.filter((t) => isSelected(t.id));
    const unselectedEquations = equationObjects.filter((e) => !isSelected(e.id));
    const selectedEquations = equationObjects.filter((e) => isSelected(e.id));
    const unselectedImages = imageObjects.filter((i) => !isSelected(i.id));
    const selectedImages = imageObjects.filter((i) => isSelected(i.id));

    // Get selected objects of all types (for selection highlight rectangles)
    const selectedObjects = objects.filter((o) => isSelected(o.id));

    // Render unselected objects
    renderStrokes(ctx, unselectedStrokes, viewport);
    renderDraftObjects(ctx, unselectedDrafts, viewport);
    renderTextObjects(ctx, unselectedTexts, viewport);
    renderTableObjects(ctx, unselectedTables, viewport);
    renderEquationObjects(ctx, unselectedEquations, viewport);
    renderImageObjects(ctx, unselectedImages, viewport);
    if (activeStroke) {
      renderStrokes(ctx, [activeStroke], viewport);
    }

    // Render selected objects with optional drag offset and selection highlight
    if (selectedObjects.length > 0) {
      ctx.save();
      if (dragOffset) {
        ctx.translate(dragOffset.dx * viewport.zoom, dragOffset.dy * viewport.zoom);
      }
      
      renderStrokes(ctx, selectedStrokes, viewport);
      renderDraftObjects(ctx, selectedDrafts, viewport);
      renderTextObjects(ctx, selectedTexts, viewport);
      renderTableObjects(ctx, selectedTables, viewport);
      renderEquationObjects(ctx, selectedEquations, viewport);
      renderImageObjects(ctx, selectedImages, viewport);
      
      ctx.strokeStyle = 'rgba(13, 110, 253, 0.5)';
      ctx.lineWidth = 2;
      for (const obj of selectedObjects) {
        const screenMin = worldToScreen({ x: obj.bounds.minX, y: obj.bounds.minY }, viewport);
        const screenMax = worldToScreen({ x: obj.bounds.maxX, y: obj.bounds.maxY }, viewport);
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
  }, [viewport, objects, activeStroke, selection, selectionBox, dragOffset]);

  // Re-render on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setViewport((vp) => ({ ...vp }));
    });
    observer.observe(canvas);

    const handleForceRender = () => setViewport((vp) => ({ ...vp }));
    window.addEventListener('force-render', handleForceRender);

    return () => {
      observer.disconnect();
      window.removeEventListener('force-render', handleForceRender);
    };
  }, []);

  const openEditorAtCenter = useCallback((type: 'text' | 'table' | 'image' | 'equation') => {
    const centerScreen = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
    const centerWorld = screenToWorld(centerScreen, viewport);
    const bounds = {
      minX: centerWorld.x - 100,
      minY: centerWorld.y - 50,
      maxX: centerWorld.x + 100,
      maxY: centerWorld.y + 50
    };
    setActiveEditor({ type, bounds, id: Date.now().toString(36) });
  }, [viewport]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, display: 'flex', gap: 8 }}>
        <button onClick={() => openEditorAtCenter('text')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>Insert Text</button>
        <button onClick={() => openEditorAtCenter('table')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>Insert Table</button>
        <button onClick={() => openEditorAtCenter('image')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>Insert Image</button>
        <button onClick={() => openEditorAtCenter('equation')} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>Insert Equation</button>
      </div>
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activeRequest && activeRequest.state !== 'completed' && !(hideTerminalState && ['error', 'cancelled', 'timeout'].includes(activeRequest.state)) ? (
          <div style={{ background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ marginBottom: 8, fontSize: 14 }}>State: {activeRequest.state}</div>
            {!['error', 'cancelled', 'timeout'].includes(activeRequest.state) && (
              <button onClick={cancelRequest} style={{ padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel AI</button>
            )}
          </div>
        ) : (
          <button 
            onClick={() => askAI(store.getAll(), selection)}
            style={{ padding: '8px 16px', background: '#0d6efd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Ask AI
          </button>
        )}
      </div>
      
      <CostPreview request={activeRequest} />
      
      {activeRequest && (activeRequest.state === 'completed' || activeRequest.state === 'error') && (
        <DraftCard
          request={activeRequest}
          viewport={viewport}
          roiBounds={activeRequest.contextBounds || null}
          onAccept={() => {
            if (activeRequest.parsedData && activeRequest.contextBounds) {
              const draftObj = createDraftObject(
                activeRequest.id, 
                activeRequest.parsedData, 
                activeRequest.contextBounds
              );
              history.execute(new AddObjectCommand(store, draftObj));
              console.log("Draft accepted. Object created and committed via HistoryStack:", draftObj);
            } else {
              console.warn("Draft Accept skipped: missing parsedData or contextBounds", { activeRequest });
            }
            logOutcome(activeRequest, 'accepted', JSON.stringify(activeRequest.parsedData), activeRequest.confidenceLevel);
            loggedRequestIds.current.add(activeRequest.id);
            clearRequest();
          }}
          onDiscard={() => {
            logOutcome(
              activeRequest, 
              activeRequest.state === 'error' ? 'error' : 'discarded', 
              activeRequest.parsedData ? JSON.stringify(activeRequest.parsedData) : '', 
              activeRequest.confidenceLevel
            );
            loggedRequestIds.current.add(activeRequest.id);
            clearRequest();
          }}
        />
      )}
      
      {activeEditor?.type === 'text' && (
        <TextEditor 
          id={activeEditor.id}
          initialBounds={activeEditor.bounds}
          viewport={viewport}
          onComplete={(obj) => { history.execute(new AddObjectCommand(store, obj)); setActiveEditor(null); }}
          onCancel={() => setActiveEditor(null)}
        />
      )}
      {activeEditor?.type === 'table' && (
        <TableEditor 
          id={activeEditor.id}
          initialBounds={activeEditor.bounds}
          viewport={viewport}
          onComplete={(obj) => { history.execute(new AddObjectCommand(store, obj)); setActiveEditor(null); }}
          onCancel={() => setActiveEditor(null)}
        />
      )}
      {activeEditor?.type === 'image' && (
        <ImageEditor 
          id={activeEditor.id}
          initialBounds={activeEditor.bounds}
          viewport={viewport}
          onComplete={(obj) => { history.execute(new AddObjectCommand(store, obj)); setActiveEditor(null); }}
          onCancel={() => setActiveEditor(null)}
        />
      )}
      {activeEditor?.type === 'equation' && (
        <EquationEditor 
          id={activeEditor.id}
          initialBounds={activeEditor.bounds}
          viewport={viewport}
          onComplete={(obj) => { history.execute(new AddObjectCommand(store, obj)); setActiveEditor(null); }}
          onCancel={() => setActiveEditor(null)}
        />
      )}
    </div>
  );
}
