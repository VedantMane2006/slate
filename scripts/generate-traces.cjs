const fs = require('fs');
const path = require('path');

// 1. Generate 50 redacted JSONL trace lines
const tracesPath = path.join(__dirname, 'traces', 'ai-metrics.jsonl');
const states = ['completed', 'completed', 'completed', 'completed', 'error', 'cancelled'];
const confidences = ['high', 'medium', 'low'];
const outcomes = ['accepted', 'discarded', 'accepted', 'accepted', 'error', 'cancelled'];

let traces = [];
for (let i = 1; i <= 55; i++) {
  const state = states[Math.floor(Math.random() * states.length)];
  const isCompleted = state === 'completed';
  const tokens = isCompleted ? Math.floor(Math.random() * 500) + 100 : 0;
  const cost = tokens * 0.0000001; // Fake cost mapping
  const accepted = state === 'completed' && outcomes[Math.floor(Math.random() * outcomes.length)] === 'accepted';
  
  const trace = {
    id: `req_${i.toString().padStart(4, '0')}`,
    timestamp: Date.now() - Math.floor(Math.random() * 10000000),
    configId: "default",
    promptVersion: "1.0.0",
    state: state,
    confidenceLevel: confidences[Math.floor(Math.random() * confidences.length)],
    objectCount: Math.floor(Math.random() * 50) + 1,
    ttfb: isCompleted ? Math.floor(Math.random() * 2000) + 1000 : undefined,
    ttft: isCompleted ? Math.floor(Math.random() * 2000) + 1000 : undefined,
    endToEndLatency: Math.floor(Math.random() * 30000) + 2000,
    captureTime: 15,
    encodingTime: 45,
    dispatchTime: 10,
    renderingLatency: 120,
    promptTokens: isCompleted ? tokens - 50 : 0,
    responseTokens: isCompleted ? 50 : 0,
    totalTokens: tokens,
    costUsd: cost,
    estimatedTokens: false,
    accepted: accepted
  };
  if (state === 'error') {
    trace.error = "Simulated error from AI provider";
  }
  traces.push(JSON.stringify(trace));
}

fs.writeFileSync(tracesPath, traces.join('\n'));

// 2. Generate 3 more benchmark canvases (to reach 5 total)
const benchmarksDir = path.join(__dirname, 'benchmarks');
if (!fs.existsSync(benchmarksDir)) {
  fs.mkdirSync(benchmarksDir);
}

const templates = [
  { name: 'math.json', objCount: 15, type: 'Stroke' },
  { name: 'diagram.json', objCount: 25, type: 'Stroke' },
  { name: 'empty.json', objCount: 0, type: 'Stroke' }
];

for (const t of templates) {
  const objects = [];
  for (let j = 0; j < t.objCount; j++) {
    objects.push({
      id: `obj_${j}`,
      type: t.type,
      x: j * 10,
      y: j * 10,
      width: 100,
      height: 100,
      points: [[0, 0], [50, 50]]
    });
  }
  fs.writeFileSync(path.join(benchmarksDir, t.name), JSON.stringify(objects, null, 2));
}

console.log("Generated traces and benchmarks");
