# IDEAS.md — Feature Ideation

## 1. Structured Input Objects
- **problem**: The vision model constantly hallucinates complex math notation or text that the user handwrote poorly.
- **why_canvas**: Users can explicitly compose typed text, native tables, and LaTeX equations spatially alongside their messy ink, providing hybrid context.
- **model_dependency**: Model must accurately understand multimodal interleaved JSON and images simultaneously.
- **cost_class**: Cheap. Text tokens are vastly cheaper than image tokens, and explicit text reduces the need for repeated clarifying API calls.
- **risk**: Users ignore the structured tools because drawing is lower friction, negating the benefit.

## 2. Interactive Hint Modes (Pedagogy)
- **problem**: Users get stuck on a math step but don't want the full answer, which short-circuits learning.
- **why_canvas**: Hints can be anchored spatially near the exact step where the user is stuck, rather than at the bottom of a linear chat thread.
- **model_dependency**: Model must be strictly promptable to output partial structural hints rather than blurting out the final solution.
- **cost_class**: Moderate. Requires full image context extraction, but the response token count is very small.
- **risk**: The model accidentally gives the answer anyway, breaking the pedagogical goal.

## 3. Pre-flight Cost Preview (Cost as UX)
- **problem**: Users hesitate to use AI features because they fear hidden, unpredictable usage costs.
- **why_canvas**: Cost can be visualized spatially over the selected crop region (e.g., a dynamic token count tooltip tracking the bounding box).
- **model_dependency**: Requires deterministic or highly predictable token counting heuristics for multimodal inputs before the request fires.
- **cost_class**: Cheap. Runs entirely locally using heuristics before any API call is made.
- **risk**: Users abandon requests too often because they overestimate the financial friction of tiny costs.

## 4. Step-by-step Verification (Verification)
- **problem**: A user makes an algebra error on step 3 of 5, finishes the equation, and doesn't know where it went wrong.
- **why_canvas**: AI can draw a red corrective bounding box exactly around the spatial location of the mistake on the canvas.
- **model_dependency**: Model must accurately map logical math errors to spatial X/Y coordinates in the provided image.
- **cost_class**: Expensive. Requires heavy vision reasoning to map math logic to pixel bounding boxes.
- **risk**: High chance of spatial hallucinations where the model correctly identifies the math error but highlights the wrong coordinate.

## 5. Audio-Spatial Anchoring (Accessibility)
- **problem**: Blind or low-vision users cannot parse spatial canvas relationships.
- **why_canvas**: The AI acts as a screen reader for spatial geometry, reading aloud relative layouts (e.g., "A triangle is drawn above a square").
- **model_dependency**: Model must accurately describe relative geometry and spatial relationships from an image.
- **cost_class**: Moderate. Image tokens are standard, but TTS APIs add additional cost.
- **risk**: Network latency ruins the real-time audio experience required for accessibility tools.

## 6. Local Ink Summarizer (Locality)
- **problem**: Sending every small scribble to the cloud for classification is slow and expensive.
- **why_canvas**: A local on-device small model classifies "is this a math problem or a drawing" to route requests intelligently.
- **model_dependency**: The local model must be small enough to run in WASM without freezing the main UI thread.
- **cost_class**: Cheap. Zero cloud cost.
- **risk**: Accuracy is too low, causing frustrating misroutes where math is ignored.

## 7. Live Data Binding (Agency)
- **problem**: A user changes a number in a table, and the connected chart doesn't update.
- **why_canvas**: Objects have spatial visual wires connecting them, allowing data to flow and trigger re-renders automatically without rewriting.
- **model_dependency**: Model outputs executable code/scripts that bind directly to canvas object IDs.
- **cost_class**: Expensive. Requires significant code generation and strict schema adherence.
- **risk**: Generated code has infinite loops or breaks the React canvas state.

## 8. Semantic Spatial Search (Memory & Continuity)
- **problem**: A user returns a week later and can't find their notes on "thermodynamics" on a massive, messy canvas.
- **why_canvas**: The user types a query, and the canvas dynamically pans/zooms to the relevant visual cluster of ink.
- **model_dependency**: Model must generate accurate semantic embeddings for spatial clusters of messy handwriting asynchronously.
- **cost_class**: Moderate. Embedding API costs scale with the number of clusters.
- **risk**: Embeddings fail to capture the semantics of poor handwriting.

---

## C2 — Selection Argument

**Selected Feature:** Structured Input Objects (Feature 1)

**Argument:**
I scored the ideas on impact, effort, and running cost. I originally wanted to build *Step-by-step Verification* because its pedagogical value is immense—highlighting exactly where a student went wrong is the holy grail of tutoring. However, current vision models are notoriously poor at mapping logical insights back to exact pixel coordinates, making the risk of "spatial hallucinations" too high for a robust V1.

Instead, I chose to build **Structured Input Objects**. This feature solves the hallucination problem at the source by explicitly removing input ambiguity. It is extremely cheap to run (text JSON tokens cost orders of magnitude less than the equivalent image tokens if the user had to draw the table), and it fundamentally upgrades the canvas from a static whiteboard to a hybrid multimodal workspace. It required significant architectural effort (updating `CanvasObject` interfaces, rendering, and serialization), but it provides the strongest foundation for all future features.
