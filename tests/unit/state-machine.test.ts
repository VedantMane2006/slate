import { describe, it, expect, beforeEach } from 'vitest';
import { RequestLifecycleManager } from '../../src/ai/lifecycle/state-machine.ts';

describe('RequestLifecycleManager', () => {
  let manager: RequestLifecycleManager;
  const mockPayload = { image: '', fragments: [] };

  beforeEach(() => {
    manager = new RequestLifecycleManager(10); // 10ms timeout for tests
  });

  it('happy-path transitions occur in the correct order with timestamps recorded', () => {
    const req = manager.createRequest('req-1', mockPayload);
    expect(req.state).toBe('encoding');
    expect(req.timestamps.encoding).toBeTypeOf('number');

    manager.transition('req-1', 'sending');
    expect(req.state).toBe('sending');
    expect(req.timestamps.sending).toBeTypeOf('number');

    manager.transition('req-1', 'waiting');
    expect(req.state).toBe('waiting');
    expect(req.timestamps.waiting).toBeTypeOf('number');

    manager.transition('req-1', 'streaming');
    expect(req.state).toBe('streaming');
    expect(req.timestamps.streaming).toBeTypeOf('number');

    manager.transition('req-1', 'completed');
    expect(req.state).toBe('completed');
    expect(req.timestamps.completed).toBeTypeOf('number');
  });

  it('cancel() during waiting or streaming results in cancelled, not error or completed', () => {
    const req = manager.createRequest('req-1', mockPayload);
    manager.transition('req-1', 'waiting');

    manager.cancel('req-1');
    expect(req.state).toBe('cancelled');
    expect(req.timestamps.cancelled).toBeDefined();

    // After cancellation, it should ignore further non-superseding transitions
    manager.transition('req-1', 'completed');
    expect(req.state).toBe('cancelled');
    expect(req.timestamps.completed).toBeUndefined();
  });

  it('triggering request B while request A is in-flight marks A as superseded; late responses for A are ignored', () => {
    const reqA = manager.createRequest('req-A', mockPayload);
    manager.transition('req-A', 'waiting');

    // Triggering request B should automatically supersede A
    const reqB = manager.createRequest('req-B', mockPayload);

    expect(reqA.state).toBe('superseded');
    expect(reqA.timestamps.superseded).toBeDefined();

    expect(reqB.state).toBe('encoding');
    expect(manager.getActiveRequest()?.id).toBe('req-B');

    // Simulate A\'s late response arriving
    manager.transition('req-A', 'streaming');
    // Because reqA is in a terminal state (superseded), the transition is ignored
    expect(reqA.state).toBe('superseded');
    expect(reqA.timestamps.streaming).toBeUndefined();
  });

  it('a simulated timeout reaches timeout state', async () => {
    const req = manager.createRequest('req-timeout', mockPayload);
    manager.transition('req-timeout', 'waiting');

    // Wait for the 10ms timeout to trigger
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(req.state).toBe('timeout');
    expect(req.timestamps.timeout).toBeDefined();
  });

  it('clear timeout if completed successfully before timeout', async () => {
    const req = manager.createRequest('req-clear', mockPayload);
    manager.transition('req-clear', 'waiting');

    manager.transition('req-clear', 'completed', JSON.stringify({ explanation: 'test' }));

    // Wait past the 10ms timeout
    await new Promise((resolve) => setTimeout(resolve, 20));

    // State should still be completed, not timeout
    expect(req.state).toBe('completed');
  });

  it('a completed request with valid JSON correctly attaches parsed AIOutputSchema data', () => {
    const req = manager.createRequest('req-valid', mockPayload);
    const validJson = JSON.stringify({
      explanation: 'A valid explanation',
      latex: '\\pi'
    });

    manager.transition('req-valid', 'completed', validJson);

    expect(req.state).toBe('completed');
    expect(req.parsedData).toBeDefined();
    expect(req.parsedData?.explanation).toBe('A valid explanation');
    expect(req.parsedData?.latex).toBe('\\pi');
  });

  it('a completed request with invalid/malformed JSON correctly captures an honest error state and message, without throwing an unhandled exception', () => {
    // Case 1: Unparseable JSON
    const req1 = manager.createRequest('req-invalid-1', mockPayload);
    manager.transition('req-invalid-1', 'completed', 'This is not JSON');
    expect(req1.state).toBe('error');
    expect(req1.error).toMatch(/Failed to parse AI response as JSON/);

    // Case 2: Parseable JSON, but invalid schema (missing explanation)
    const req2 = manager.createRequest('req-invalid-2', mockPayload);
    manager.transition('req-invalid-2', 'completed', JSON.stringify({ latex: 'only latex' }));
    expect(req2.state).toBe('error');
    expect(req2.error).toMatch(/Invalid AI response schema/);
    expect(req2.parsedData).toBeUndefined();
  });

  it('clearActiveRequest() drops the active request without modifying its terminal state', () => {
    manager.createRequest('req-clear-active', mockPayload);
    manager.transition('req-clear-active', 'completed', JSON.stringify({ explanation: 'test' }));
    
    expect(manager.getActiveRequest()?.id).toBe('req-clear-active');
    manager.clearActiveRequest();
    
    expect(manager.getActiveRequest()).toBeNull();
    // The request itself should remain in the map and retain its state
    expect(manager.getRequest('req-clear-active')?.state).toBe('completed');
  });

  it('a newly created AIRequest has configId and promptVersion populated', () => {
    const req = manager.createRequest('req-config', mockPayload);
    expect(req.configId).toBe('default');
    expect(req.promptVersion).toBe('1.0.0');
  });
});
