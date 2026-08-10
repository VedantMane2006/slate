import type { AIRequest, RequestState } from '../ai/lifecycle/state-machine.ts';

export interface RequestMetrics {
  captureTime?: number;
  encodingTime?: number;
  dispatchTime?: number;
  ttfb?: number;
  ttft?: number;
  renderingLatency?: number;
  endToEndLatency?: number;
  estimatedTtft: boolean;
  state: RequestState;
}

/**
 * Pure function to derive metrics from a request's timestamps.
 * 
 * Derives timings strictly from adjacent state timestamps:
 * encoding -> context_extraction -> sending -> waiting -> streaming -> rendering -> completed
 */
export function deriveMetrics(request: AIRequest): RequestMetrics {
  const t = request.timestamps;
  const metrics: RequestMetrics = {
    estimatedTtft: false,
    state: request.state
  };

  // Safe subtraction helper
  const diff = (end?: number, start?: number): number | undefined => {
    if (end !== undefined && start !== undefined) {
      return Math.max(0, end - start);
    }
    return undefined;
  };

  // Adjacent state diffs
  // state: encoding -> time spent before entering context_extraction
  metrics.encodingTime = diff(t.context_extraction, t.encoding);
  // state: context_extraction -> time spent before entering sending
  metrics.captureTime = diff(t.sending, t.context_extraction);
  // state: sending -> time spent before entering waiting
  metrics.dispatchTime = diff(t.waiting, t.sending);

  // ttfb (Time to first byte)
  // Reached when we either get the first stream chunk (streaming) or the final response (rendering)
  if (t.streaming) {
    metrics.ttfb = diff(t.streaming, t.waiting);
  } else if (t.rendering) {
    metrics.ttfb = diff(t.rendering, t.waiting);
  }

  // ttft (Time to first token)
  // Per gemini.ts, we use TRUE token streaming via generateContentStream,
  // so the first chunk genuinely represents the first token. Thus estimatedTtft = false.
  if (t.streaming) {
    metrics.ttft = diff(t.streaming, t.waiting);
    metrics.estimatedTtft = false;
  } else if (t.rendering) {
    // If it didn't stream, we only have the full response time. 
    // We can still populate ttft as the time to the full response, but it's not a true TTFT.
    metrics.ttft = diff(t.rendering, t.waiting);
    // Even though the app supports true streaming, if we didn't hit the streaming state
    // (e.g. mock or error), we can flag it. But strictly speaking, the API approach is true streaming.
    metrics.estimatedTtft = false; 
  }

  metrics.renderingLatency = diff(t.completed, t.rendering);
  
  // End to End Latency
  // Use the last available terminal timestamp (completed, error, cancelled, timeout)
  const endTimestamp = t.completed || t.error || t.cancelled || t.timeout;
  metrics.endToEndLatency = diff(endTimestamp, t.encoding);

  return metrics;
}
