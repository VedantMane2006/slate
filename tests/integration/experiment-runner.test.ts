// @vitest-environment jsdom
/**
 * Experiment Runner: Adaptive vs Fixed Resolution Comparison
 *
 * Runs each of the 2 benchmark canvases through the real Gemini pipeline twice:
 *   1. Adaptive resolution (Phase 11 default)
 *   2. Fixed 1024px resolution (override via FORCE_FIXED_RESOLUTION)
 *
 * Total: 4 real Gemini API calls.
 * Results are written to /experiments/results.json.
 *
 * Phase 13 Part 2 captured latency only.
 * This update adds token/cost estimation via Phase 9's deriveTokenUsageAndCost.
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deserializeCanvas } from '../../src/persistence/serialization.ts';
import { extractContext } from '../../src/context-extraction/extractor.ts';
import { composeMultimodalRequest } from '../../src/ai/composition.ts';
import { setForceFixedResolution } from '../../src/config/experiment.ts';
import { CURRENT_EXPERIMENT_CONFIG } from '../../src/config/experiment.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UsageMetadata } from '@google/generative-ai';
import type { CanvasObject } from '../../src/objects/canvas-object.ts';
import { deriveTokenUsageAndCost } from '../../src/metrics/cost.ts';
import type { AIRequest } from '../../src/ai/lifecycle/state-machine.ts';
import type { MultimodalRequestPayload } from '../../src/ai/composition.ts';
import type { BoundingBox } from '../../src/utils/geometry.ts';

// Mock renderCrop — we need a small but valid base64 PNG for Gemini to accept
// We produce a tiny 1x1 white pixel PNG as a data URL
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
vi.mock('../../src/canvas/renderer.ts', () => ({
  renderCrop: vi.fn(() => TINY_PNG)
}));

// Read API key from .env file directly since import.meta.env isn't available in test context for non-Vite modules
const envPath = path.resolve(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : '';

interface ExperimentRun {
  benchmark: string;
  config: 'adaptive' | 'fixed-1024';
  resolution: number;
  objectCount: number;
  inkDensity: number;
  endToEndLatencyMs: number;
  responseLength: number;
  apiCallSuccess: boolean;
  configId: string;
  promptVersion: string;
  estimatedPromptTokens: number;
  estimatedResponseTokens: number;
  estimatedTotalTokens: number;
  estimatedCostUsd: number;
  tokenEstimationMethod: 'sdk' | 'heuristic';
  error?: string;
}

interface ExperimentResults {
  experiment: string;
  timestamp: string;
  apiCallCount: number;
  runs: ExperimentRun[];
}

interface GeminiResponse {
  text: string;
  latencyMs: number;
  usageMetadata?: UsageMetadata;
}

async function sendToGemini(imageDataUrl: string, fragments: Array<{ kind: string; data: string }>): Promise<GeminiResponse> {
  const ai = new GoogleGenerativeAI(API_KEY);
  const model = ai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are an AI assistant analyzing a user's canvas.
Your job is to ANSWER or SOLVE the question, problem, or prompt shown in the image and fragments you receive.
Do NOT simply describe what the image looks like. If the image shows a math problem, compute and provide the actual answer.
The 'explanation' field should contain this actual answer or solution.
You must respond ONLY with valid JSON matching the following schema.
Do not include any prose outside the JSON.
Schema:
{
  "explanation": "string",
  "latex": "string (optional)",
  "table": [["string"]] (optional),
  "graph": { "type": "bar" | "line", "labels": ["string"], "values": [number] } (optional)
}`,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Add a generic prompt since benchmark canvases are just strokes with no text
  parts.push({ text: 'Analyze this canvas content and describe what you see.' });

  for (const frag of fragments) {
    if (frag.kind === 'text') {
      parts.push({ text: frag.data });
    } else if (frag.kind === 'json') {
      parts.push({ text: JSON.stringify(frag.data) });
    }
  }

  // Add image
  const match = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (match) {
    parts.push({
      inlineData: {
        mimeType: match[1],
        data: match[2]
      }
    });
  }

  const startMs = Date.now();
  const result = await model.generateContent(parts);
  const latencyMs = Date.now() - startMs;
  const text = result.response.text();
  const usageMetadata = result.response.usageMetadata;

  return { text, latencyMs, usageMetadata };
}

/**
 * Constructs a minimal AIRequest sufficient for deriveTokenUsageAndCost's estimation path.
 * Only the fields accessed by the cost function are populated.
 */
function buildMinimalAIRequest(
  payload: MultimodalRequestPayload,
  contextBounds: BoundingBox | null
): AIRequest {
  return {
    id: 'experiment-run',
    state: 'completed',
    payload,
    timestamps: {},
    configId: CURRENT_EXPERIMENT_CONFIG.configId,
    promptVersion: CURRENT_EXPERIMENT_CONFIG.promptVersion,
    confidenceLevel: 'high',
    contextBounds
  };
}

async function runSingleBenchmark(
  benchmarkName: string,
  objects: CanvasObject[],
  configLabel: 'adaptive' | 'fixed-1024'
): Promise<ExperimentRun> {
  // Set the resolution mode
  if (configLabel === 'fixed-1024') {
    setForceFixedResolution(1024);
  } else {
    setForceFixedResolution(null);
  }

  // Extract context — select all objects
  const selection = { ids: objects.map(o => o.id) };
  const extraction = extractContext(objects, selection, Date.now());

  // Compose the multimodal request
  const { payload, metadata } = composeMultimodalRequest(extraction, objects);

  const run: ExperimentRun = {
    benchmark: benchmarkName,
    config: configLabel,
    resolution: metadata.resolution,
    objectCount: metadata.imageObjectCount,
    inkDensity: Math.round(metadata.inkDensity * 10000) / 10000,
    endToEndLatencyMs: 0,
    responseLength: 0,
    apiCallSuccess: false,
    configId: CURRENT_EXPERIMENT_CONFIG.configId,
    promptVersion: CURRENT_EXPERIMENT_CONFIG.promptVersion,
    estimatedPromptTokens: 0,
    estimatedResponseTokens: 0,
    estimatedTotalTokens: 0,
    estimatedCostUsd: 0,
    tokenEstimationMethod: 'heuristic'
  };

  try {
    const { text, latencyMs, usageMetadata } = await sendToGemini(
      payload.image,
      payload.fragments as Array<{ kind: string; data: string }>
    );
    run.endToEndLatencyMs = latencyMs;
    run.responseLength = text.length;
    run.apiCallSuccess = true;

    // Derive token/cost metrics using Phase 9's deriveTokenUsageAndCost
    const minimalRequest = buildMinimalAIRequest(payload, extraction.bounds);
    const costMetrics = deriveTokenUsageAndCost(minimalRequest, text, usageMetadata);

    run.estimatedPromptTokens = costMetrics.promptTokens;
    run.estimatedResponseTokens = costMetrics.responseTokens;
    run.estimatedTotalTokens = costMetrics.totalTokens;
    run.estimatedCostUsd = costMetrics.costUsd;
    run.tokenEstimationMethod = costMetrics.estimated ? 'heuristic' : 'sdk';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    run.error = message;
    run.apiCallSuccess = false;
  }

  return run;
}

describe('Experiment: Adaptive vs Fixed Resolution (with token/cost)', () => {
  const benchmarkDir = path.resolve(__dirname, '../../benchmarks');
  const resultsDir = path.resolve(__dirname, '../../experiments');
  const resultsPath = path.join(resultsDir, 'results.json');

  const allRuns: ExperimentRun[] = [];
  let apiCallCount = 0;

  it('has a valid API key configured', () => {
    expect(API_KEY.length).toBeGreaterThan(10);
  });

  it('runs sparse benchmark with adaptive resolution', async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'sparse.json'), 'utf-8'));
    const objects = deserializeCanvas(raw);
    const run = await runSingleBenchmark('sparse', objects, 'adaptive');
    allRuns.push(run);
    apiCallCount++;
    expect(run.apiCallSuccess).toBe(true);
    // Sparse + adaptive should NOT pick 1024 (should pick 512)
    expect(run.resolution).toBe(512);
    // Token/cost fields must be populated
    expect(run.estimatedTotalTokens).toBeGreaterThan(0);
    expect(run.estimatedCostUsd).toBeGreaterThan(0);
  }, 60000);

  it('runs sparse benchmark with fixed-1024 resolution', async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'sparse.json'), 'utf-8'));
    const objects = deserializeCanvas(raw);
    const run = await runSingleBenchmark('sparse', objects, 'fixed-1024');
    allRuns.push(run);
    apiCallCount++;
    expect(run.apiCallSuccess).toBe(true);
    expect(run.resolution).toBe(1024);
    expect(run.estimatedTotalTokens).toBeGreaterThan(0);
    expect(run.estimatedCostUsd).toBeGreaterThan(0);
  }, 60000);

  it('runs dense benchmark with adaptive resolution', async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'dense.json'), 'utf-8'));
    const objects = deserializeCanvas(raw);
    const run = await runSingleBenchmark('dense', objects, 'adaptive');
    allRuns.push(run);
    apiCallCount++;
    expect(run.apiCallSuccess).toBe(true);
    // Dense + adaptive should pick 1536 (many overlapping objects, high density)
    expect(run.resolution).toBe(1536);
    expect(run.estimatedTotalTokens).toBeGreaterThan(0);
    expect(run.estimatedCostUsd).toBeGreaterThan(0);
  }, 60000);

  it('runs dense benchmark with fixed-1024 resolution', async () => {
    const raw = JSON.parse(fs.readFileSync(path.join(benchmarkDir, 'dense.json'), 'utf-8'));
    const objects = deserializeCanvas(raw);
    const run = await runSingleBenchmark('dense', objects, 'fixed-1024');
    allRuns.push(run);
    apiCallCount++;
    expect(run.apiCallSuccess).toBe(true);
    expect(run.resolution).toBe(1024);
    expect(run.estimatedTotalTokens).toBeGreaterThan(0);
    expect(run.estimatedCostUsd).toBeGreaterThan(0);
  }, 60000);

  afterAll(() => {
    // Reset override
    setForceFixedResolution(null);

    // Write results — extend existing records with new token/cost fields
    if (allRuns.length === 4) {
      const results: ExperimentResults = {
        experiment: 'adaptive-vs-fixed-resolution',
        timestamp: new Date().toISOString(),
        apiCallCount,
        runs: allRuns
      };

      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`\n✅ Experiment results written to ${resultsPath}`);
      console.log(`   Total API calls: ${apiCallCount}`);
      for (const run of allRuns) {
        console.log(`   ${run.benchmark}/${run.config}: ${run.resolution}px, ${run.endToEndLatencyMs}ms, ${run.estimatedTotalTokens} tokens, $${run.estimatedCostUsd.toFixed(6)}, method=${run.tokenEstimationMethod}`);
      }
    }
  });
});
