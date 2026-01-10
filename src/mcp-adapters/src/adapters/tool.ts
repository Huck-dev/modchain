/**
 * Tool Adapter
 *
 * Handles external tool execution - running scripts, APIs, and integrations.
 * Provides a unified interface for agents to interact with external services.
 */

import { z } from 'zod';
import {
  AdapterInfo,
  AdapterMethod,
  ExecutionContext,
} from '../types/index.js';
import { BaseAdapter } from './base.js';

// Tool request/response schemas
export const ToolCallRequestSchema = z.object({
  tool: z.string(),
  action: z.string(),
  params: z.record(z.unknown()).optional(),
  timeout_ms: z.number().optional().default(30000),
});

export const ToolCallResponseSchema = z.object({
  success: z.boolean(),
  result: z.unknown(),
  error: z.string().optional(),
  execution_time_ms: z.number(),
});

export const HttpRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeout_ms: z.number().optional().default(30000),
});

export const ShellCommandSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  timeout_ms: z.number().optional().default(60000),
});

export type ToolCallRequest = z.infer<typeof ToolCallRequestSchema>;
export type ToolCallResponse = z.infer<typeof ToolCallResponseSchema>;

// Built-in tools registry
const builtinTools: Map<string, {
  description: string;
  actions: string[];
}> = new Map([
  ['calculator', { description: 'Math calculations', actions: ['evaluate'] }],
  ['datetime', { description: 'Date and time operations', actions: ['now', 'format', 'parse'] }],
  ['json', { description: 'JSON manipulation', actions: ['parse', 'stringify', 'query'] }],
  ['http', { description: 'HTTP requests', actions: ['request'] }],
  ['shell', { description: 'Shell command execution', actions: ['exec'] }],
]);

export class ToolAdapter extends BaseAdapter {
  readonly info: AdapterInfo = {
    name: 'tool',
    version: '0.1.0',
    description: 'External tool execution - APIs, scripts, and integrations',
    capabilities: ['tool-execution', 'http-requests', 'shell-commands'],
    requirements: {
      memory: {
        min_mb: 512,
      },
    },
  };

  readonly methods: Map<string, AdapterMethod> = new Map([
    [
      'call',
      {
        name: 'call',
        description: 'Execute a tool action',
        parameters: ToolCallRequestSchema,
        returns: ToolCallResponseSchema,
      },
    ],
    [
      'http',
      {
        name: 'http',
        description: 'Make an HTTP request',
        parameters: HttpRequestSchema,
        returns: z.object({
          status: z.number(),
          headers: z.record(z.string()),
          body: z.unknown(),
        }),
      },
    ],
    [
      'shell',
      {
        name: 'shell',
        description: 'Execute a shell command (sandboxed)',
        parameters: ShellCommandSchema,
        returns: z.object({
          exit_code: z.number(),
          stdout: z.string(),
          stderr: z.string(),
        }),
      },
    ],
    [
      'list_tools',
      {
        name: 'list_tools',
        description: 'List available tools',
        parameters: z.object({}),
        returns: z.array(z.object({
          name: z.string(),
          description: z.string(),
          actions: z.array(z.string()),
        })),
      },
    ],
  ]);

  async execute(
    method: string,
    params: unknown,
    context: ExecutionContext
  ): Promise<unknown> {
    switch (method) {
      case 'call':
        return this.call(params, context);
      case 'http':
        return this.http(params, context);
      case 'shell':
        return this.shell(params, context);
      case 'list_tools':
        return this.listTools();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async call(
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolCallResponse> {
    const request = ToolCallRequestSchema.parse(params);
    const startTime = Date.now();

    console.log(`[tool] Calling ${request.tool}.${request.action}`);

    try {
      let result: unknown;

      switch (request.tool) {
        case 'calculator':
          result = this.calculator(request.action, request.params);
          break;
        case 'datetime':
          result = this.datetime(request.action, request.params);
          break;
        case 'json':
          result = this.json(request.action, request.params);
          break;
        default:
          throw new Error(`Unknown tool: ${request.tool}`);
      }

      return {
        success: true,
        result,
        execution_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        execution_time_ms: Date.now() - startTime,
      };
    }
  }

  private async http(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
    const request = HttpRequestSchema.parse(params);

    console.log(`[tool] HTTP ${request.method} ${request.url}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeout_ms);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: unknown;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return {
        status: response.status,
        headers,
        body,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async shell(
    params: unknown,
    context: ExecutionContext
  ): Promise<{ exit_code: number; stdout: string; stderr: string }> {
    const request = ShellCommandSchema.parse(params);

    console.log(`[tool] Shell: ${request.command} ${(request.args || []).join(' ')}`);

    // For security, only allow specific safe commands
    const allowedCommands = ['echo', 'date', 'pwd', 'whoami', 'uname'];
    const cmd = request.command.split('/').pop() || request.command;

    if (!allowedCommands.includes(cmd)) {
      return {
        exit_code: 1,
        stdout: '',
        stderr: `Command not allowed: ${request.command}. Allowed: ${allowedCommands.join(', ')}`,
      };
    }

    // Simulate command execution (in production, use child_process with sandboxing)
    return {
      exit_code: 0,
      stdout: `Simulated output for: ${request.command} ${(request.args || []).join(' ')}`,
      stderr: '',
    };
  }

  private listTools(): Array<{ name: string; description: string; actions: string[] }> {
    return Array.from(builtinTools.entries()).map(([name, info]) => ({
      name,
      description: info.description,
      actions: info.actions,
    }));
  }

  // Built-in tool implementations
  private calculator(action: string, params?: Record<string, unknown>): unknown {
    if (action !== 'evaluate') {
      throw new Error(`Unknown calculator action: ${action}`);
    }
    const expr = String(params?.expression || '0');
    // Simple safe eval for math expressions
    const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
    return Function(`"use strict"; return (${sanitized})`)();
  }

  private datetime(action: string, params?: Record<string, unknown>): unknown {
    switch (action) {
      case 'now':
        return new Date().toISOString();
      case 'format':
        const date = params?.date ? new Date(String(params.date)) : new Date();
        return date.toLocaleString(String(params?.locale || 'en-US'));
      case 'parse':
        return new Date(String(params?.date)).toISOString();
      default:
        throw new Error(`Unknown datetime action: ${action}`);
    }
  }

  private json(action: string, params?: Record<string, unknown>): unknown {
    switch (action) {
      case 'parse':
        return JSON.parse(String(params?.json));
      case 'stringify':
        return JSON.stringify(params?.data, null, 2);
      case 'query':
        // Simple JSON path query
        const data = params?.data as Record<string, unknown>;
        const path = String(params?.path || '').split('.');
        let result: unknown = data;
        for (const key of path) {
          if (result && typeof result === 'object') {
            result = (result as Record<string, unknown>)[key];
          }
        }
        return result;
      default:
        throw new Error(`Unknown json action: ${action}`);
    }
  }
}
