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
