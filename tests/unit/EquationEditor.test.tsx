import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EquationEditor } from '../../src/components/EquationEditor.tsx';

describe('EquationEditor', () => {
  it('creates a correctly-typed equation object when saved', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { getByText, getByRole } = render(
      <EquationEditor
        initialBounds={{ minX: 50, minY: 50, maxX: 150, maxY: 80 }}
        viewport={{ offsetX: 0, offsetY: 0, zoom: 1 }}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'E = mc^2' } });

    fireEvent.click(getByText('Save'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const savedEquation = onComplete.mock.calls[0][0];

    expect(savedEquation.type).toBe('equation');
    expect(savedEquation.latex).toBe('E = mc^2');
    expect(savedEquation.bounds).toEqual({ minX: 50, minY: 50, maxX: 150, maxY: 80 });
    expect(typeof savedEquation.toAIPayload).toBe('function');
  });
});
