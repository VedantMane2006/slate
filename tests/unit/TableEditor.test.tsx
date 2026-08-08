import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TableEditor } from '../../src/components/TableEditor.tsx';

describe('TableEditor', () => {
  it('creates a correctly-typed table object when saved', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { getByText, getAllByRole } = render(
      <TableEditor
        initialBounds={{ minX: 0, minY: 0, maxX: 100, maxY: 100 }}
        viewport={{ offsetX: 0, offsetY: 0, zoom: 1 }}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const inputs = getAllByRole('textbox');
    expect(inputs).toHaveLength(4); // 2x2 grid

    fireEvent.change(inputs[0], { target: { value: 'Header 1' } });
    fireEvent.change(inputs[3], { target: { value: 'Data 2' } });

    fireEvent.click(getByText('Save'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const savedTable = onComplete.mock.calls[0][0];

    expect(savedTable.type).toBe('table');
    expect(savedTable.cells).toEqual([
      ['Header 1', ''],
      ['', 'Data 2']
    ]);
    expect(savedTable.bounds).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(typeof savedTable.toAIPayload).toBe('function');
  });
});
