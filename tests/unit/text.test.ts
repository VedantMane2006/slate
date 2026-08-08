import { describe, it, expect } from 'vitest';
import { createText, type TextObject } from '../../src/objects/text.ts';

describe('TextObject', () => {
  it('toAIPayload returns correct text shape', () => {
    const textObj = createText(
      'text-1',
      { minX: 10, minY: 10, maxX: 100, maxY: 100 },
      'Hello world'
    );

    const payload = textObj.toAIPayload();
    expect(payload).toEqual({
      kind: 'text',
      data: 'Hello world'
    });
  });

  it('round-trips correctly through JSON.stringify/parse', () => {
    const textObj = createText(
      'text-2',
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      'Testing'
    );

    const serialized = JSON.stringify(textObj);
    const parsedText: TextObject = JSON.parse(serialized);

    expect(parsedText).toEqual(textObj);
    expect(parsedText.id).toBe('text-2');
    expect(parsedText.type).toBe('text');
    expect(parsedText.text).toBe('Testing');
    expect(parsedText.bounds).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
  });
});
