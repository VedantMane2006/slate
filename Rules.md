# SLATE — Rules for AI Coding Tools

Read this before touching any code. These rules apply to every phase, every prompt, every
session, regardless of what the phase-specific prompt says.

## Never do these
1. Never touch files outside the "files expected to change" list for the current phase/prompt.
   If you believe you need to, stop and say so instead of doing it.
2. Never rename or change the signature of an existing exported function/type/interface
   without being explicitly asked to in the current prompt. Downstream phases depend on
   interface stability (especially `CanvasObject`, `Serializable`, `ExtractionResult`,
   `AIRequest`, `RequestState`).
3. Never add a new dependency/library without flagging it first — state what you want to add
   and why before installing it.
4. Never build a multi-provider AI abstraction. `GeminiClient` stays a single, concrete
   implementation.
5. Never implement anything from the explicit non-goals list: RAG, vector DB, embeddings,
   local multimodal models, auth, database, collaboration, plugin system, desktop app, cloud
   deployment, OCR, handwriting generation.
6. Never auto-resolve ambiguity by guessing silently. If a decision isn't documented in
   `Architecture.md` or `Memory.md`, ask, or make a clearly-flagged assumption and say so
   out loud in your response — don't bury it.
7. Never hash rendered pixels for dedup. Always hash the canonical data serialization.
8. Never let selection/move/undo code special-case by object type. If you find yourself
   writing `if (type === 'table')` inside `/src/canvas` or `/src/history`, stop — the
   interface is wrong, fix that instead.
9. Never silently swallow or blank-render an invalid/malformed AI response. Always produce an
   explicit, honest-failure UI state.
10. Never block canvas interactivity while an AI request is in-flight.
11. Never leave `TODO`, `any`, dead code, or commented-out code blocks in anything you commit.
12. Never do unrelated refactoring "while you're in there." Fix only what the current prompt
    asks for.
13. Never mark a phase done without meeting its Definition of Done and passing its testing
    checklist — don't move on to the next phase's prompt until this one is verified.
14. Never invent your own architecture, state pattern, or folder structure that contradicts
    `Architecture.md`. If it seems wrong, say so — don't quietly deviate.
15. Never copy PenEcho's implementation (state machine names/shape, UI copy, exact extraction
    thresholds/algorithm, anchoring math). Concepts may inspire; code must be independently
    authored. See `PRD.md` → "PenEcho relationship."

## Always do these
- State your assumptions explicitly when a prompt is ambiguous, before writing code.
- Keep every phase's output compiling, lint-clean, and passing its own tests before you
  consider it complete.
- Reuse existing utilities (renderer, coordinate transforms, metrics derivation, canonical
  serialization) rather than reimplementing them elsewhere.
- Ask before expanding scope, even if the expansion seems small or obviously good.