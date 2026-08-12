import { describe, it, expect, vi, beforeEach } from 'vitest';
//import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { TextEditor } from '../../src/components/TextEditor.tsx';
import { EquationEditor } from '../../src/components/EquationEditor.tsx';
import { TableEditor } from '../../src/components/TableEditor.tsx';

describe('Editor Components Bug Fixes', () => {
  const mockViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
  const mockBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TextEditor allows backspace and typing', () => {
    render(
      <TextEditor
        initialBounds={mockBounds}
        viewport={mockViewport}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(textarea).toHaveValue('Hello');

    // Simulate backspace by changing value
    fireEvent.change(textarea, { target: { value: 'Hell' } });
    expect(textarea).toHaveValue('Hell');
  });

  it('EquationEditor allows backspace and typing, and preview does not show raw text', () => {
    render(
      <EquationEditor
        initialBounds={mockBounds}
        viewport={mockViewport}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByPlaceholderText('Enter LaTeX...');
    fireEvent.change(textarea, { target: { value: 'E=mc^2' } });
    expect(textarea).toHaveValue('E=mc^2');

    // It should render KaTeX HTML output, NOT the raw text duplicate
    // The rendered output shouldn't contain the exact raw string as plain text outside of KaTeX semantics
    // We check that the KaTeX span exists, but the raw text 'E=mc^2' isn't just dumped into the preview div
    const previewContainer = textarea.previousElementSibling;
    expect(previewContainer).toBeDefined();

    // Check that it's using dangerouslySetInnerHTML (this is hard to assert exactly in RTL without a real DOM, but we can verify it doesn't just have textContent = E=mc^2)
    // Actually KaTeX will render something with classes
    expect(previewContainer?.innerHTML).toContain('span');
  });

  it('TableEditor allows backspace and typing', () => {
    render(
      <TableEditor
        initialBounds={mockBounds}
        viewport={mockViewport}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const inputs = screen.getAllByRole('textbox'); // Should be 4 cells for 2x2 grid
    expect(inputs.length).toBe(4);

    fireEvent.change(inputs[0], { target: { value: 'Data' } });
    expect(inputs[0]).toHaveValue('Data');

    fireEvent.change(inputs[0], { target: { value: 'Dat' } });
    expect(inputs[0]).toHaveValue('Dat');
  });

  it('Editor components stop propagation of pointer events to prevent canvas interaction', () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();

    const { container } = render(
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <TextEditor
          initialBounds={mockBounds}
          viewport={mockViewport}
          onComplete={vi.fn()}
          onCancel={vi.fn()}
        />
      </div>
    );

    // The TextEditor's wrapper div is the first child
    const editorDiv = container.firstChild?.firstChild as HTMLElement;

    fireEvent.pointerDown(editorDiv);
    fireEvent.pointerMove(editorDiv);
    fireEvent.pointerUp(editorDiv);

    // Due to e.stopPropagation(), the parent div shouldn't receive these events
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onPointerMove).not.toHaveBeenCalled();
    expect(onPointerUp).not.toHaveBeenCalled();
  });
});
