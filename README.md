# SLATE

AI-augmented infinite canvas for handwritten and structured work (math, notes, diagrams).

## Quick start

1. **Environment Setup**:
   Create a `.env` file in the project root and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY="your_api_key_here"
   ```

2. **Install and Run**:
   ```bash
   npm install
   npm run dev
   ```

## Scripts

| Command          | Description                   |
| ---------------- | ----------------------------- |
| `npm run dev`    | Start Vite dev server         |
| `npm run build`  | Type-check and production build |
| `npm run lint`   | Run ESLint                    |
| `npm run format` | Run Prettier                  |
| `npm test`       | Run Vitest                    |

## Governance

This repo is governed by four documents in the project root — read them before contributing:

- **PRD.md** — product requirements and scope
- **Architecture.md** — technical architecture and folder ownership
- **Rules.md** — constraints for AI coding tools and contributors
- **Memory.md** — progress log and decisions ledger

## Data Limitations

Real trace count is N=15 (not 50), and benchmark canvas count is 2 (not 5). This is due to free-tier daily quota constraints during a one-week solo build.
