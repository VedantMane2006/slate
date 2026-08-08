# SLATE — Memory / Progress Log

> Read this first, every session. Update it before ending every session.
> This is the single source of truth for "where we left off" — don't re-derive decisions
> from scratch, and don't re-litigate anything marked DECIDED below.

## Current status
Phase: **Phase 4, part 3 — complete** (Image & Equation objects)
Last updated: 2026-08-08
Branch: master
`main` state: Phase 1-3 features complete + Phase 4 all data models — builds, lints, and tests clean (53 tests)

## Decisions already made (DECIDED — do not re-open without a strong reason)
- Stack: Vite + React + TypeScript, strict mode, Vitest, ESLint + Prettier — DECIDED
- Gemini-only, no multi-provider abstraction — DECIDED
- No backend/database, client-side only, local JSON persistence — DECIDED
- State architecture: 3 providers (CanvasState, AILifecycle, Metrics), nothing else global — DECIDED
- Object model: `CanvasObject` + `Serializable` interfaces, all object types conform, no
  special-casing in selection/history — DECIDED
- Undo/redo: Command pattern over generic `ObjectStore`, not stroke-specific — DECIDED
- Dedup hashing: canonical data serialization, never rendered pixels — DECIDED
- Phase order: 0 Scaffold → 1 Canvas/Pointer → 2 Stroke Model → 3 Selection/Undo →
  4 Structured Objects → 5 Context Extraction → 6 Crop/Composition → 7 AI Lifecycle/Gemini →
  8 JSON Rendering/Draft Cards → 9 Metrics → 10 Gating/Dedup/Cost Preview →
  11 Clustering/Adaptive Res → 12 Persistence/Export → 13 Experiments →
  14 Docs/Attribution/Video — DECIDED (see Architecture.md for phase details)
- Coordinate transform: screen = world * zoom + offset — DECIDED (Phase 1.1)

## Open questions / not yet decided (flag if a prompt needs one of these)
- True token streaming vs. chunked polling for the Gemini client (affects TTFT accuracy —
  decide in Phase 7, document the choice immediately)
- Exact resolution tiers/thresholds for `chooseResolution` (start with a documented guess in
  Phase 11, re-tune once real trace data exists in Phase 13)
- Graph rendering library choice (lightweight chart lib vs. minimal custom SVG) — decide in
  Phase 8
- Whether load-from-file resets or preserves history stack — leaning "reset," not yet final
  — decide in Phase 12

## Log (append one entry per session, most recent on top)
- 2026-08-08 — Phase 4, part 3 complete. Added `ImageObject` and `EquationObject` data models implementing `CanvasObject` and `Serializable`. Implemented `createImage` and `createEquation` factories returning objects with non-enumerable `toAIPayload()` functions to preserve `JSON.stringify/parse` equality. Wrote unit tests confirming payloads map correctly to `{ kind: 'image' }` and `{ kind: 'text' }` and round-trip successfully. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (53/53 passed).
- 2026-08-08 — Phase 4, part 2 complete. Added `Table` and `TextObject` data models implementing `CanvasObject` and `Serializable`. Implemented `createTable` and `createText` factories returning objects with non-enumerable `toAIPayload()` functions to preserve `JSON.stringify/parse` equality. Wrote unit tests confirming payloads map correctly to `{ kind: 'json' }` and `{ kind: 'text' }` and round-trip successfully. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (49/49 passed).
- 2026-08-08 — Phase 4, part 1 complete. Extracted `CanvasObject` into `canvas-object.ts` along with `CanvasObjectType`, `Serializable`, and `AIPayloadFragment`. Refactored `Stroke` to implement `CanvasObject` and `Serializable` while keeping its fields framework-free. Added non-enumerable `toAIPayload` implementation to `StrokeBuilder` to preserve `JSON.parse` equality in existing tests. Verified compile-time interface conformance and runtime behavior in a new unit test. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (45/45 passed).
- 2026-08-08 — Phase 3, part 4 complete. Implemented keyboard shortcuts for Delete/Backspace, mapping them to a unified `RemoveObjectCommand` inside `CompositeCommand`. Updated `CanvasViewport`'s `onKeyDown` to use updated state dependencies correctly. Added `tests/unit/keyboard.test.tsx` and `tests/integration/keyboard.test.tsx` checking full draw → select → move → undo → redo → delete → undo cycles. Phase 3 Definition of Done met: All strokes can be drawn, selected, translated, deleted, and all modifications strictly run through `HistoryStack` commands for full undo/redo support. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (44/44 passed).
- 2026-08-08 — Phase 3, part 3 complete. Implemented move/translate interaction. Added `TranslateCommand` to support moving selected strokes. Updated `CanvasViewport.tsx` to handle drag-to-move logic when selection exists. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (42/42 passed).
- 2026-08-08 — Phase 3, part 2 complete. Added selection mode to `CanvasViewport.tsx` (toggled via 'V'). Dragging produces a world-space selection box that broad-phase intersects with stroke bounds using `boxesIntersect` (added to `geometry.ts`). Selected strokes are visually highlighted with a blue semi-transparent overlay bounding box, alongside the rubber-band selection box itself. State tracks `selection.ids`. Added unit test for selection. All verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (40/40 passed).
- 2026-08-08 — Phase 3, part 1 complete. Implemented `Command` interface, `HistoryStack` with size cap (200), and `ObjectStore` interface in `/src/history/command.ts`. Upgraded `CanvasViewport.tsx` to wrap its `strokes` state into an `ObjectStore` and perform all drawing and erasing operations via `AddObjectCommand`, `RemoveObjectCommand`, and `CompositeCommand` interacting with the `HistoryStack`. Added Undo/Redo shortcuts (Ctrl+Z, Ctrl+Shift+Z). Added unit tests for history logic. All verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (39/39 passed).
- 2026-08-08 — Phase 2, part 4 complete. Implemented Eraser tool in `CanvasViewport.tsx`. Erase logic leverages broad phase `pointInBox` hit-testing against bounding boxes, followed by narrow phase `distance` checking. Decided on "whole-stroke erase" as per architecture guidelines. Added unit tests for eraser hits and misses. Phase 2 Definition of Done met: stroke model is framework-free, rendering is pure, and eraser interacts cleanly with strokes. All verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (36/36 passed).
- 2026-08-08 — Phase 2, part 3 complete. Maintained in-memory array of `Stroke` objects in `CanvasViewport`. Wired-up `usePointerEvents` to create/append to `StrokeBuilder` state and finalized `renderStrokes` loop. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (34/34 passed across 7 test files).
- 2026-08-08 — Phase 2, part 2 complete. Implemented pure geometry utilities in `/src/utils/geometry.ts` (`BoundingBox`, `Point`, `unionBoundingBoxes`, `pointInBox`, `distance`). Added robust unit tests covering edge cases like zero-area boxes, points on bounding box edges/corners, and distance calculations with negative coordinates and identical points. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (33/33 passed across 6 test files).
- 2026-08-08 — Phase 2, part 1 complete. Implemented `Stroke` object type and `StrokeBuilder` class in `/src/objects/stroke.ts`. `StrokeBuilder` accumulates pointer samples and correctly updates bounding boxes incrementally without recomputing from scratch. Added rigorous unit tests (single point, straight line, L-shape, JSON round-trip). Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (22/22 passed across 5 test files).
- 2026-08-08 — Phase 1, part 3 complete. Implemented `usePointerEvents` hook in `/src/hooks` to capture pointerdown/move/up events on the canvas. Added extraction of coalesced events for smoother sampling, explicit pressure/tilt support detection with fallback (pressure=0.5, tilt=0), and conversion to world-space coordinates. Added unit tests for pressure fallback and world coordinate calculations. Phase 1 Definition of Done met: canvas renders, pans, zooms, and emits clean world-space pointer samples. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (17/17 passed across 4 test files).
- 2026-08-08 — Phase 1, part 2 complete. Implemented `CanvasViewport` component rendering an infinite canvas with space+drag panning, pinch zoom, and anchored wheel zoom. Adaptive grid and origin axes implemented purely using `worldToScreen`/`screenToWorld`. Added tests for `zoomAtPoint` anchoring (6 tests) and added `ResizeObserver`/`getContext` jsdom mocks. Verification passed: `npm run build` ✓, `npm run lint` ✓, `npm test` ✓ (14/14 passed across 3 test files).
- 2026-08-08 — Phase 1, part 1 complete. Added `/src/canvas/coordinates.ts` with
  `WorldPoint`, `ScreenPoint`, `Viewport` types and pure `worldToScreen`/`screenToWorld`
  functions. Added 7 round-trip and direct-value tests in
  `tests/unit/coordinates.test.ts`. All verification passed: `npm run build` ✓,
  `npm run lint` ✓ (zero warnings), `npm test` ✓ (8/8 passed across 2 test files).
- 2026-08-08 — Phase 0 complete. Scaffolded Vite + React + TypeScript project with strict
  mode. Created full folder structure per Architecture.md (canvas, objects, history,
  context-extraction, ai/adapters, ai/lifecycle, ai/rendering, ai/gating, metrics,
  persistence, hooks, providers, components, shared/types, tests/unit, tests/integration,
  benchmarks, experiments, traces, config). Configured ESLint (flat config, strict TS rules),
  Prettier, Vitest (jsdom). One passing smoke test. README.md with install/run/test
  instructions. `.gitignore` in place. All verification passed: `npm run build` ✓,
  `npm run lint` ✓ (zero warnings), `npm test` ✓ (1/1 passed).
- [DATE] — Planning session. Created PRD.md, Architecture.md, Rules.md, Memory.md and the
  full phase-by-phase execution roadmap (15 phases, Phase 0 → Phase 14). No code written yet.
  Next action: start Phase 0 (scaffolding) using the Phase 0 prompt from the roadmap.

## Next action
Start Phase 4, part 4 — UI editors/renderers for Table, Text, Image, Equation.