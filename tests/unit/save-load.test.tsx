import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveLoadControls } from '../../src/components/SaveLoadControls.tsx';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';

describe('SaveLoadControls', () => {
  let mockRevokeObjectURL: any;
  let mockCreateObjectURL: any;
  const originalURL = window.URL;
  let originalFileReader: any;

  beforeEach(() => {
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    mockRevokeObjectURL = vi.fn();
    (window as any).URL = {
      ...originalURL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    };
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    originalFileReader = window.FileReader;
  });

  afterEach(() => {
    (window as any).URL = originalURL;
    (window as any).FileReader = originalFileReader;
    vi.restoreAllMocks();
  });

  const dummyObject: CanvasObject = {
    id: 'test-obj',
    type: 'text' as any,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }
  };

  it('triggers a download with correctly shaped JSON on Save', () => {
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement.call(document, tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

    const dummyViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    render(<SaveLoadControls objects={[dummyObject]} viewport={dummyViewport} onLoadSuccess={vi.fn()} />);
    
    fireEvent.click(screen.getByTestId('save-button'));
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('application/json');
    expect(mockClick).toHaveBeenCalled();
  });

  it('correctly replaces canvas state on successful Load', async () => {
    const mockOnLoadSuccess = vi.fn();
    const dummyViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    render(<SaveLoadControls objects={[]} viewport={dummyViewport} onLoadSuccess={mockOnLoadSuccess} />);
    
    const validJson = JSON.stringify({
      version: '1.0.0',
      objects: [{ id: 'loaded-1', type: 'text', bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, text: 'hello' }]
    });
    
    const file = new File([validJson], 'test.json', { type: 'application/json' });
    const input = screen.getByTestId('load-input');
    
    window.FileReader = class {
      onload: any;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: validJson } });
        }
      }
    } as any;

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnLoadSuccess).toHaveBeenCalledTimes(1);
    const passedObjects = mockOnLoadSuccess.mock.calls[0][0];
    expect(passedObjects.length).toBe(1);
    expect(passedObjects[0].id).toBe('loaded-1');
    expect(passedObjects[0].type).toBe('text');
  });

  it('shows an error and leaves existing canvas unchanged on malformed Load', () => {
    const mockOnLoadSuccess = vi.fn();
    const dummyViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    render(<SaveLoadControls objects={[dummyObject]} viewport={dummyViewport} onLoadSuccess={mockOnLoadSuccess} />);
    
    const invalidJson = "this is not json";
    const file = new File([invalidJson], 'test.json', { type: 'application/json' });
    const input = screen.getByTestId('load-input');
    
    window.FileReader = class {
      onload: any;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: invalidJson } });
        }
      }
    } as any;

    fireEvent.change(input, { target: { files: [file] } });

    expect(window.alert).toHaveBeenCalled();
    expect(mockOnLoadSuccess).not.toHaveBeenCalled();
  });
  
  it('shows an error on invalid schema Load', () => {
    const mockOnLoadSuccess = vi.fn();
    const dummyViewport = { offsetX: 0, offsetY: 0, zoom: 1 };
    render(<SaveLoadControls objects={[]} viewport={dummyViewport} onLoadSuccess={mockOnLoadSuccess} />);
    
    const invalidSchemaJson = JSON.stringify({
      version: '999.0.0', // wrong version
      objects: []
    });
    const file = new File([invalidSchemaJson], 'test.json', { type: 'application/json' });
    const input = screen.getByTestId('load-input');
    
    window.FileReader = class {
      onload: any;
      readAsText() {
        if (this.onload) {
          this.onload({ target: { result: invalidSchemaJson } });
        }
      }
    } as any;

    fireEvent.change(input, { target: { files: [file] } });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Unsupported canvas version'));
    expect(mockOnLoadSuccess).not.toHaveBeenCalled();
  });
});
