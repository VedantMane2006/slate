# SLATE — Attribution

This document details the relationship between SLATE and PenEcho, a project from which certain high-level UX and architectural concepts were borrowed. In accordance with the project requirements, while the conceptual inspirations listed below were drawn from PenEcho, the implementation of every feature—including all algorithms, mathematical thresholds, state machine definitions, codebase architecture, and UI/UX styling—was independently designed, engineered, and written from scratch specifically for SLATE.

## 1. ROI / Selection-First Extraction Strategy
- **Borrowed Concept**: Extracting a localized Region of Interest (ROI) from an infinite canvas to send to the AI, rather than sending the entire document, and prioritizing the user's explicit selection first.
- **Independently Built**: The architecture for managing `CanvasObject` arrays, the spatial intersection mathematics (`boxesIntersect` in `geometry.ts`), and the specific confidence scoring logic (`computeConfidence`) returning High/Medium/Low grades were independently designed and coded for this project.

## 2. Recent-Stroke Fallback
- **Borrowed Concept**: Defaulting to the most recently drawn strokes as the AI's context if the user triggers the AI without an explicit selection.
- **Independently Built**: The precise time-window threshold (exactly 10,000 ms), the `timestamp` tracking mechanism on the `CanvasObject` interface, and the functional filtering logic that implements this fallback were independently designed for SLATE.

## 3. Cluster Expansion
- **Borrowed Concept**: Automatically expanding the initial working set (either the selection or recent strokes) to include nearby relevant objects on the canvas.
- **Independently Built**: The specific connected-component clustering algorithm utilized to solve this. SLATE implements a custom Disjoint Set (Union-Find) data structure to evaluate cluster membership globally via O(N²) pairwise bounding box intersections, utilizing an independent 5px proximity threshold.

## 4. Structured AI Object Architecture
- **Borrowed Concept**: Treating canvas elements as distinct, structured data objects (such as equations or tables) for the AI's input and output, rather than treating the canvas purely as a flat pixel array.
- **Independently Built**: The dual-interface design (`CanvasObject` and `Serializable`), the definition and serialization rules of the six specific object types (`Stroke`, `Table`, `Text`, `Image`, `Equation`, `DraftObject`), and the specific `composeMultimodalRequest` aggregation mapping to `{kind: 'image'|'json'|'text'}` were independently architected for this project.

## 5. Request Lifecycle / State Machine Concept
- **Borrowed Concept**: Modeling an in-flight AI request as a discrete state machine with distinct phases, rather than a simple async network call.
- **Independently Built**: The specific 11-state definition (`encoding` → `context_extraction` → `sending` → `waiting` → `streaming` → `rendering` → `completed` | `cancelled` | `superseded` | `timeout` | `error`), the exact terminology used, the distinction between user-`cancelled` vs system-`superseded` paths, and the `RequestLifecycleManager` implementation that strictly derives telemetry from transition timestamps were designed from scratch for SLATE.

## 6. Spatially Anchored Responses
- **Borrowed Concept**: Rendering the AI's response directly on the canvas near the source context that generated it, rather than placing it in a fixed global UI element (like a sidebar).
- **Independently Built**: The specific React `DraftCard` UI component, the dynamic viewport clamping mathematics that ensure the card never renders off-screen regardless of user panning/zooming, and the `worldToScreen` coordinate translations anchoring it near the extracted bounding box were independently designed and engineered for this project.
