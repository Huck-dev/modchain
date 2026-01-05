/**
 * RhizOS MCP Adapters
 *
 * Hardware abstraction layers that enable compute jobs to run on different hardware.
 * Each adapter handles a specific type of workload (LLM inference, image generation, etc.)
 */

import { BaseAdapter } from './adapters/base.js';
import { LlmInferenceAdapter } from './adapters/llm-inference.js';

// Export types
export * from './types/index.js';
export { BaseAdapter } from './adapters/base.js';
export { LlmInferenceAdapter } from './adapters/llm-inference.js';

// Adapter registry
const adapters: Map<string, BaseAdapter> = new Map();

/**
 * Register an adapter
 */
export function registerAdapter(adapter: BaseAdapter): void {
  adapters.set(adapter.info.name, adapter);
  console.log(`[AdapterRegistry] Registered adapter: ${adapter.info.name}`);
}

/**
 * Get an adapter by name
 */
export function getAdapter(name: string): BaseAdapter | undefined {
  return adapters.get(name);
}

/**
 * List all registered adapters
 */
export function listAdapters(): BaseAdapter[] {
  return Array.from(adapters.values());
}

/**
 * Initialize all adapters
 */
export async function initializeAdapters(): Promise<void> {
  for (const adapter of adapters.values()) {
    await adapter.initialize();
  }
}

/**
 * Shutdown all adapters
 */
export async function shutdownAdapters(): Promise<void> {
  for (const adapter of adapters.values()) {
    await adapter.shutdown();
  }
}

// Register built-in adapters
registerAdapter(new LlmInferenceAdapter());

// Main entry point when run directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  console.log('RhizOS MCP Adapters');
  console.log('=====================');
  console.log('');
  console.log('Available adapters:');
  for (const adapter of listAdapters()) {
    console.log(`  - ${adapter.info.name} v${adapter.info.version}`);
    console.log(`    ${adapter.info.description}`);
    console.log(`    Capabilities: ${adapter.info.capabilities.join(', ')}`);
    console.log('');
  }
}
