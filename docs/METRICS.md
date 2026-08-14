# SLATE — Metrics & Instrumentation

## 1. Trace Schema
Every completed request produces a trace object logged in `traces/` as a JSONL entry. The schema is:
```typescript
{
  "id": string,
  "timestamp": number, // UNIX epoch
  "configId": string,
  "promptVersion": string,
  "state": "completed" | "error" | "cancelled" | "timeout" | "superseded",
  "confidenceLevel": "high" | "medium" | "low",
  "objectCount": number,
  "ttfb": number, // Time to First Byte (ms)
  "ttft": number, // Time to First Token (ms)
  "endToEndLatency": number, // Total time (ms)
  "captureTime": number, // Time spent extracting context
  "encodingTime": number, // Time spent encoding payload
  "dispatchTime": number, // Time spent sending to API
  "renderingLatency": number, // Time spent rendering UI
  "promptTokens": number,
  "responseTokens": number,
  "totalTokens": number,
  "costUsd": number,
  "estimatedTokens": boolean,
  "accepted": boolean, // Whether the user accepted the DraftCard
  "error"?: string
}
```

## 2. Segment Definitions
Metrics are derived purely from the timestamp map in the `RequestLifecycleManager`:
- **Encoding Time**: `context_extraction` - `encoding`
- **Capture Time**: `sending` - `context_extraction`
- **Dispatch Time**: `waiting` - `sending`
- **TTFB (Time to First Byte)**: `streaming` (or `rendering`) - `waiting`
- **TTFT (Time to First Token)**: Equal to TTFB since we use true chunked streaming via `generateContentStream`.
- **Rendering Latency**: `completed` - `rendering`
- **End-to-End Latency**: Terminal timestamp (`completed`|`error`|`cancelled`) - `encoding`

## 3. Image-Token Estimator & Validated Error
When exact `usageMetadata` is missing from the Gemini SDK (e.g. streaming early termination), we fall back to a heuristic estimator:
- **Text**: `ceil(character_count / 4)`
- **Image**: Base 258 tokens + `ceil((width * height) / 256)`
- **Validated Error**: Experiments proved the image estimator is fundamentally incorrect for Gemini 2.5 Flash. The model charges a flat 258 tokens for standard images regardless of resolution (512px, 1024px, 1536px), whereas the estimator scales linearly. As a result, the estimator routinely over-estimates cost on dense scenes.

## 4. Rate Table (Source & Date)
*Source: Google AI Studio Pricing for gemini-1.5-flash / gemini-2.5-flash under 128k context.*
*Date Checked: August 2026*
| Token Type | Rate (per 1M tokens) |
|------------|----------------------|
| Prompt | $0.075 |
| Completion (Response) | $0.30 |

## 5. KPI Formulas
- **p50 / p95 End-to-End Latency**: The 50th and 95th percentile of `endToEndLatency` across all non-error completed traces.
- **Acceptance Rate**: `count(accepted === true) / count(completed)`
- **Wasted Token Ratio**: `sum(totalTokens where accepted === false) / sum(totalTokens)`
- **CPAD (Cost Per Accepted Draft)**: `sum(costUsd) / max(1, count(accepted === true))`

## 6. Panel Screenshot
![Metrics Panel Screenshot](./metrics-panel.png)
