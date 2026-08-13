# SLATE — Original Features and Innovations

This document details the original features and differentiators engineered specifically for SLATE, and explains why each represents a genuine improvement over a baseline ink-only AI canvas.

## 1. Structured Input Objects
**Implemented:** Yes (Phase 4). SLATE natively supports `Table`, `Text`, `Image`, and `Equation` objects alongside freehand `Stroke` objects, composing them into a unified multimodal request.
**Why it’s an improvement:** An ink-only canvas relies entirely on the Vision-Language Model's internal OCR to understand user intent. By allowing the user to type explicit text or perfect LaTeX equations alongside their drawings, SLATE provides mathematically perfect, unambiguous textual context. This drastically reduces AI hallucinations on complex notation and domain-specific terminology that handwriting OCR frequently misinterprets.

## 2. Cost Estimation and Telemetry
**Implemented:** Partially. The exact cost calculation logic (`deriveTokenUsageAndCost`) and heuristic estimation for fallback scenarios were fully implemented in Phase 9 and are tracked in the live `MetricsPanel`. However, the explicit *pre-flight cost preview UI* (originally planned for Phase 10) was intentionally descoped.
**Why it’s an improvement:** Even as a post-request metric, rigorous cost telemetry tied to exact `gemini-2.5-flash` pricing allows users and developers to genuinely understand the financial impact of their multimodal canvas usage over time, avoiding the hidden runaway costs typical of uninstrumented LLM wrappers.

## 3. Context Confidence
**Implemented:** Yes (Phase 5). `extractContext` computes and returns a confidence grade (`High`, `Medium`, or `Low`) and a human-readable reasoning array (e.g., "Explicit user selection utilized").
**Why it’s an improvement:** In "black box" AI canvases, users often experience frustration when the AI answers the wrong question simply because it silently cropped the wrong part of the board. By surfacing exactly *why* SLATE chose a specific working set, the user builds an accurate mental model of the system's attention mechanism and knows precisely when to intervene with a manual selection.

## 4. Adaptive Resolution
**Implemented:** Yes (Phase 11). `chooseResolution` dynamically scales the composed image crop to 512px, 1024px, or 1536px based on a mathematical computation of spatial ink density (`computeInkDensity`).
**Why it’s an improvement:** A fixed-resolution AI pipeline forces a compromise: either waste tokens and money sending massive images for simple scratchpad math, or cause AI hallucinations by blurring dense, complex diagrams. Adaptive resolution ensures sparse scenes save tokens (and cost), while dense scenes automatically retain the high-fidelity pixels required for the VLM to read them accurately.

## 5. Local JSON Rendering
**Implemented:** Yes (Phase 8). The AI is strictly constrained to output JSON conforming to `AIOutputSchema` (containing Markdown, LaTeX, tables, or graph specs). SLATE renders these natively in the DOM using tools like `KaTeX` and `DOMPurify`. The AI *never* generates raster images.
**Why it’s an improvement:** 
- **Quality**: Rendered LaTeX and DOM elements remain infinitely crisp at any canvas zoom level, unlike rasterized AI images.
- **Interactivity**: Users can natively highlight, copy, and paste text directly from the AI's response card.
- **Speed & Cost**: Generating structured text/JSON from an LLM is orders of magnitude faster and cheaper than running a multimodal diffusion model to generate a static image response.

## 6. True Connected-Component Clustering
**Implemented:** Yes (Phase 11). The context expansion algorithm was fully implemented using a custom Disjoint Set (Union-Find) graph algorithm to evaluate global cluster membership via O(N²) pairwise bounding box intersections.
**Why it’s an improvement:** Naive proximity expansion algorithms often rely on arbitrary loop iteration caps (e.g., expanding outwards a maximum of 3 times). This routinely causes long chains of strokes (like a long written equation) to be artificially truncated, cutting the AI's prompt in half. True connected-component clustering guarantees that if a stroke is physically linked to the context group, the entire semantic unit is captured and sent to the model, regardless of how long the chain is.
