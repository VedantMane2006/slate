import '@testing-library/jest-dom';
import { vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as any;

// jsdom does not implement getContext by default
HTMLCanvasElement.prototype.getContext = vi.fn() as any;
