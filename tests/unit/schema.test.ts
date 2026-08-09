import { describe, it, expect } from 'vitest';
import { validateAIOutput, type AIOutputSchema } from '../../src/ai/rendering/schema.ts';

describe('validateAIOutput', () => {
  it('accepts a well-formed response matching the schema (explanation only)', () => {
    const raw = { explanation: 'This is a test.' };
    const result = validateAIOutput(raw);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.explanation).toBe('This is a test.');
    }
  });

  it('accepts a well-formed response matching the full schema', () => {
    const raw: AIOutputSchema = {
      explanation: 'Full test',
      latex: '\\frac{1}{2}',
      table: [['A', 'B'], ['1', '2']],
      graph: {
        type: 'bar',
        labels: ['Jan', 'Feb'],
        values: [10, 20]
      }
    };
    const result = validateAIOutput(raw);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual(raw);
    }
  });

  it('rejects completely empty or non-object inputs', () => {
    expect(validateAIOutput(null).valid).toBe(false);
    expect(validateAIOutput('string').valid).toBe(false);
    expect(validateAIOutput(123).valid).toBe(false);
  });

  it('rejects malformed: missing explanation', () => {
    const raw = { latex: 'x=2' };
    const result = validateAIOutput(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/missing or invalid required field/i);
    }
  });

  it('rejects malformed: explanation is wrong type', () => {
    const raw = { explanation: 123 };
    const result = validateAIOutput(raw);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/explanation must be a string/i);
    }
  });

  it('rejects malformed: table is garbage JSON (not 2D string array)', () => {
    const raw1 = { explanation: 'test', table: ['not', '2d'] };
    const result1 = validateAIOutput(raw1);
    expect(result1.valid).toBe(false);
    if (!result1.valid) {
      expect(result1.error).toMatch(/must be an array/i);
    }

    const raw2 = { explanation: 'test', table: [['str', 123]] };
    const result2 = validateAIOutput(raw2);
    expect(result2.valid).toBe(false);
    if (!result2.valid) {
      expect(result2.error).toMatch(/must be a string/i);
    }
  });

  it('rejects malformed: graph has wrong type or mismatched contents', () => {
    const raw1 = { explanation: 'test', graph: { type: 'pie', labels: [], values: [] } };
    const result1 = validateAIOutput(raw1);
    expect(result1.valid).toBe(false);
    if (!result1.valid) {
      expect(result1.error).toMatch(/Graph type must be/i);
    }

    const raw2 = { explanation: 'test', graph: { type: 'bar', labels: [1, 2], values: [10, 20] } };
    const result2 = validateAIOutput(raw2);
    expect(result2.valid).toBe(false);
    if (!result2.valid) {
      expect(result2.error).toMatch(/labels must be an array of strings/i);
    }
  });
});
