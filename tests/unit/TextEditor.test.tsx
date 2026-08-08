import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TextEditor } from '../../src/components/TextEditor.tsx';

describe('TextEditor', () => {
  it('creates a correctly-typed text object when saved', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { getByText, getByRole } = render(
      <TextEditor
        initialBounds={{ minX: 10, minY: 10, maxX: 110, maxY: 60 }}
        viewport={{ offsetX: 0, offsetY: 0, zoom: 1 }}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const textarea = getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello World' } });

    fireEvent.click(getByText('Save'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const savedText = onComplete.mock.calls[0][0];

    expect(savedText.type).toBe('text');
    expect(savedText.text).toBe('Hello World');
    expect(savedText.bounds).toEqual({ minX: 10, minY: 10, maxX: 110, maxY: 60 });
    expect(typeof savedText.toAIPayload).toBe('function');
  });
});
