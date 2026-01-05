/**
 * Modchain Orchestrator Types
 *
 * Core type definitions shared across the orchestrator.
 */

import { z } from 'zod';

// ============ Node Types ============

export const GpuSupportsSchema = z.object({
  cuda: z.boolean(),
  rocm: z.boolean(),
  vulkan: z.boolean(),
  metal: z.boolean(),
  opencl: z.boolean(),
});

export const GpuCapabilitySchema = z.object({
  vendor: z.string(),
  model: z.string(),
  vram_mb: z.number(),
  compute_capability: z.string().optional(),
  driver_version: z.string(),
  supports: GpuSupportsSchema,
});

export const CpuArchitectureSchema = z.enum(['X86_64', 'Aarch64', 'Arm', 'Unknown']);

export const CpuCapabilitySchema = z.object({
  vendor: z.string(),
  model: z.string(),
  cores: z.number(),
  threads: z.number(),
  frequency_mhz: z.number(),
  architecture: CpuArchitectureSchema,
  features: z.array(z.string()),
});

export const MemoryCapabilitySchema = z.object({
  total_mb: z.number(),
  available_mb: z.number(),
});

export const StorageTypeSchema = z.enum(['Ssd', 'Hdd', 'Nvme', 'Unknown']);

export const StorageCapabilitySchema = z.object({
  total_gb: z.number(),
  available_gb: z.number(),
  storage_type: StorageTypeSchema,
});

export const NodeCapabilitiesSchema = z.object({
  node_id: z.string(),
  node_version: z.string(),
  gpus: z.array(GpuCapabilitySchema),
  cpu: CpuCapabilitySchema,
  memory: MemoryCapabilitySchema,
  storage: StorageCapabilitySchema,
  docker_version: z.string().optional(),
  container_runtimes: z.array(z.string()),
  mcp_adapters: z.array(z.string()),
});

export type NodeCapabilities = z.infer<typeof NodeCapabilitiesSchema>;
export type GpuCapability = z.infer<typeof GpuCapabilitySchema>;
export type CpuCapability = z.infer<typeof CpuCapabilitySchema>;

// ============ Job Types ============

export const JobStatusSchema = z.enum([
  'pending',
  'assigned',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobRequirementsSchema = z.object({
  gpu: z.object({
    count: z.number(),
    min_vram_mb: z.number(),
    requires: z.array(z.string()).optional(),
    preferred_vendor: z.string().optional(),
  }).optional(),
  cpu: z.object({
    min_cores: z.number(),
    min_threads: z.number().optional(),
    architecture: z.string().optional(),
    required_features: z.array(z.string()).optional(),
  }).optional(),
  memory: z.object({
    min_mb: z.number(),
  }).optional(),
  storage: z.object({
    min_gb: z.number(),
    type: StorageTypeSchema.optional(),
  }).optional(),
  mcp_adapter: z.string(),
  container_runtime: z.string().optional(),
  max_cost_cents: z.number(),
  currency: z.string(),
});

export type JobRequirements = z.infer<typeof JobRequirementsSchema>;

export const JobPayloadSchema = z.object({
  type: z.string(),
}).passthrough(); // Allow additional fields

export type JobPayload = z.infer<typeof JobPayloadSchema>;

export const CreateJobRequestSchema = z.object({
  requirements: JobRequirementsSchema,
  payload: JobPayloadSchema,
  timeout_seconds: z.number().default(3600),
});

export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export interface Job {
  id: string;
  client_id: string;
  requirements: JobRequirements;
  payload: JobPayload;
  status: JobStatus;
  assigned_node?: string;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  result?: JobResult;
}

export interface JobResult {
  success: boolean;
  outputs?: Array<{
    type: 'inline' | 'url' | 'cid';
    data: string;
    mime_type?: string;
  }>;
  error?: string;
  execution_time_ms: number;
  actual_cost_cents: number;
}

// ============ Protocol Messages ============

export const NodeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('register'),
    capabilities: NodeCapabilitiesSchema,
    auth_token: z.string().optional(),
  }),
  z.object({
    type: z.literal('heartbeat'),
    available: z.boolean(),
    current_jobs: z.number(),
  }),
  z.object({
    type: z.literal('job_status'),
    job_id: z.string(),
    status: z.enum(['accepted', 'preparing', 'running', 'completed', 'failed']),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('job_result'),
    job_id: z.string(),
    result: z.object({
      success: z.boolean(),
      outputs: z.array(z.any()).optional(),
      error: z.string().optional(),
      execution_time_ms: z.number(),
      actual_cost_cents: z.number(),
    }),
  }),
]);

export type NodeMessage = z.infer<typeof NodeMessageSchema>;

export interface OrchestratorMessage {
  type: 'registered' | 'job_assignment' | 'cancel_job' | 'config_update' | 'error';
  [key: string]: unknown;
}

// ============ Connected Node ============

export interface ConnectedNode {
  id: string;
  capabilities: NodeCapabilities;
  ws: import('ws').WebSocket;
  available: boolean;
  current_jobs: number;
  last_heartbeat: Date;
  reputation: number;
}

// ============ Registration ============

export const RegisterNodeRequestSchema = z.object({
  wallet_address: z.string(),
  capabilities: NodeCapabilitiesSchema,
});

export type RegisterNodeRequest = z.infer<typeof RegisterNodeRequestSchema>;

export interface RegisterNodeResponse {
  node_id: string;
  auth_token: string;
}
