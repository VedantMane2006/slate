import { useCallback } from 'react';
import { screenToWorld, type Viewport } from '../canvas/coordinates.ts';

export interface PointerSample {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export function usePointerEvents(
  viewport: Viewport,
  onSample: (sample: PointerSample) => void,
) {
  const createSample = useCallback(
    (clientX: number, clientY: number, e: PointerEvent | MouseEvent | Event, rect: DOMRect): PointerSample => {
      const screenPoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      const worldPoint = screenToWorld(screenPoint, viewport);

      // Detect support explicitly and fall back to sane defaults (pressure=0.5, tilt=0)
      const hasPressure = 'pressure' in e && typeof e.pressure === 'number';
      // Mouse events often report 0 pressure even when clicked, so we fallback to 0.5
      const pressure = hasPressure && e.pressure !== 0 ? e.pressure : 0.5;

      const tiltX = 'tiltX' in e && typeof e.tiltX === 'number' ? e.tiltX : 0;
      const tiltY = 'tiltY' in e && typeof e.tiltY === 'number' ? e.tiltY : 0;

      return {
        x: worldPoint.x,
        y: worldPoint.y,
        pressure,
        tiltX,
        tiltY,
        timestamp: typeof e.timeStamp === 'number' ? e.timeStamp : Date.now(),
      };
    },
    [viewport],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      onSample(createSample(e.clientX, e.clientY, e.nativeEvent, rect));
    },
    [createSample, onSample],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Consume getCoalescedEvents() for smoother stroke sampling
      if (typeof e.nativeEvent.getCoalescedEvents === 'function') {
        const coalesced = e.nativeEvent.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          for (const evt of coalesced) {
            onSample(createSample(evt.clientX, evt.clientY, evt, rect));
          }
          return;
        }
      }
      // Fallback if no coalesced events
      onSample(createSample(e.clientX, e.clientY, e.nativeEvent, rect));
    },
    [createSample, onSample],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      onSample(createSample(e.clientX, e.clientY, e.nativeEvent, rect));
    },
    [createSample, onSample],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
