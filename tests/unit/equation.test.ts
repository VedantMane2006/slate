import { describe, it, expect } from 'vitest';
import { createEquation, type EquationObject } from '../../src/objects/equation.ts';

describe('EquationObject', () => {
  it('toAIPayload returns correct text shape', () => {
    const equationObj = createEquation(
      'eq-1',
      { minX: 10, minY: 10, maxX: 100, maxY: 100 },
      'E = mc^2'
    );

    const payload = equationObj.toAIPayload();
    expect(payload).toEqual({
      kind: 'text',
      data: 'E = mc^2'
    });
  });

  it('round-trips correctly through JSON.stringify/parse', () => {
    const equationObj = createEquation(
      'eq-2',
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      '\\frac{1}{2}'
    );

    const serialized = JSON.stringify(equationObj);
    const parsedEquation: EquationObject = JSON.parse(serialized);

    expect(parsedEquation).toEqual(equationObj);
    expect(parsedEquation.id).toBe('eq-2');
    expect(parsedEquation.type).toBe('equation');
    expect(parsedEquation.latex).toBe('\\frac{1}{2}');
    expect(parsedEquation.bounds).toEqual({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
  });
});
