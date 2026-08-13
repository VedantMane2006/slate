import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftCard } from '../../src/components/DraftCard.tsx';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';

// Mock the renderers so we don't have to deal with KaTeX/DOMPurify intricacies in this component test
vi.mock('../../src/ai/rendering/renderers.tsx', () => ({
  renderMarkdown: (t: string) => <div data-testid="mock-markdown">{t}</div>,
  renderLatex: (t: string) => <div data-testid="mock-latex">{t}</div>,
  renderTable: () => <div data-testid="mock-table">Table</div>,
  renderGraph: () => <div data-testid="mock-graph">Graph</div>,
}));

describe('DraftCard', () => {
  const mockViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  const mockRoiBounds = { minX: 100, minY: 100, maxX: 200, maxY: 200 };
  
  const validRequest: AIRequest = {
    id: '1',
    state: 'completed',
    payload: { image: '', fragments: [] },
    timestamps: {},
    configId: 'default',
    promptVersion: '1.0.0',
    confidenceLevel: 'high',
    parsedData: {
      explanation: 'Test Explanation',
      latex: 'E=mc^2',
      table: [['A'], ['1']],
      graph: { type: 'bar', labels: ['X'], values: [1] }
    }
  };

  const errorRequest: AIRequest = {
    id: '2',
    state: 'error',
    payload: { image: '', fragments: [] },
    timestamps: {},
    configId: 'default',
    promptVersion: '1.0.0',
    confidenceLevel: 'high',
    error: 'Simulated failure'
  };

  it('renders explanation, latex, table, and graph for a valid AIOutputSchema', () => {
    render(
      <DraftCard 
        request={validRequest} 
        viewport={mockViewport} 
        roiBounds={mockRoiBounds}
        onAccept={() => {}}
        onDiscard={() => {}}
      />
    );
    
    expect(screen.getByTestId('mock-markdown').textContent).toBe('Test Explanation');
    expect(screen.getByTestId('mock-latex').textContent).toBe('E=mc^2');
    expect(screen.getByTestId('mock-table')).not.toBeNull();
    expect(screen.getByTestId('mock-graph')).not.toBeNull();
    expect(screen.getByText('Accept')).not.toBeNull();
    expect(screen.getByText('Discard')).not.toBeNull();
  });

  it('renders the honest-failure message for an error state, not a blank card', () => {
    render(
      <DraftCard 
        request={errorRequest} 
        viewport={mockViewport} 
        roiBounds={mockRoiBounds}
        onAccept={() => {}}
        onDiscard={() => {}}
      />
    );
    
    expect(screen.getByText('Error: Simulated failure')).not.toBeNull();
    expect(screen.queryByText('Accept')).toBeNull(); // Shouldn't have accept button for error
    expect(screen.getByText('Discard')).not.toBeNull();
  });

  it('card position updates correctly when the viewport (pan/zoom) changes', () => {
    const { rerender, container } = render(
      <DraftCard 
        request={validRequest} 
        viewport={mockViewport} 
        roiBounds={mockRoiBounds}
        onAccept={() => {}}
        onDiscard={() => {}}
      />
    );
    
    const card1 = container.querySelector('[data-testid="draft-card"]') as HTMLElement;
    const initialLeft = card1.style.left;
    const initialTop = card1.style.top;

    // Pan the viewport by 100px and zoom by 2x
    const zoomedViewport = { offsetX: 100, offsetY: 100, zoom: 2 };
    rerender(
      <DraftCard 
        request={validRequest} 
        viewport={zoomedViewport} 
        roiBounds={mockRoiBounds}
        onAccept={() => {}}
        onDiscard={() => {}}
      />
    );

    const card2 = container.querySelector('[data-testid="draft-card"]') as HTMLElement;
    expect(card2.style.left).not.toBe(initialLeft);
    expect(card2.style.top).not.toBe(initialTop);
  });
});
