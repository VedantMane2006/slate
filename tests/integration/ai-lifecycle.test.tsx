import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AILifecycleProvider, useAILifecycle } from '../../src/providers/AILifecycleProvider.tsx';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

// Mock Gemini SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContentStream: vi.fn().mockImplementation(async () => {
            const chunks = ['mocked', ' AI', ' response'];
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
  { id: '1', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, timestamp: Date.now(), type: 'stroke' } as any
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

    expect(consoleSpy).toHaveBeenCalledWith('AI Response:', 'mocked AI response');
    
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
});
