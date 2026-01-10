/**
 * RhizOS Flow Storage Service
 *
 * Handles saving, loading, and managing flows.
 * Uses localStorage for browser-based storage (Tauri will use filesystem).
 */

import {
  Flow,
  FlowSchema,
  ExportableFlow,
  createEmptyFlow,
  toExportableFlow,
  validateFlow,
} from '../../../shared/schemas/flows';

// ============ Constants ============

const STORAGE_KEY = 'rhizos_flows_v1';
const RECENT_FLOWS_KEY = 'rhizos_recent_flows_v1';
const MAX_RECENT_FLOWS = 10;

// ============ Types ============

export interface FlowListItem {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface StoredFlows {
  version: number;
  flows: Record<string, Flow>;
  recentIds: string[];
}

// ============ Flow Storage Class ============

export class FlowStorage {
  private flows: Map<string, Flow> = new Map();
  private recentIds: string[] = [];
  private loaded = false;

  /**
   * Initialize storage - load from localStorage
   */
  load(): void {
    if (this.loaded) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredFlows = JSON.parse(stored);
        this.flows = new Map(Object.entries(data.flows));
        this.recentIds = data.recentIds || [];
      }
    } catch (error) {
      console.error('Failed to load flows:', error);
    }

    this.loaded = true;
  }

  /**
   * Save to localStorage
   */
  private persist(): void {
    try {
      const data: StoredFlows = {
        version: 1,
        flows: Object.fromEntries(this.flows),
        recentIds: this.recentIds,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist flows:', error);
      throw new Error('Failed to save flow');
    }
  }

  /**
   * Add flow ID to recent list
   */
  private addToRecent(flowId: string): void {
    this.recentIds = [
      flowId,
      ...this.recentIds.filter(id => id !== flowId),
    ].slice(0, MAX_RECENT_FLOWS);
  }

  /**
   * Create a new flow
   */
  createFlow(name: string = 'Untitled Flow'): Flow {
    this.load();
    const flow = createEmptyFlow(name);
    this.flows.set(flow.id, flow);
    this.addToRecent(flow.id);
    this.persist();
    return flow;
  }

  /**
   * Save a flow (create or update)
   */
  saveFlow(flow: Flow): void {
    this.load();

    // Validate flow
    const validation = validateFlow(flow);
    if (!validation.valid) {
      throw new Error(`Invalid flow: ${validation.errors?.message}`);
    }

    // Update timestamp
    const updatedFlow: Flow = {
      ...flow,
      updatedAt: new Date().toISOString(),
    };

    this.flows.set(flow.id, updatedFlow);
    this.addToRecent(flow.id);
    this.persist();
  }

  /**
   * Get a flow by ID
   */
  getFlow(flowId: string): Flow | undefined {
    this.load();
    const flow = this.flows.get(flowId);
    if (flow) {
      this.addToRecent(flowId);
      this.persist();
    }
    return flow;
  }

  /**
   * Delete a flow
   */
  deleteFlow(flowId: string): boolean {
    this.load();
    const deleted = this.flows.delete(flowId);
    if (deleted) {
      this.recentIds = this.recentIds.filter(id => id !== flowId);
      this.persist();
    }
    return deleted;
  }

  /**
   * Duplicate a flow
   */
  duplicateFlow(flowId: string, newName?: string): Flow | undefined {
    this.load();
    const original = this.flows.get(flowId);
    if (!original) return undefined;

    const now = new Date().toISOString();
    const duplicate: Flow = {
      ...original,
      id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newName || `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    this.flows.set(duplicate.id, duplicate);
    this.addToRecent(duplicate.id);
    this.persist();
    return duplicate;
  }

  /**
   * List all flows (metadata only)
   */
  listFlows(): FlowListItem[] {
    this.load();
    return Array.from(this.flows.values())
      .map(flow => ({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        version: flow.version,
        nodeCount: flow.nodes.length,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        tags: flow.tags,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get recent flows
   */
  getRecentFlows(): FlowListItem[] {
    this.load();
    return this.recentIds
      .map(id => this.flows.get(id))
      .filter((flow): flow is Flow => flow !== undefined)
      .map(flow => ({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        version: flow.version,
        nodeCount: flow.nodes.length,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
        tags: flow.tags,
      }));
  }

  /**
   * Search flows by name or tags
   */
  searchFlows(query: string): FlowListItem[] {
    this.load();
    const lowerQuery = query.toLowerCase();
    return this.listFlows().filter(
      flow =>
        flow.name.toLowerCase().includes(lowerQuery) ||
        flow.description?.toLowerCase().includes(lowerQuery) ||
        flow.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Export a flow (without credentials)
   */
  exportFlow(flowId: string): string | undefined {
    this.load();
    const flow = this.flows.get(flowId);
    if (!flow) return undefined;

    const exportable = toExportableFlow(flow);
    return JSON.stringify(exportable, null, 2);
  }

  /**
   * Import a flow from JSON
   */
  importFlow(jsonString: string): Flow {
    this.load();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format');
    }

    // Validate the flow structure
    const result = FlowSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid flow format: ${result.error.message}`);
    }

    const flow = result.data;

    // Generate new ID to avoid conflicts
    const now = new Date().toISOString();
    const importedFlow: Flow = {
      ...flow,
      id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${flow.name} (Imported)`,
      createdAt: now,
      updatedAt: now,
    };

    this.flows.set(importedFlow.id, importedFlow);
    this.addToRecent(importedFlow.id);
    this.persist();

    return importedFlow;
  }

  /**
   * Export all flows as backup
   */
  exportAllFlows(): string {
    this.load();
    const allFlows = Array.from(this.flows.values()).map(toExportableFlow);
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      flows: allFlows,
    }, null, 2);
  }

  /**
   * Get flow count
   */
  getFlowCount(): number {
    this.load();
    return this.flows.size;
  }

  /**
   * Clear all flows (use with caution)
   */
  clearAllFlows(): void {
    this.flows.clear();
    this.recentIds = [];
    this.persist();
  }
}

// ============ Singleton Instance ============

export const flowStorage = new FlowStorage();

// ============ React Hook Helpers ============

/**
 * Download a flow as JSON file
 */
export function downloadFlow(flowId: string, flowName: string): void {
  const json = flowStorage.exportFlow(flowId);
  if (!json) {
    throw new Error('Flow not found');
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${flowName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.flow.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a flow file from disk
 */
export function readFlowFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
