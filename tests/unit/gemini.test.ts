import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from '../../src/ai/adapters/gemini.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { MultimodalRequestPayload } from '../../src/ai/composition.ts';

// Mock the GoogleGenerativeAI module completely
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContentStream: vi.fn().mockImplementation(async () => {
            // Mock streaming response
            const chunks = ['mocked', ' response', ' text'];
            async function* mockStream() {
              for (const chunk of chunks) {
                yield { text: () => chunk };
              }
            }
            return {
              stream: mockStream()
            };
          })
        })
      };
    })
  };
});

describe('GeminiClient', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    
    // Set mock env var for VITE_GEMINI_API_KEY
    vi.stubGlobal('import', {
      meta: {
        env: {
          VITE_GEMINI_API_KEY: 'mock-api-key'
        }
      }
    });
  });

  it('sendRequest correctly constructs the multimodal payload and resolves with the mocked response text', async () => {
    const client = new GeminiClient();
    const payload: MultimodalRequestPayload = {
      image: 'data:image/png;base64,mockedbase64data',
      fragments: [
        { kind: 'text', data: 'hello' },
        { kind: 'json', data: { rows: 2 } }
      ]
    };

    const response = await client.sendRequest(payload);
    expect(response).toBe('mocked response text');

    // Assert that the request payload includes the schema instruction and JSON config
    const getGenerativeModelMock = (GoogleGenerativeAI as any).mock.results[0].value.getGenerativeModel;
    expect(getGenerativeModelMock).toHaveBeenCalled();
    const callArgs = getGenerativeModelMock.mock.calls[0][0];
    
    expect(callArgs.systemInstruction).toMatch(/Schema:/);
    expect(callArgs.systemInstruction).toMatch(/ANSWER or SOLVE/);
    expect(callArgs.systemInstruction).toMatch(/"explanation": "string"/);
    expect(callArgs.generationConfig.responseMimeType).toBe('application/json');
  });

  it('onChunk is called correctly if streaming is implemented', async () => {
    const client = new GeminiClient();
    const payload: MultimodalRequestPayload = {
      image: '',
      fragments: []
    };

    const chunksReceived: string[] = [];
    const response = await client.sendRequest(payload, (chunk) => {
      chunksReceived.push(chunk);
    });

    expect(response).toBe('mocked response text');
    expect(chunksReceived).toEqual(['mocked', ' response', ' text']);
  });
});
