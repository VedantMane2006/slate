import { describe, it, expect } from 'vitest';
import { createImage, type ImageObject } from '../../src/objects/image.ts';

describe('ImageObject', () => {
  it('toAIPayload returns correct image shape', () => {
    const imageObj = createImage(
      'img-1',
      { minX: 10, minY: 10, maxX: 100, maxY: 100 },
      'data:image/png;base64,iVBORw0K...'
    );

    const payload = imageObj.toAIPayload();
    expect(payload).toEqual({
      kind: 'image',
      data: 'data:image/png;base64,iVBORw0K...'
    });
  });

  it('round-trips correctly through JSON.stringify/parse', () => {
    const imageObj = createImage(
      'img-2',
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      'data:image/jpeg;base64,abc...'
    );

    const serialized = JSON.stringify(imageObj);
    const parsedImage: ImageObject = JSON.parse(serialized);

    expect(parsedImage).toEqual(imageObj);
    expect(parsedImage.id).toBe('img-2');
    expect(parsedImage.type).toBe('image');
    expect(parsedImage.dataUrl).toBe('data:image/jpeg;base64,abc...');
    expect(parsedImage.bounds).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
  });
});
