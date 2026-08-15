# SLATE — AI Usage Log

This document details how AI coding tools were utilized throughout the development of SLATE across its 14 phases. The intent is to provide a transparent look at where AI generation excelled, where human-guided debugging was necessary, and the overall division of labor.

## Overall Approach
- **Scaffolding & Boilerplate (Phases 0-4)**: High reliance on AI generation. Setting up Vite, React, standard geometry math, and basic data structures (`Stroke`, `Table`, `Image`) was largely AI-driven with minimal correction.
- **Complex Algorithms (Phases 5, 11)**: Medium reliance. For the connected-component clustering (Union-Find) and context extraction heuristics, AI generated the initial algorithm structures, but human review and rigorous unit tests were heavily employed to ensure correctness on edge cases (e.g. isolated strokes, loop iteration limits).
- **Architecture & System Integration (Phases 7-10)**: High manual guidance. Wiring the `AILifecycleProvider` state machine and configuring the `GeminiClient` required explicit human instructions to enforce the strict architecture (no global state, true token streaming, explicit state transitions).

## Examples of Manual Debugging and Correction

While AI generation was highly effective, several instances required explicit human-guided debugging and manual intervention:

1. **The Model-Name 404 Fix (Phase 7, Part 3)**:
   The AI initially generated code that attempted to call the `gemini-1.5-flash` model on the `v1beta` endpoint, which had been deprecated and returned a 404 error. This required human debugging to diagnose the API version change, explicitly instruct the AI to bump the `@google/generative-ai` SDK from `0.21.0` to `0.24.1`, and switch the configuration to use the `gemini-flash-lite-latest` model.

2. **Event-Bubbling Editor Dismissal Bug (Phase 10)**:
   During the implementation of the UI toolbar and structured object editors (Table, Text, Equation), an issue emerged where interacting with the editor overlays caused them to instantly dismiss. The AI struggled to immediately pinpoint the root cause. It required human-guided debugging to identify that React event bubbling was passing `pointerdown` events through the overlays down to the canvas viewport, triggering a deselect/dismiss action. The AI was then instructed to insert explicit `e.stopPropagation()` handlers to fix the issue.

3. **Inconsistent Gemini Responses (Phase 7, Part 4)**:
   During initial AI integration, the LLM was returning truncated or echoing responses. While the AI agent suggested token limits might be the issue, human review confirmed the streaming chunk accumulation logic was perfectly sound, and the root cause was simply the expected (at that phase) lack of a strict JSON system instruction, which was deliberately deferred to Phase 8.

## Phase Breakdown
- **Phases 0-4 (Scaffolding, Canvas, Strokes, Undo, Objects)**: ~90% AI generated. Smooth execution, pure math and UI boilerplate tested easily.
- **Phases 5-6 (Extraction, Composition)**: ~80% AI generated. Required tight prompting to ensure the algorithms remained pure and framework-agnostic.
- **Phases 7-8 (Gemini Lifecycle, JSON Rendering)**: ~70% AI generated. The state machine logic was solid, but API integration, DOM purification (XSS prevention), and the aforementioned 404/event-bubbling bugs required close human review and correction.
- **Phases 9-10 (Metrics, Gating, Dedup)**: ~85% AI generated. Pure mathematical metrics derivation and SHA-256 caching were handled exceptionally well by the AI agent.
- **Phases 11-13 (Clustering, Persistence, Experiments)**: ~80% AI generated. Implementing the Union-Find algorithm, local file API downloads, and the benchmark test harness required some iterative prompting but were ultimately highly successful.
- **Phase 14 (Documentation)**: ~95% AI generated, driven strictly by the accumulated `Memory.md` log and human-provided structural constraints.

## Summary
AI coding tools dramatically accelerated development velocity, essentially acting as an extremely fast junior developer for boilerplate and standard algorithms. However, strict architectural guardrails (like the `Architecture.md` constraints and `Memory.md` ledger) and human-led debugging on complex DOM event chains and API deprecations were absolutely necessary to deliver a robust, senior-level final product.
