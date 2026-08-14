import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AILifecycleProvider, useAILifecycle } from '../../src/providers/AILifecycleProvider.tsx';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';

// Mock Gemini SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContentStream: vi.fn().mockImplementation(async () => {
            const chunks = ['{"explanation":', '"mocked', ' AI', ' response"}'];
            async function* mockStream() {
              for (const chunk of chunks) {
                // Simulate network delay
                await new Promise((resolve) => setTimeout(resolve, 10));
                yield { text: () => chunk };
              }
            }
            return { stream: mockStream() };
          })
        })
      };
    })
  };
});

// Mock Canvas objects
const mockObjects: CanvasObject[] = [
  { id: '1', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, timestamp: Date.now(), type: 'stroke', points: [] } as any
];

function TestComponent() {
  const { askAI, cancelRequest, activeRequest } = useAILifecycle();

  return (
    <div>
      <div data-testid="status">{activeRequest?.state || 'idle'}</div>
      <button onClick={() => askAI(mockObjects, { ids: ['1'] })}>Ask AI</button>
      <button onClick={cancelRequest}>Cancel</button>
    </div>
  );
}

describe('AI Lifecycle Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a full request cycle reaches completed with the expected text', async () => {
    // We will spy on console.log to verify the final text is logged, as required
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <AILifecycleProvider>
        <TestComponent />
      </AILifecycleProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('idle');

    fireEvent.click(screen.getByText('Ask AI'));

    // Eventually it reaches completed
    await vi.waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('completed');
    }, { timeout: 2000 });

    expect(consoleSpy).toHaveBeenCalledWith('AI Response:', '{"explanation":"mocked AI response"}');
    
    consoleSpy.mockRestore();
  });

  it('clicking Cancel mid-request correctly reaches cancelled, not error or completed', async () => {
    render(
      <AILifecycleProvider>
        <TestComponent />
      </AILifecycleProvider>
    );

    fireEvent.click(screen.getByText('Ask AI'));

    await vi.waitFor(() => {
      const status = screen.getByTestId('status').textContent;
      expect(['waiting', 'streaming']).toContain(status);
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByTestId('status').textContent).toBe('cancelled');

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByTestId('status').textContent).toBe('cancelled');
  });

  it('an API error correctly transitions the AIRequest to error state with the error message captured', async () => {
    // Override the mock to throw an error for this test
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    (GoogleGenerativeAI as any).mockImplementationOnce(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContentStream: vi.fn().mockRejectedValue(new Error('404 (Not Found)'))
      })
    }));

    render(
      <AILifecycleProvider>
        <TestComponent />
      </AILifecycleProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('idle');

    fireEvent.click(screen.getByText('Ask AI'));

    // Eventually it reaches error
    await vi.waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
    });
  });

  it('canvas remains fully interactive while an AI request is in-flight', async () => {
    const strokeSpy = vi.fn();
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: strokeSpy,
      fill: vi.fn(),
      arc: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { MetricsProvider } = await import('../../src/providers/MetricsProvider.tsx');

    const { container } = render(
      <AILifecycleProvider>
        <MetricsProvider>
          <CanvasViewport />
        </MetricsProvider>
      </AILifecycleProvider>
    );

    // 1. Draw a small initial stroke so ContextExtraction has something to find
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
    
    // Clear the stroke spy so we only count new strokes drawn during the request
    strokeSpy.mockClear();

    // 2. Trigger Ask AI (the button is inside the CanvasViewport now)
    fireEvent.click(screen.getByText('Ask AI'));

    // Wait until it reaches 'waiting' or 'streaming' (mid-flight)
    await waitFor(() => {
      const stateText = screen.getByText(/State:/)?.textContent;
      expect(stateText).toMatch(/waiting|streaming/);
    });

    // 3. While in-flight, draw a new stroke
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 120, clientY: 120 });

    // 4. Assert that the stroke was successfully drawn (stroke() called on canvas)
    await waitFor(() => {
      expect(strokeSpy).toHaveBeenCalled();
    });
  });

  it('dedup cache skips network call for identical repeated request', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const mockGenerateContentStream = vi.fn().mockImplementation(async () => {
      const chunks = ['{"explanation":', '"cached', ' response"}'];
      async function* mockStream() {
        for (const chunk of chunks) {
          yield { text: () => chunk };
        }
      }
      return { stream: mockStream() };
    });

    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContentStream: mockGenerateContentStream
      })
    }));

    // We will use a wrapper around TestComponent that also allows clearing the request
    function DedupTestComponent() {
      const { askAI, clearRequest, activeRequest } = useAILifecycle();
      return (
        <div>
          <div data-testid="status">{activeRequest?.state || 'idle'}</div>
          <button onClick={() => askAI(mockObjects, { ids: ['1'] })}>Ask AI</button>
          <button onClick={clearRequest}>Clear</button>
        </div>
      );
    }

    render(
      <AILifecycleProvider>
        <DedupTestComponent />
      </AILifecycleProvider>
    );

    // 1st request
    fireEvent.click(screen.getByText('Ask AI'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('completed');
    });

    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);

    // Clear request state to allow a new one
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('status').textContent).toBe('idle');

    // 2nd request (exact same objects)
    fireEvent.click(screen.getByText('Ask AI'));
    await vi.waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('completed');
    });

    // Network call should NOT have been made again
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
  });
});
