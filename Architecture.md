# SLATE — Architecture

## Stack
- Vite + React + TypeScript, strict mode, no implicit `any`
- Vitest for unit/integration tests
- ESLint + Prettier
- Gemini API via a single concrete client (no provider abstraction)
- No backend, no database — all state is client-side; persistence is local JSON file
  save/load, not cloud storage

## State architecture (decided once, do not reinvent per phase)
Three top-level providers/stores:
- `CanvasStateProvider` — objects, selection, viewport, history stack
- `AILifecycleProvider` — in-flight/past AIRequests and their states
- `MetricsProvider` — aggregated metrics, live subscriptions

No other global state. Everything else is local component state or derived from these three.

## Coordinate system
Strict separation of **world space** (where objects live) and **screen space** (where
rendering/cursor happen). All geometry, hit-testing, and object math is done in world space.
Conversion only happens at the render boundary and at pointer-input ingestion.
`worldToScreen` / `screenToWorld` live in `/src/canvas/coordinates.ts` — reuse them, never
hand-roll a parallel conversion.

## Object model
Every canvas entity (`Stroke`, `TableObject`, `TextObject`, `ImageObject`, `EquationObject`,
`DraftObject`) implements two interfaces:
- `CanvasObject { id, type, bounds }` — required for selection/move/undo to treat all types
  uniformly. Selection, move, and history code must never special-case by object type.
- `Serializable { toAIPayload(): AIPayloadFragment }` — defines how that object contributes to
  an AI request: `{kind:'image'}` for ink/images, `{kind:'json'}` for tables, `{kind:'text'}`
  for text/equations.

## History / undo-redo
Command pattern (`Command { do(), undo(), label }`) over a generic `ObjectStore` interface
(add/remove/update/getAll by id). Undo/redo must always go through this — never a direct
"restore previous array" shortcut. Bounded stack size (~200 entries).

## Context extraction pipeline
`extractContext(objects, selection, now) → ExtractionResult { bounds, objectIds, strategy,
confidence }`. Strategy priority: selection-first → recent-strokes fallback → cluster
expansion. Confidence is `{level: high|medium|low, reasons: string[]}`. This module is pure,
framework-agnostic, and its public interface must stay stable even as the clustering
implementation is upgraded later (simple proximity → true connected-component graph analysis).

## Request composition
`composeMultimodalRequest(extractionResult, objects) → { image, fragments }` — image from
rendering ink/image objects in-bounds, fragments from `toAIPayload()` on structured objects.
`canonicalSerialize()` produces a deterministic string of the underlying *data* (not rendered
pixels) — this is the single source of truth for hashing/dedup, never hash pixels.

## Request lifecycle
States: `encoding → context_extraction → sending → waiting → streaming → rendering →
completed | cancelled | superseded | timeout | error`. Every transition records a timestamp —
this timestamp map is the ONLY source of truth for later latency metrics; no separate timers
anywhere else in the codebase. Cancel and supersede are distinct paths. Superseded requests'
late responses are never rendered. Canvas must remain fully interactive during any in-flight
request — this is a hard requirement, not a nice-to-have.

## AI output
Schema: `{ explanation: string(markdown), latex?, table?: string[][], graph?: GraphSpec }`.
Always runtime-validated (`validateAIOutput`) — invalid responses produce an explicit,
honest-failure UI state, never a crash or blank card. Rendering (Markdown/LaTeX/table/graph)
happens locally — the AI never generates images.

## Metrics
All timings derived from the request lifecycle's own timestamp map — never a parallel
stopwatch. Every metric is tagged `estimated: boolean` where exact data (e.g. token usage)
isn't available from the API. TTFT accuracy is only as good as whether true streaming (vs.
chunked polling) was implemented in the Gemini client — document which one exists.

## Folder ownership
/src/canvas viewport, coordinates, renderer — owns pan/zoom/render
/src/objects all CanvasObject types + Serializable impls
/src/history Command pattern + HistoryStack
/src/context-extraction ROI strategy, confidence, clustering — pure, no React
/src/ai/adapters GeminiClient (single implementation only)
/src/ai/lifecycle request state machine
/src/ai/rendering schema validation + local renderers (md/latex/table/graph)
/src/ai/gating request gating rules + SHA-256 dedup cache
/src/metrics derive/aggregate metrics, live panel data
/src/persistence JSON save/load, PNG export
/src/hooks framework glue over the above
/src/providers the 3 top-level state providers
/src/components UI only — no business logic lives here
/benchmarks, /experiments, /traces, /docs, /config

## Explicit non-architecture (do not build)
No `AIProvider` multi-provider interface — `GeminiClient` is the only implementation, kept
concrete and simple. No backend. No database.