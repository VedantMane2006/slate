import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasViewport } from '../../src/canvas/CanvasViewport.tsx';
import { AILifecycleProvider } from '../../src/providers/AILifecycleProvider.tsx';
import { MetricsProvider } from '../../src/providers/MetricsProvider.tsx';

// Mock the canvas rendering and ResizeObserver since we are running in JSDOM
vi.mock('../../src/canvas/renderer.ts', () => ({
  renderStrokes: vi.fn(),
  renderDraftObjects: vi.fn(),
  renderCrop: vi.fn(() => 'data:image/png;base64,mock')
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// We just test if the editor components are mounted when the button is clicked.
describe('CanvasViewport Toolbar', () => {
  it('opens TextEditor when Insert Text is clicked', () => {
    render(
      <MetricsProvider>
        <AILifecycleProvider>
          <CanvasViewport />
        </AILifecycleProvider>
      </MetricsProvider>
    );

    const btn = screen.getByTitle('Insert Text');
    fireEvent.click(btn);

    // TextEditor renders a textarea
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('opens TableEditor when Insert Table is clicked', () => {
    render(
      <MetricsProvider>
        <AILifecycleProvider>
          <CanvasViewport />
        </AILifecycleProvider>
      </MetricsProvider>
    );

    const btn = screen.getByTitle('Insert Table');
    fireEvent.click(btn);

    // TableEditor renders inputs for cells (by default 2x2, so at least one input should be found)
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders all sidebar action buttons and handles clicks', () => {
    render(
      <MetricsProvider>
        <AILifecycleProvider>
          <CanvasViewport />
        </AILifecycleProvider>
      </MetricsProvider>
    );

    // Verify all buttons exist by their accessible title/text
    const drawBtn = screen.getByTitle('Draw (D)');
    const eraseBtn = screen.getByTitle('Erase (E)');
    const selectBtn = screen.getByTitle('Select (V)');
    const undoBtn = screen.getByTitle('Undo (Ctrl+Z)');
    const redoBtn = screen.getByTitle('Redo (Ctrl+Shift+Z)');
    const zoomInBtn = screen.getByTitle('Zoom In (Wheel Up)');
    const zoomOutBtn = screen.getByTitle('Zoom Out (Wheel Down)');

    expect(drawBtn).toBeInTheDocument();
    expect(eraseBtn).toBeInTheDocument();
    expect(selectBtn).toBeInTheDocument();
    expect(undoBtn).toBeInTheDocument();
    expect(redoBtn).toBeInTheDocument();
    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();

    // Click them to ensure no crashes and basic state toggles
    fireEvent.click(eraseBtn);
    expect(eraseBtn).toHaveStyle('background: #e9ecef'); // Active state
    
    fireEvent.click(selectBtn);
    expect(selectBtn).toHaveStyle('background: #e9ecef');
    expect(eraseBtn).not.toHaveStyle('background: #e9ecef');

    fireEvent.click(drawBtn);
    expect(drawBtn).toHaveStyle('background: #e9ecef');
    expect(selectBtn).not.toHaveStyle('background: #e9ecef');

    // Click others to ensure no errors
    fireEvent.click(undoBtn);
    fireEvent.click(redoBtn);
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
  });
});
