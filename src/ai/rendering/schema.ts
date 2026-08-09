export interface AIOutputSchema {
  explanation: string;
  latex?: string;
  table?: string[][];
  graph?: {
    type: 'bar' | 'line';
    labels: string[];
    values: number[];
  };
}

export type ValidationResult =
  | { valid: true; data: AIOutputSchema }
  | { valid: false; error: string };

// We chose hand-written type guards here instead of Zod to keep the dependency footprint small,
// especially since the schema is relatively flat and well-defined.
export function validateAIOutput(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, error: 'Input must be a non-null object' };
  }

  const obj = raw as Record<string, unknown>;

  // Validate 'explanation' (required string)
  if (typeof obj.explanation !== 'string') {
    return { valid: false, error: 'Missing or invalid required field: explanation must be a string' };
  }

  const result: AIOutputSchema = {
    explanation: obj.explanation,
  };

  // Validate 'latex' (optional string)
  if (obj.latex !== undefined) {
    if (typeof obj.latex !== 'string') {
      return { valid: false, error: 'Field latex must be a string if provided' };
    }
    result.latex = obj.latex;
  }

  // Validate 'table' (optional string[][])
  if (obj.table !== undefined) {
    if (!Array.isArray(obj.table)) {
      return { valid: false, error: 'Field table must be a 2D array of strings' };
    }
    for (let i = 0; i < obj.table.length; i++) {
      const row = obj.table[i];
      if (!Array.isArray(row)) {
        return { valid: false, error: `Field table row ${i} must be an array` };
      }
      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] !== 'string') {
          return { valid: false, error: `Field table cell [${i}][${j}] must be a string` };
        }
      }
    }
    result.table = obj.table;
  }

  // Validate 'graph' (optional)
  if (obj.graph !== undefined) {
    if (typeof obj.graph !== 'object' || obj.graph === null) {
      return { valid: false, error: 'Field graph must be an object if provided' };
    }
    const graphObj = obj.graph as Record<string, unknown>;

    if (graphObj.type !== 'bar' && graphObj.type !== 'line') {
      return { valid: false, error: "Graph type must be 'bar' or 'line'" };
    }
    
    if (!Array.isArray(graphObj.labels) || !graphObj.labels.every((l) => typeof l === 'string')) {
      return { valid: false, error: 'Graph labels must be an array of strings' };
    }

    if (!Array.isArray(graphObj.values) || !graphObj.values.every((v) => typeof v === 'number')) {
      return { valid: false, error: 'Graph values must be an array of numbers' };
    }

    result.graph = {
      type: graphObj.type,
      labels: graphObj.labels,
      values: graphObj.values,
    };
  }

  return { valid: true, data: result };
}
