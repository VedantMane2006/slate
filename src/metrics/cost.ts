import type { UsageMetadata } from '@google/generative-ai';
import type { AIRequest } from '../ai/lifecycle/state-machine.ts';

export interface CostMetrics {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  estimated: boolean;
  costUsd: number;
}

// Pricing for gemini-flash-lite-latest (typical Flash-Lite models under 128k context)
// Prompt: $0.0375 per 1 million tokens
// Completion: $0.15 per 1 million tokens
const COST_PER_1M_PROMPT_TOKENS = 0.0375;
const COST_PER_1M_RESPONSE_TOKENS = 0.15;

/**
 * Derives token usage and cost for a completed AI request.
 * If exact usageMetadata is provided by the SDK, it uses that.
 * Otherwise, it estimates based on text length and image resolution.
 */
export function deriveTokenUsageAndCost(
  request: AIRequest,
  responseText: string,
  usageMetadata?: UsageMetadata
): CostMetrics {
  if (usageMetadata) {
    const promptTokens = usageMetadata.promptTokenCount;
    const responseTokens = usageMetadata.candidatesTokenCount;
    const totalTokens = usageMetadata.totalTokenCount;

    return {
      promptTokens,
      responseTokens,
      totalTokens,
      estimated: false,
      costUsd: computeCost(promptTokens, responseTokens)
    };
  }

  // --- ESTIMATION LOGIC ---
  // If the SDK did not return usageMetadata, we estimate it:
  // 1 token ~= 4 characters of text (standard heuristic).
  // Image tokens: derived from crop resolution. We estimate 1 token per 256 pixels (16x16 patch)
  // plus a base overhead of ~258 tokens for any image presence.

  let promptTextChars = 0;
  for (const frag of request.payload.fragments) {
    if (frag.kind === 'text') {
      promptTextChars += frag.data.length;
    } else if (frag.kind === 'json') {
      promptTextChars += JSON.stringify(frag.data).length;
    }
  }

  // Include an arbitrary 400 chars for system instructions & JSON schema overhead
  promptTextChars += 400;

  let estimatedPromptTokens = Math.ceil(promptTextChars / 4);

  // Estimate image tokens
  if (request.payload.image && request.contextBounds) {
    const width = Math.max(1, request.contextBounds.maxX - request.contextBounds.minX);
    const height = Math.max(1, request.contextBounds.maxY - request.contextBounds.minY);
    const pixels = width * height;
    
    const imageTokens = 258 + Math.ceil(pixels / 256);
    estimatedPromptTokens += imageTokens;
  } else if (request.payload.image) {
    // Fallback if we have an image but somehow no bounds
    estimatedPromptTokens += 258;
  }

  const estimatedResponseTokens = Math.ceil(responseText.length / 4);

  return {
    promptTokens: estimatedPromptTokens,
    responseTokens: estimatedResponseTokens,
    totalTokens: estimatedPromptTokens + estimatedResponseTokens,
    estimated: true,
    costUsd: computeCost(estimatedPromptTokens, estimatedResponseTokens)
  };
}

function computeCost(promptTokens: number, responseTokens: number): number {
  const promptCost = (promptTokens / 1_000_000) * COST_PER_1M_PROMPT_TOKENS;
  const responseCost = (responseTokens / 1_000_000) * COST_PER_1M_RESPONSE_TOKENS;
  return promptCost + responseCost;
}
