# SLATE — Memory / Progress Log

> Read this first, every session. Update it before ending every session.
> This is the single source of truth for "where we left off" — don't re-derive decisions
> from scratch, and don't re-litigate anything marked DECIDED below.

## Current status
Phase: **Phase 0 — complete**
Last updated: 2026-08-08
Branch: master
`main` state: scaffolded — builds, lints, and tests clean

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
Run the Phase 1 prompt (Canvas viewport, pointer events, pan/zoom).