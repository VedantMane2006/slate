# SLATE — Product Requirements Document

## What this is
SLATE is an AI-augmented infinite canvas for handwritten/structured work (math, notes, diagrams).
The user draws or inserts structured objects (ink, tables, text, images, equations); SLATE
extracts the relevant region, sends it to Gemini as a multimodal request, and returns a
structured, renderable AI response (Markdown/LaTeX/table/graph) the user can Accept or Discard.

This is being built for the Scholera AI/ML Intern coding assignment. The primary audience is
the assignment grader; the secondary (real) audience is a student using it to work through
math/notes with AI assistance.

## Goals, in priority order
1. A working, honest, well-instrumented AI-augmented canvas loop, end to end.
2. Depth of engineering (architecture, testing, metrics, docs) over breadth of features.
3. Clear, defensible originality above the PenEcho-inspired baseline.
4. A submission that reads as something a senior engineer would be comfortable maintaining.

## Non-goals (explicitly out of scope — do not build)
RAG / vector DB / embeddings, local multimodal models, sparse tile engine, multi-provider AI
abstraction, authentication, a database, real-time collaboration, a plugin system, a desktop
app, cloud deployment, OCR pipeline, handwriting generation.

## Core user flow (must work, end to end, before anything else matters)
1. User draws / inserts structured objects on an infinite canvas (pan/zoom, pointer events,
   pressure/tilt where available).
2. User selects a region (or leaves it to fallback logic) and triggers "Ask AI" (manually, or
   automatically once gating conditions are met).
3. SLATE extracts context (selection-first → recent-strokes fallback → cluster expansion),
   scores its own confidence, and composes a multimodal request (image + structured JSON/text
   fragments).
4. Request goes through a real lifecycle (encoding → sending → waiting → streaming → rendering
   → completed / cancelled / superseded / timeout / error), with the canvas staying fully
   interactive throughout.
5. A validated, structured JSON response renders as a Draft Card (Markdown/LaTeX/table/graph),
   spatially anchored near its source, with Accept/Discard.
6. Accept commits the result as a real, undoable canvas object. Discard removes it cleanly.
7. Every request is instrumented (latency breakdown, tokens, cost, outcome) and visible in a
   live metrics panel.

## Success criteria (what "done" looks like)
- The flow above works with zero crashes, including on malformed AI responses (honest failure
  state, never a silent blank card or hard crash).
- Metrics panel reflects real, wrapper-derived numbers, not cosmetic placeholders.
- Context extraction strategy is explainable ("why this crop") via confidence + strategy shown
  per request.
- At least one real, evidenced experiment comparing two configurations (e.g. gating on/off,
  fixed vs. adaptive resolution) with honest results.
- Docs (README, ARCHITECTURE, ATTRIBUTION, IDEAS, METRICS, EXPERIMENTS, AI usage log) are
  complete and specific, not stubs.
- `main` builds/lints/tests clean from a fresh clone at submission time.

## Differentiators (our original features — protect these from being cut under time pressure)
Structured Input Objects (native tables/graphs/text/equations composed into one multimodal
request), Cost Preview, Context Confidence indicator, Adaptive Resolution, Smart Context
Expansion, local JSON rendering (no AI-generated images), Hint Modes (stretch).

## PenEcho relationship
Certain *concepts* are PenEcho-inspired (ROI extraction, selection-first/recent-fallback/
cluster-expansion strategy, structured AI object architecture, request lifecycle concept,
spatially anchored responses) — see `ATTRIBUTION.md`. All algorithms, thresholds, state
machine details, and UI must be independently designed, never ported or copied.

## Constraints
- Solo build, roughly one week, using AI coding tools phase-by-phase.
- Gemini-only. No multi-provider abstraction.
- No backend/database — client-side + Gemini API only.