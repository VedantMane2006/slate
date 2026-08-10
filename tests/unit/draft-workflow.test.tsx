import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport';

const mockClearRequest = vi.fn();
let currentActiveRequest: any = null;

vi.mock('../../src/providers/AILifecycleProvider', () => ({
  useAILifecycle: () => ({
    activeRequest: currentActiveRequest,
    askAI: vi.fn(),
    cancelRequest: vi.fn(),
    clearRequest: mockClearRequest,
  })
}));

vi.mock('../../src/components/DraftCard', () => ({
  DraftCard: ({ onAccept, onDiscard }: any) => (
    <div data-testid="draft-card">
      <button data-testid="accept-btn" onClick={onAccept}>Accept</button>
      <button data-testid="discard-btn" onClick={onDiscard}>Discard</button>
    </div>
  )
}));

import { createDraftObject } from '../../src/objects/draft-object';
vi.mock('../../src/objects/draft-object', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/objects/draft-object')>();
  return {
    ...actual,
    createDraftObject: vi.fn(actual.createDraftObject)
  };
});

import { HistoryStack } from '../../src/history/command';

describe('DraftObject Accept/Discard Workflow', () => {
  let executeSpy: any;
  let undoSpy: any;
  let redoSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    executeSpy = vi.spyOn(HistoryStack.prototype, 'execute');
    undoSpy = vi.spyOn(HistoryStack.prototype, 'undo');
    redoSpy = vi.spyOn(HistoryStack.prototype, 'redo');

    currentActiveRequest = {
      id: 'req-1',
      state: 'completed',
      parsedData: { explanation: 'Test data' },
      contextBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      timestamps: { created: Date.now() }
    };
  });

  it('Accept creates a DraftObject and is undoable', () => {
    render(<CanvasViewport />);
    const acceptBtn = screen.getByTestId('accept-btn');
    fireEvent.click(acceptBtn);

    expect(createDraftObject).toHaveBeenCalledWith('req-1', currentActiveRequest.parsedData, currentActiveRequest.contextBounds);
    expect(mockClearRequest).toHaveBeenCalled();

    // Verify it was committed via HistoryStack
    expect(executeSpy).toHaveBeenCalled();
    const command = executeSpy.mock.calls[0][0];
    expect(command.constructor.name).toBe('AddObjectCommand');

    // Verify undo works
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true });
    expect(undoSpy).toHaveBeenCalled();

    // Verify redo works
    fireEvent.keyDown(window, { code: 'KeyZ', ctrlKey: true, shiftKey: true });
    expect(redoSpy).toHaveBeenCalled();
  });

  it('Discard drops the request without creating an object', () => {
    render(<CanvasViewport />);
    const discardBtn = screen.getByTestId('discard-btn');
    fireEvent.click(discardBtn);

    expect(createDraftObject).not.toHaveBeenCalled();
    expect(mockClearRequest).toHaveBeenCalled();
    expect(executeSpy).not.toHaveBeenCalled();
  });
});

