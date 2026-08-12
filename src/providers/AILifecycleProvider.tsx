import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { RequestLifecycleManager, type AIRequest } from '../ai/lifecycle/state-machine.ts';
import { GeminiClient } from '../ai/adapters/gemini.ts';
import { extractContext } from '../context-extraction/extractor.ts';
import { composeMultimodalRequest, canonicalSerialize } from '../ai/composition.ts';
import type { CanvasObject } from '../objects/canvas-object.ts';
import { evaluateGate } from '../ai/gating/gate.ts';
import { computeRequestHash, DedupCache } from '../ai/gating/dedup.ts';

interface AILifecycleContextValue {
  activeRequest: AIRequest | null;
  askAI: (objects: CanvasObject[], selection: { ids: string[] } | null, isManualTrigger?: boolean, lastChangeTimestamp?: number) => Promise<void>;
  cancelRequest: () => void;
  clearRequest: () => void;
}

const AILifecycleContext = createContext<AILifecycleContextValue | null>(null);

export function AILifecycleProvider({ children }: { children: React.ReactNode }) {
  const manager = useRef(new RequestLifecycleManager()).current;
  const gemini = useRef(new GeminiClient()).current;
  const dedupCache = useRef(new DedupCache()).current;
  
  const [activeRequest, setActiveRequest] = useState<AIRequest | null>(null);
  
  const sync = useCallback(() => {
    const req = manager.getActiveRequest();
    if (req) {
      setActiveRequest({ ...req, timestamps: { ...req.timestamps } });
    } else {
      setActiveRequest(null);
    }
  }, [manager]);

  const askAI = useCallback(async (objects: CanvasObject[], selection: { ids: string[] } | null, isManualTrigger = true, lastChangeTimestamp = Date.now()) => {
    // 1. Context extraction (extract what the user is looking at/selecting)
    const result = extractContext(objects, selection, Date.now());
    if (result.strategy === 'none' || result.objectIds.length === 0) {
      console.warn("No context found for AI");
      return;
    }
    
    // GATING CHECK
    const gateResult = evaluateGate(objects, result, lastChangeTimestamp, Date.now(), isManualTrigger);
    if (!gateResult.allowed) {
      console.log('Request blocked by gating:', gateResult.reasons);
      return;
    }

    // 2. Compose payload and compute deterministic hash for dedup
    const payload = composeMultimodalRequest(result, objects);
    const canonicalData = canonicalSerialize(result, objects);
    const hash = await computeRequestHash(canonicalData);
    
    // 3. Create request in 'encoding' state
    const id = Date.now().toString();
    const req = manager.createRequest(id, payload, result.bounds, result.confidence.level);
    sync();

    // The prompt requires we transition through these specific states:
    // encoding -> context_extraction -> sending -> waiting -> (streaming) -> rendering -> completed
    
    // We already did context_extraction technically, but we reflect it in the lifecycle here
    manager.transition(id, 'context_extraction');
    sync();

    manager.transition(id, 'sending');
    sync();

    const cachedResult = dedupCache.get(hash);
    if (cachedResult) {
      console.log('Dedup cache hit for hash:', hash);
      manager.transition(id, 'waiting');
      sync();
      manager.transition(id, 'rendering');
      sync();
      manager.transition(id, 'completed', JSON.stringify(cachedResult));
      sync();
      return;
    }

    try {
      manager.transition(id, 'waiting');
      sync();

      let streamStarted = false;

      const responseText = await gemini.sendRequest(payload, () => {
        if (!streamStarted) {
          manager.transition(id, 'streaming');
          sync();
          streamStarted = true;
        }
      });
      
      // If the request was cancelled or superseded mid-flight, do not log or continue
      if (manager.isTerminalState(req.state) && req.state !== 'completed') {
        return;
      }

      manager.transition(id, 'rendering');
      sync();
      
      // Phase 7 part 3 requires we simply log the final text to the console
      console.log('AI Response:', responseText);

      manager.transition(id, 'completed', responseText);
      sync();
      
      const finalReq = manager.getRequest(id);
      if (finalReq && finalReq.parsedData) {
        dedupCache.set(hash, finalReq.parsedData);
      }
      
    } catch (err: any) {
      if (!manager.isTerminalState(req.state)) {
        manager.transition(id, 'error', err.message);
        sync();
      }
    }
  }, [manager, gemini, dedupCache, sync]);

  const cancelRequest = useCallback(() => {
    const req = manager.getActiveRequest();
    if (req) {
      manager.cancel(req.id);
      sync();
    }
  }, [manager, sync]);

  const clearRequest = useCallback(() => {
    manager.clearActiveRequest();
    sync();
  }, [manager, sync]);

  return (
    <AILifecycleContext.Provider value={{ activeRequest, askAI, cancelRequest, clearRequest }}>
      {children}
    </AILifecycleContext.Provider>
  );
}

export function useAILifecycle() {
  const ctx = useContext(AILifecycleContext);
  if (!ctx) throw new Error('useAILifecycle must be used within an AILifecycleProvider');
  return ctx;
}
