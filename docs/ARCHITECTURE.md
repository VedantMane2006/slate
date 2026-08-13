# SLATE — Final Architecture Documentation

This document consolidates the architectural decisions and implementation details of the SLATE application, built over 14 phases.

## 1. Object Model
The core of SLATE's data model relies on two foundational interfaces that every canvas entity implements:
- `CanvasObject`: `{ id: string; type: string; bounds: BoundingBox; ... }`. This allows the selection, translation (move), bounding box hit-testing, and undo/redo systems to treat all objects uniformly without type-specific special-casing.
- `Serializable`: `{ toAIPayload(): AIPayloadFragment }`. This interface controls how the object translates into a fragment for the Gemini AI. 

There are exactly 6 implemented object types in SLATE:
1. **`Stroke`**: Hand-drawn ink, producing `{ kind: 'image' }`.
2. **`Table`**: Structured table data, producing `{ kind: 'json' }`.
3. **`Text`**: Text blocks, producing `{ kind: 'text' }`.
4. **`Image`**: Embedded images, producing `{ kind: 'image' }`.
5. **`Equation`**: Mathematical LaTeX formulas, producing `{ kind: 'text' }`.
6. **`DraftObject`**: Represents an AI-generated draft card on the canvas before it is accepted or discarded.

## 2. Coordinate System
SLATE enforces a strict boundary between **world space** (the infinite canvas where objects exist) and **screen space** (the physical pixels on the user's monitor where rendering and cursor events occur).
- All hit-testing, object geometry, and bounding boxes are computed and stored in world space.
- Transformations only occur at the boundary layers: pointer ingestion and rendering.
- Pure functions `worldToScreen` and `screenToWorld` (located in `/src/canvas/coordinates.ts`) handle the `screen = world * zoom + offset` math.

## 3. Command & HistoryStack Pattern
Undo/redo functionality is implemented via the Command pattern (`Command` interface with `execute()`, `undo()`, and a `label`) operating over an abstract `ObjectStore` interface. 
- The `HistoryStack` maintains a bounded stack size (capped at 200 entries) to prevent unbounded memory growth.
- We implemented several concrete commands: `AddObjectCommand`, `RemoveObjectCommand`, `TranslateCommand` (for moving objects), and `CompositeCommand` (for grouping actions like deleting multiple selected strokes).
- The history stack is cleared entirely upon loading a new canvas from disk to prevent invalid state restorations.

## 4. Context Extraction Strategy
When a user asks the AI a question, `extractContext` determines which objects to include. It returns an `ExtractionResult` containing bounds, object IDs, and a `confidence` metric (`{ level: 'high'|'medium'|'low', reasons: string[] }`). The strategy evaluates in this priority:
1. **Selection-first**: If the user has manually selected objects, they are used exclusively (High confidence).
2. **Recent-fallback**: Uses objects modified within the last 10 seconds.
3. **Cluster expansion**: Starting from the initial working set, the system expands to include nearby context. In Phase 11, the simple proximity expansion was fully upgraded to a **true connected-component clustering algorithm using Union-Find (Disjoint Set)**. This evaluates cluster membership globally (O(N^2) pairwise box intersections), solving edge cases with long chains of strokes.

## 5. Request Lifecycle State Diagram
The `RequestLifecycleManager` tracks every AI request through an explicit, 11-state machine:

`encoding` → `context_extraction` → `sending` → `waiting` → `streaming` → `rendering` → (`completed` | `cancelled` | `superseded` | `timeout` | `error`)

- Every transition records an exact timestamp.
- **Cancel vs. Supersede**: Cancellations are explicit user actions. Superseding happens automatically if a new auto-triggered request fires while an older one is still in-flight. Late responses from superseded requests are explicitly ignored and never rendered to the UI.
- The canvas remains fully interactive during all in-flight requests.

## 6. AI Output Schema and Rendering Pipeline
The Gemini AI is prompted to return structured JSON matching a strict flat schema:
`{ explanation: string, latex?: string, table?: string[][], graph?: { type: 'bar'|'line', labels: string[], values: number[] } }`

- Responses are runtime-validated by pure type guards (`validateAIOutput`). Malformed data or errors immediately transition to an honest error UI, preventing silent crashes.
- The AI never generates images.
- Rendering happens entirely locally via React components using `marked` and `dompurify` for sanitized Markdown, `katex` for LaTeX math, standard HTML tables, and a custom, lightweight SVG renderer for graphs.

## 7. Metrics and Instrumentation Approach
All performance metrics are derived strictly from the `RequestLifecycleManager`'s timestamp map (e.g., `endToEndLatency`, `ttfb`, `ttft`). No parallel stopwatches exist in the codebase.
- **Token/Cost Estimation**: Since we implemented **true token streaming** via `generateContentStream` in Phase 7 (chunked iteratively), Time-To-First-Token (TTFT) metrics are exact. 
- Overall token counts and USD costs are tagged with `estimated: boolean`. If exact `usageMetadata` is unavailable, we fall back to deterministic text length and adaptive-crop-resolution heuristics to estimate cost accurately.

## 8. Gating and Deduplication Strategy
To save tokens on auto-triggered requests, a pure `evaluateGate` function acts as a firewall before reaching the network:
- **Gating**: It checks that the working set has > 15 objects, the bounds area is > 100px, idle time > 2000ms, and the canvas is not empty. If triggered manually, these checks are immediately bypassed.
- **Deduplication**: We implemented a `DedupCache` using SubtleCrypto SHA-256 for deterministic hashing of canonical request data (the JSON data strings, never the rendered pixel buffers). The cache uses an LRU-style max size cap and time-based TTL to instantly resolve duplicate requests from memory.

## 9. Persistence Format
- **Save/Load**: State is persisted purely to a local JSON file (`slate-save.json`) stamped with version `1.0.0`. During serialization, non-enumerable methods (like `toAIPayload`) are stripped. During deserialization, structured `CanvasObject` instances are manually reconstructed via their respective factory functions to safely re-bind these prototype methods.
- **Export**: PNG export computes the FULL CONTENT BOUNDS (the union of all object bounds on the canvas, padded) and renders the output to an off-screen canvas, ensuring complete, predictable images regardless of current viewport position.

## 10. Final Folder Structure
The implementation rigorously conforms to the architectural folder boundaries:
- `/src/canvas` — viewport, coordinates, and renderer logic
- `/src/objects` — all `CanvasObject` data types and Serializable implementations
- `/src/history` — Command pattern and `HistoryStack`
- `/src/context-extraction` — pure ROI extraction, confidence, and true connected-component clustering
- `/src/ai/adapters` — the sole `GeminiClient` implementation
- `/src/ai/lifecycle` — the request state machine
- `/src/ai/rendering` — schema validation and local React renderers (markdown/latex/table/graph)
- `/src/ai/gating` — gating heuristics and SHA-256 dedup cache
- `/src/metrics` — deriving, aggregating, and tracing lifecycle data
- `/src/persistence` — JSON save/load algorithms and PNG exporter
- `/src/providers` — the 3 global React contexts (`CanvasState`, `AILifecycle`, `Metrics`)
- `/src/components` — pure UI components with zero underlying business logic
- `/benchmarks`, `/experiments`, `/tests` — robust test and experiment harnesses
