import '@testing-library/jest-dom';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() { /* mock */ }
  unobserve() { /* mock */ }
  disconnect() { /* mock */ }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// jsdom does not implement getContext by default
HTMLCanvasElement.prototype.getContext = vi.fn() as unknown as typeof HTMLCanvasElement.prototype.getContext;

if (!global.PointerEvent) {
  class MockPointerEvent extends Event {
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
    constructor(type: string, params: Record<string, unknown> = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 1;
      this.clientX = params.clientX || 0;
      this.clientY = params.clientY || 0;
      this.button = params.button || 0;
    }
  }
  (globalThis as unknown as { PointerEvent: typeof MockPointerEvent }).PointerEvent = MockPointerEvent;
}
