import type { MultimodalRequestPayload } from '../composition.ts';
import { validateAIOutput, type AIOutputSchema } from '../rendering/schema.ts';
import { CURRENT_EXPERIMENT_CONFIG } from '../../config/experiment.ts';

export type RequestState =
  | 'encoding'
  | 'context_extraction'
  | 'sending'
  | 'waiting'
  | 'streaming'
  | 'rendering'
  | 'completed'
  | 'cancelled'
  | 'superseded'
  | 'timeout'
  | 'error';

export interface AIRequest {
  id: string;
  state: RequestState;
  payload: MultimodalRequestPayload;
  timestamps: Partial<Record<RequestState, number>>;
  error?: string;
  parsedData?: AIOutputSchema;
  contextBounds?: import('../../utils/geometry.ts').BoundingBox | null;
  configId: string;
  promptVersion: string;
}

export class RequestLifecycleManager {
  private activeRequest: AIRequest | null = null;
  private requests: Map<string, AIRequest> = new Map();
  private timeoutDuration: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(timeoutDurationMs = 30000) {
    this.timeoutDuration = timeoutDurationMs;
  }

  createRequest(id: string, payload: MultimodalRequestPayload, contextBounds?: import('../../utils/geometry.ts').BoundingBox | null): AIRequest {
    if (this.activeRequest && !this.isTerminalState(this.activeRequest.state)) {
      this.transition(this.activeRequest.id, 'superseded');
    }

    const request: AIRequest = {
      id,
      state: 'encoding',
      payload,
      contextBounds,
      configId: CURRENT_EXPERIMENT_CONFIG.configId,
      promptVersion: CURRENT_EXPERIMENT_CONFIG.promptVersion,
      timestamps: {
        encoding: Date.now()
      }
    };

    this.activeRequest = request;
    this.requests.set(id, request);
    
    return request;
  }

  getRequest(id: string): AIRequest | undefined {
    return this.requests.get(id);
  }

  getActiveRequest(): AIRequest | null {
    return this.activeRequest;
  }

  transition(id: string, newState: RequestState, data?: string): void {
    const request = this.requests.get(id);
    if (!request) return;

    // Do not transition if already in a terminal state
    if (this.isTerminalState(request.state)) {
      return;
    }

    if (newState === 'completed' && data) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (e: any) {
        request.state = 'error';
        request.timestamps['error'] = Date.now();
        request.error = `Failed to parse AI response as JSON: ${e.message}`;
        this.clearCurrentTimeout();
        return;
      }

      const validation = validateAIOutput(parsed);
      if (!validation.valid) {
        request.state = 'error';
        request.timestamps['error'] = Date.now();
        request.error = `Invalid AI response schema: ${validation.error}`;
        this.clearCurrentTimeout();
        return;
      }
      
      request.parsedData = validation.data;
    }

    request.state = newState;
    request.timestamps[newState] = Date.now();

    if (newState === 'error' && data) {
      request.error = data;
    }

    if (newState === 'waiting') {
      this.startTimeout(id);
    }

    // Clear timeout if we get a response (streaming, completed, etc.) or reach a terminal state
    if (newState === 'streaming' || this.isTerminalState(newState)) {
      this.clearCurrentTimeout();
    }
  }

  cancel(id: string): void {
    this.transition(id, 'cancelled');
  }

  clearActiveRequest(): void {
    this.activeRequest = null;
  }

  public isTerminalState(state: RequestState): boolean {
    return ['completed', 'cancelled', 'superseded', 'timeout', 'error'].includes(state);
  }

  private startTimeout(id: string) {
    this.clearCurrentTimeout();
    this.timeoutId = setTimeout(() => {
      this.transition(id, 'timeout');
    }, this.timeoutDuration);
  }

  private clearCurrentTimeout() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
