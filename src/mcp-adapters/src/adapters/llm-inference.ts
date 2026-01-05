/**
 * LLM Inference Adapter
 *
 * Handles LLM inference jobs using local models (Ollama, vLLM, etc.)
 * This is the "tail" that connects compute jobs to actual LLM runtimes.
 */

import { z } from 'zod';
import {
  AdapterInfo,
  AdapterMethod,
  ExecutionContext,
  LlmInferenceRequestSchema,
  LlmInferenceResponse,
} from '../types/index.js';
import { BaseAdapter } from './base.js';

export class LlmInferenceAdapter extends BaseAdapter {
  readonly info: AdapterInfo = {
    name: 'llm-inference',
    version: '0.1.0',
    description: 'LLM inference adapter supporting Ollama and vLLM backends',
    capabilities: ['text-generation', 'chat-completion'],
    requirements: {
      gpu: {
        required: false, // Can run on CPU for small models
        min_vram_mb: 4096, // 4GB minimum for GPU inference
        compute_apis: ['cuda', 'rocm'],
      },
      memory: {
        min_mb: 8192, // 8GB RAM minimum
      },
    },
  };

  readonly methods: Map<string, AdapterMethod> = new Map([
    [
      'generate',
      {
        name: 'generate',
        description: 'Generate text from a prompt using an LLM',
        parameters: LlmInferenceRequestSchema,
        returns: z.object({
          text: z.string(),
          tokens_generated: z.number(),
        }),
      },
    ],
    [
      'list_models',
      {
        name: 'list_models',
        description: 'List available models on this node',
        parameters: z.object({}),
        returns: z.array(z.object({
          name: z.string(),
          size: z.number(),
          quantization: z.string().optional(),
        })),
      },
    ],
  ]);

  private ollamaUrl: string = 'http://localhost:11434';

  async initialize(): Promise<void> {
    await super.initialize();

    // Check if Ollama is available
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models: Array<{ name: string }> };
        console.log(`[llm-inference] Ollama detected with ${data.models?.length || 0} models`);
      }
    } catch (error) {
      console.warn('[llm-inference] Ollama not available, will try vLLM or other backends');
    }
  }

  async execute(
    method: string,
    params: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    switch (method) {
      case 'generate':
        return this.generate(params, context);
      case 'list_models':
        return this.listModels();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async generate(
    params: unknown,
    context: ExecutionContext
  ): Promise<LlmInferenceResponse> {
    const request = LlmInferenceRequestSchema.parse(params);

    console.log(`[llm-inference] Generating with model ${request.model}, prompt length: ${request.prompt.length}`);

    // Try Ollama first
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: request.temperature,
            top_p: request.top_p,
            num_predict: request.max_tokens,
            stop: request.stop_sequences,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        response: string;
        eval_count: number;
        prompt_eval_count: number;
        done: boolean;
        done_reason?: string;
      };

      return {
        text: data.response,
        tokens_generated: data.eval_count || 0,
        tokens_prompt: data.prompt_eval_count || 0,
        finish_reason: data.done_reason === 'stop' ? 'stop' : 'length',
      };
    } catch (error) {
      console.error('[llm-inference] Ollama inference failed:', error);
      throw error;
    }
  }

  private async listModels(): Promise<Array<{ name: string; size: number; quantization?: string }>> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json() as {
        models: Array<{
          name: string;
          size: number;
          details?: { quantization_level?: string };
        }>;
      };

      return (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        quantization: m.details?.quantization_level,
      }));
    } catch (error) {
      console.error('[llm-inference] Failed to list models:', error);
      return [];
    }
  }
}
