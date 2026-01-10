/**
 * RhizOS Flow Schema
 *
 * Defines the structure for saving and loading flows.
 * Flows are visual workflows created in the Flow Builder.
 */

import { z } from 'zod';
import { CredentialRefSchema } from './module-configs';

// ============ Flow Node Schema ============

export const FlowNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const FlowNodeSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  moduleName: z.string(),
  moduleVersion: z.string().optional(),
  position: FlowNodePositionSchema,
  config: z.record(z.string(), z.unknown()).default({}),
  // Store credential references (not actual values)
  credentialRefs: z.record(z.string(), CredentialRefSchema).optional(),
  // Visual metadata
  label: z.string().optional(),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;

// ============ Flow Connection Schema ============

export const FlowConnectionSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourcePort: z.string().default('output'),
  targetNodeId: z.string(),
  targetPort: z.string().default('input'),
  // Optional data transformation
  transform: z.string().optional(), // JSONPath or simple mapping
  // Conditional execution
  condition: z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'exists']),
    value: z.unknown(),
  }).optional(),
});

export type FlowConnection = z.infer<typeof FlowConnectionSchema>;

// ============ Flow Metadata Schema ============

export const FlowMetadataSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  version: z.string().default('1.0.0'),
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Execution settings
  timeout: z.number().positive().default(3600), // seconds
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    retryDelay: z.number().positive().default(1000), // ms
    backoffMultiplier: z.number().positive().default(2),
  }).optional(),
});

export type FlowMetadata = z.infer<typeof FlowMetadataSchema>;

// ============ Flow Schema ============

export const FlowSchema = z.object({
  // Metadata
  ...FlowMetadataSchema.shape,
  // Graph structure
  nodes: z.array(FlowNodeSchema),
  connections: z.array(FlowConnectionSchema),
  // Canvas state (for UI restoration)
  viewport: z.object({
    zoom: z.number().min(0.1).max(2).default(1),
    panX: z.number().default(0),
    panY: z.number().default(0),
  }).optional(),
  // Estimated costs
  estimatedCost: z.object({
    totalCents: z.number(),
    currency: z.string(),
    breakdown: z.array(z.object({
      nodeId: z.string(),
      costCents: z.number(),
      resource: z.string(),
    })),
  }).optional(),
});

export type Flow = z.infer<typeof FlowSchema>;

// ============ Export Schema (without credentials) ============

export const ExportableFlowSchema = FlowSchema.extend({
  nodes: z.array(
    FlowNodeSchema.omit({ credentialRefs: true }).extend({
      // Mark credential fields as placeholders
      credentialPlaceholders: z.record(z.string(), z.string()).optional(),
    })
  ),
});

export type ExportableFlow = z.infer<typeof ExportableFlowSchema>;

// ============ Deployment Schema ============

export const FlowDeploymentRequestSchema = z.object({
  flowId: z.string(),
  flow: FlowSchema,
  // Resolved credentials (decrypted at deploy time)
  resolvedCredentials: z.record(z.string(), z.record(z.string(), z.string())),
  // Deployment options
  options: z.object({
    dryRun: z.boolean().default(false),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    maxCostCents: z.number().positive().optional(),
  }).optional(),
});

export type FlowDeploymentRequest = z.infer<typeof FlowDeploymentRequestSchema>;

export const FlowDeploymentStatusSchema = z.object({
  deploymentId: z.string(),
  flowId: z.string(),
  status: z.enum(['pending', 'deploying', 'running', 'completed', 'failed', 'cancelled']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Per-node status
  nodeStatuses: z.record(z.string(), z.object({
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    jobId: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    error: z.string().optional(),
    output: z.unknown().optional(),
  })),
  // Overall metrics
  progress: z.number().min(0).max(100),
  actualCostCents: z.number().optional(),
  error: z.string().optional(),
});

export type FlowDeploymentStatus = z.infer<typeof FlowDeploymentStatusSchema>;

// ============ Helper Functions ============

/**
 * Generate a unique ID for flow entities
 */
export function generateFlowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an empty flow
 */
export function createEmptyFlow(name: string = 'Untitled Flow'): Flow {
  const now = new Date().toISOString();
  return {
    id: generateFlowId(),
    name,
    version: '1.0.0',
    tags: [],
    createdAt: now,
    updatedAt: now,
    timeout: 3600,
    nodes: [],
    connections: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
  };
}

/**
 * Validate a flow structure
 */
export function validateFlow(flow: unknown): { valid: boolean; errors?: z.ZodError } {
  const result = FlowSchema.safeParse(flow);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, errors: result.error };
}

/**
 * Convert a flow to exportable format (strip credentials)
 */
export function toExportableFlow(flow: Flow): ExportableFlow {
  return {
    ...flow,
    nodes: flow.nodes.map(node => {
      const { credentialRefs, ...rest } = node;
      return {
        ...rest,
        credentialPlaceholders: credentialRefs
          ? Object.fromEntries(
              Object.entries(credentialRefs).map(([key, ref]) => [
                key,
                `<${ref.type}>`,
              ])
            )
          : undefined,
      };
    }),
  };
}

/**
 * Get execution order for flow nodes (topological sort)
 */
export function getExecutionOrder(flow: Flow): string[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};

  // Initialize
  flow.nodes.forEach(node => {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  });

  // Build graph
  flow.connections.forEach(conn => {
    adjacency[conn.sourceNodeId]?.push(conn.targetNodeId);
    if (inDegree[conn.targetNodeId] !== undefined) {
      inDegree[conn.targetNodeId]++;
    }
  });

  // Kahn's algorithm
  const queue: string[] = [];
  const order: string[] = [];

  Object.entries(inDegree).forEach(([nodeId, degree]) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    adjacency[current]?.forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Check for cycles
  if (order.length !== flow.nodes.length) {
    throw new Error('Flow contains cycles - cannot determine execution order');
  }

  return order;
}

/**
 * Get nodes that have no dependencies (entry points)
 */
export function getEntryNodes(flow: Flow): FlowNode[] {
  const targetNodeIds = new Set(flow.connections.map(c => c.targetNodeId));
  return flow.nodes.filter(node => !targetNodeIds.has(node.id));
}

/**
 * Get nodes that have no dependents (exit points)
 */
export function getExitNodes(flow: Flow): FlowNode[] {
  const sourceNodeIds = new Set(flow.connections.map(c => c.sourceNodeId));
  return flow.nodes.filter(node => !sourceNodeIds.has(node.id));
}

/**
 * Get upstream dependencies for a node
 */
export function getNodeDependencies(flow: Flow, nodeId: string): FlowNode[] {
  const sourceIds = flow.connections
    .filter(c => c.targetNodeId === nodeId)
    .map(c => c.sourceNodeId);
  return flow.nodes.filter(n => sourceIds.includes(n.id));
}

/**
 * Get downstream dependents for a node
 */
export function getNodeDependents(flow: Flow, nodeId: string): FlowNode[] {
  const targetIds = flow.connections
    .filter(c => c.sourceNodeId === nodeId)
    .map(c => c.targetNodeId);
  return flow.nodes.filter(n => targetIds.includes(n.id));
}
