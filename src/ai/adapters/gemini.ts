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
    this.ai = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash as the default for multimodal streaming
    this.model = 'gemini-1.5-flash';
  }

  async sendRequest(
    payload: MultimodalRequestPayload,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const generativeModel = this.ai.getGenerativeModel({ model: this.model });

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
