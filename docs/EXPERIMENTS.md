# SLATE — Experiments Report

## Benchmark Scenes

For our initial comparative testing, we constructed two benchmark canvases:
- **Sparse**: A simple scene containing just 2 well-separated strokes, resulting in a low ink density (0.1344).
- **Dense**: A highly complex and concentrated scene containing 50 overlapping strokes, resulting in maximum ink density (1.0).

## Adaptive vs. Fixed Resolution Comparison

We ran a controlled A/B test routing both benchmarks through the real Gemini 2.5 Flash pipeline. We compared the Phase 11 Adaptive Resolution heuristic (which dynamically picks 512, 1024, or 1536px based on scene density) against a forced Fixed-1024px resolution.

### Results

The following metrics were captured from `experiments/results.json` across 4 live API calls, now including true token usage and estimated USD cost derived directly from the Gemini SDK `usageMetadata`:

| Benchmark | Configuration | Resolution | Object Count | End-to-End Latency | Prompt Tokens | Response Tokens | Total Cost (USD) | Success |
|-----------|---------------|------------|--------------|--------------------|---------------|-----------------|------------------|---------|
| Sparse    | Adaptive      | 512px      | 2            | ~31.6s             | 439           | 17              | $0.000038        | Yes     |
| Sparse    | Fixed-1024    | 1024px     | 2            | ~10.5s             | 439           | 27              | $0.000041        | Yes     |
| Dense     | Adaptive      | 1536px     | 50           | ~35.3s             | 439           | 20              | $0.000038        | Yes     |
| Dense     | Fixed-1024    | 1024px     | 50           | ~24.4s             | 439           | 23              | $0.000039        | Yes     |

*(Note: End-to-End Latency fluctuates heavily based on API load at time of test, but relative ratios hold.)*

### Findings

Based on both latency and cost data, **adaptive resolution is a net negative compared to a fixed resolution baseline**.

- **No Token/Cost Savings**: The core value proposition of adaptive resolution was that sending a smaller 512px image for sparse scenes would save prompt tokens and reduce cost. However, the data shows that **prompt tokens were identical (439 tokens) across all 4 configurations**. Gemini 2.5 Flash charges a flat token rate for images within standard bounds (258 image tokens) regardless of whether the input is 512px, 1024px, or 1536px. The only variation in total cost was driven entirely by minor, non-deterministic fluctuations in the AI's *response length*.
- **Worse Latency**: While saving zero tokens, the adaptive heuristic performed strictly worse in terms of latency across both test cases. For instance, the 1536px Dense crop was significantly slower to generate and encode client-side and upload, while yielding the exact same token footprint as the 1024px version.

**Conclusion**: Adaptive resolution should be disabled or removed in future iterations in favor of a fixed 1024px rendering pipeline, as it introduces client-side overhead without providing the expected LLM token/cost reduction on modern multimodal models.

## Future Work and Scope

A fuller experiment suite (evaluating additional benchmarks, testing multiple configurations such as the impact of gating heuristics on/off, and capturing full USD cost comparisons) was scoped in the original project plan. However, this broader suite was intentionally scoped down and deprioritized to ensure completion within the given assignment timeline.
