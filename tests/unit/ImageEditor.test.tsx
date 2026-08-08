import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ImageEditor } from '../../src/components/ImageEditor.tsx';

describe('ImageEditor', () => {
  let originalFileReader: typeof FileReader;

  beforeAll(() => {
    originalFileReader = globalThis.FileReader;
    class MockFileReader {
      onload: ((this: MockFileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL(_file: File) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: 'data:image/png;base64,mocked' } } as unknown as ProgressEvent<FileReader>);
          }
        }, 10);
      }
    }
    (globalThis as unknown as { FileReader: typeof MockFileReader }).FileReader = MockFileReader;
  });

  afterAll(() => {
    globalThis.FileReader = originalFileReader;
  });

  it('creates a correctly-typed image object when saved', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const { getByText, container } = render(
      <ImageEditor
        initialBounds={{ minX: 20, minY: 20, maxX: 120, maxY: 120 }}
        viewport={{ offsetX: 0, offsetY: 0, zoom: 1 }}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByText('Save')).not.toBeDisabled();
    });

    fireEvent.click(getByText('Save'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const savedImage = onComplete.mock.calls[0][0];

    expect(savedImage.type).toBe('image');
    expect(savedImage.dataUrl).toBe('data:image/png;base64,mocked');
    expect(savedImage.bounds).toEqual({ minX: 20, minY: 20, maxX: 120, maxY: 120 });
    expect(typeof savedImage.toAIPayload).toBe('function');
  });
});
