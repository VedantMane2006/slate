import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import type { MultimodalRequestPayload } from '../composition.ts';

// We implement TRUE token streaming here (using generateContentStream).
// This allows us to receive the response iteratively, significantly improving 
// Time To First Token (TTFT) perception in the UI later in Phase 9.

export class GeminiClient {
  private ai: GoogleGenerativeAI;
  private model: string;

  constructor() {
    // Read the API key from Vite's environment variables
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // Log masked API key for debugging
    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...` : 'empty';
    console.log(`Initialized GeminiClient with API key: ${maskedKey}`);
    
    this.ai = new GoogleGenerativeAI(apiKey);
    // Using gemini-flash-lite-latest as the cheapest/latest available multimodal model
    this.model = 'gemini-flash-lite-latest';
  }

  async sendRequest(
    payload: MultimodalRequestPayload,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const systemInstruction = `You are an AI assistant analyzing a user's canvas.
Your job is to ANSWER or SOLVE the question, problem, or prompt shown in the image and fragments you receive.
Do NOT simply describe what the image looks like. If the image shows a math problem (like "23*2=?"), compute and provide the actual answer. If it asks a question (like "How to make tea in 3 steps?"), answer the question with the steps.
The 'explanation' field should contain this actual answer or solution.
You must respond ONLY with valid JSON matching the following schema.
Do not include any prose outside the JSON, and do not include markdown blocks like \`\`\`json.
Include 'latex', 'table', or 'graph' fields only when relevant to the content.

Schema:
{
  "explanation": "string",
  "latex": "string (optional)",
  "table": [["string", "array"], ["of", "strings"]] (optional),
  "graph": {
    "type": "bar" | "line",
    "labels": ["string array"],
    "values": [1, 2, 3] (number array)
  } (optional)
}`;

    const generativeModel = this.ai.getGenerativeModel({ 
      model: this.model,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const parts: Part[] = [];

    // Add structural fragments first
    for (const frag of payload.fragments) {
      if (frag.kind === 'text') {
        parts.push({ text: frag.data });
      } else if (frag.kind === 'json') {
        parts.push({ text: JSON.stringify(frag.data) });
      }
    }

    // Add image if present
    if (payload.image) {
      // payload.image is expected to be a data URL like "data:image/png;base64,..."
      const match = payload.image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    // Call the streaming API
    const result = await generativeModel.generateContentStream(parts);
    
    let fullText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      if (onChunk) {
        onChunk(chunkText);
      }
    }

    return fullText;
  }
}
