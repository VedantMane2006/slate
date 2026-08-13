# SLATE — Experiments Report

## Benchmark Scenes

For our initial comparative testing, we constructed two benchmark canvases:
- **Sparse**: A simple scene containing just 2 well-separated strokes, resulting in a low ink density (0.1344).
- **Dense**: A highly complex and concentrated scene containing 50 overlapping strokes, resulting in maximum ink density (1.0).

## Adaptive vs. Fixed Resolution Comparison

We ran a controlled A/B test routing both benchmarks through the real Gemini 2.5 Flash pipeline. We compared the Phase 11 Adaptive Resolution heuristic (which dynamically picks 512, 1024, or 1536px based on scene density) against a forced Fixed-1024px resolution.

### Results

The following metrics were captured from `experiments/results.json`:

| Benchmark | Configuration | Resolution | Object Count | Ink Density | End-to-End Latency | Response Length | Success |
|-----------|---------------|------------|--------------|-------------|--------------------|-----------------|---------|
| Sparse    | Adaptive      | 512px      | 2            | 0.1344      | 3,027 ms           | 73 chars        | Yes     |
| Sparse    | Fixed-1024    | 1024px     | 2            | 0.1344      | 2,057 ms           | 72 chars        | Yes     |
| Dense     | Adaptive      | 1536px     | 50           | 1.0         | 14,108 ms          | 64 chars        | Yes     |
| Dense     | Fixed-1024    | 1024px     | 50           | 1.0         | 4,089 ms           | 89 chars        | Yes     |

### Findings

Based on the latency data, **adaptive resolution performed strictly worse than fixed resolution** across both test cases.
- **Dense Case**: The adaptive heuristic correctly identified the scene's complexity and scaled the crop to the maximum 1536px. However, this resulted in an unacceptable end-to-end latency of ~14.1 seconds—approximately **3.4x slower** than the fixed 1024px configuration (4.1 seconds).
- **Sparse Case**: The adaptive heuristic correctly identified the scene's simplicity and scaled the crop down to 512px. Despite the smaller image payload, the API call still took ~3.0 seconds, which was noticeably slower than the fixed 1024px baseline (2.1 seconds).

*Note on Cost/Tokens: The simplified integration test harness built for this phase did not capture the Phase 9 token counting and cost estimation metrics. Therefore, while adaptive resolution definitively hurt latency, we cannot quantify if the 512px sparse crop saved enough tokens to justify the approach from a pure cost-reduction perspective.*

## Future Work and Scope

A fuller experiment suite (evaluating additional benchmarks, testing multiple configurations such as the impact of gating heuristics on/off, and capturing full USD cost comparisons) was scoped in the original project plan. However, this broader suite was intentionally scoped down and deprioritized to ensure completion within the given assignment timeline.
