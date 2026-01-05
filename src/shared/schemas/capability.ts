/**
 * Modchain Capability Schema
 *
 * Defines what a node can do and what a job requires.
 * This is the core contract between nodes, orchestrator, and clients.
 */

// ============ Hardware Capabilities ============

export interface GpuCapability {
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple';
  model: string;                    // e.g., "RTX 4090", "RX 7900 XTX"
  vram_mb: number;                  // Video memory in MB
  compute_capability?: string;      // CUDA compute capability (nvidia only)
  driver_version: string;

  // What this GPU can actually run
  supports: {
    cuda: boolean;
    rocm: boolean;
    vulkan: boolean;
    metal: boolean;
    opencl: boolean;
  };
}

export interface CpuCapability {
  vendor: string;                   // "Intel", "AMD", "Apple"
  model: string;                    // Full model name
  cores: number;                    // Physical cores
  threads: number;                  // Logical threads
  frequency_mhz: number;            // Base frequency
  architecture: 'x86_64' | 'aarch64' | 'arm';

  // Instruction set extensions
  features: string[];               // e.g., ["avx2", "avx512", "neon"]
}

export interface MemoryCapability {
  total_mb: number;
  available_mb: number;             // Currently free
  type?: string;                    // DDR4, DDR5, etc.
}

export interface StorageCapability {
  total_gb: number;
  available_gb: number;
  type: 'ssd' | 'hdd' | 'nvme';
}

export interface NetworkCapability {
  bandwidth_mbps: number;           // Measured or estimated
  latency_ms?: number;              // To orchestrator
  public_ip: boolean;               // Can accept incoming connections
}

// ============ Node Advertisement ============

export interface NodeCapabilities {
  node_id: string;                  // Unique identifier
  node_version: string;             // Agent version

  // Hardware
  gpus: GpuCapability[];
  cpu: CpuCapability;
  memory: MemoryCapability;
  storage: StorageCapability;
  network: NetworkCapability;

  // Software/Runtime
  docker_version: string;
  container_runtimes: ('docker' | 'podman' | 'nvidia-docker')[];

  // MCP Adapters installed on this node
  mcp_adapters: string[];           // e.g., ["llm-inference", "image-gen", "generic-docker"]

  // Pricing (set by node operator)
  pricing: NodePricing;

  // Metadata
  location?: {
    region: string;                 // e.g., "us-west-2", "eu-central-1"
    country: string;
  };

  uptime_hours: number;             // How long this node has been running
  reputation_score?: number;        // 0-100, assigned by orchestrator
}

export interface NodePricing {
  currency: 'USDC' | 'USDT' | 'ETH' | 'BTC';

  // Per-unit pricing
  gpu_hour_cents: number;           // Per GPU per hour
  cpu_core_hour_cents: number;      // Per CPU core per hour
  memory_gb_hour_cents: number;     // Per GB RAM per hour
  storage_gb_hour_cents: number;    // Per GB storage per hour

  // Minimum job
  minimum_cents: number;            // Minimum job cost
}

// ============ Job Requirements ============

export interface JobRequirements {
  job_id: string;

  // What the job needs
  gpu?: {
    count: number;
    min_vram_mb: number;
    requires?: ('cuda' | 'rocm' | 'vulkan' | 'metal' | 'opencl')[];
    preferred_vendor?: 'nvidia' | 'amd';
  };

  cpu?: {
    min_cores: number;
    min_threads?: number;
    architecture?: 'x86_64' | 'aarch64' | 'any';
    required_features?: string[];   // e.g., ["avx2"]
  };

  memory?: {
    min_mb: number;
  };

  storage?: {
    min_gb: number;
    type?: 'ssd' | 'nvme';          // Minimum storage speed
  };

  network?: {
    min_bandwidth_mbps?: number;
    requires_public_ip?: boolean;
  };

  // Software requirements
  mcp_adapter: string;              // Which adapter to use
  container_runtime?: 'docker' | 'nvidia-docker';

  // Budget
  max_cost_cents: number;           // Maximum willing to pay
  currency: 'USDC' | 'USDT' | 'ETH' | 'BTC';

  // Preferences
  preferred_region?: string;
  max_latency_ms?: number;
  min_reputation?: number;
}

// ============ Job Definition ============

export interface Job {
  id: string;
  client_id: string;

  requirements: JobRequirements;

  // The actual work to do
  payload: JobPayload;

  // Timing
  created_at: string;               // ISO timestamp
  timeout_seconds: number;          // Max execution time

  // Status
  status: JobStatus;
  assigned_node?: string;

  // Results
  result?: JobResult;
}

export type JobPayload =
  | DockerJobPayload
  | LlmInferencePayload
  | ImageGenPayload
  | CustomMcpPayload;

export interface DockerJobPayload {
  type: 'docker';
  image: string;                    // Docker image to run
  command?: string[];               // Override command
  env?: Record<string, string>;     // Environment variables
  volumes?: VolumeMount[];          // Data to mount
  ports?: PortMapping[];            // Ports to expose
}

export interface LlmInferencePayload {
  type: 'llm-inference';
  model: string;                    // Model name (e.g., "llama-3-70b")
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  // ... other inference params
}

export interface ImageGenPayload {
  type: 'image-gen';
  model: string;                    // e.g., "sdxl", "flux"
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  steps?: number;
  // ... other params
}

export interface CustomMcpPayload {
  type: 'mcp';
  adapter: string;                  // MCP adapter name
  method: string;                   // Method to call
  params: Record<string, unknown>;  // Adapter-specific params
}

export interface VolumeMount {
  source: string;                   // URL or CID for input data
  target: string;                   // Mount path in container
  readonly: boolean;
}

export interface PortMapping {
  container: number;
  host?: number;                    // Optional, will be assigned
  protocol: 'tcp' | 'udp';
}

export type JobStatus =
  | 'pending'                       // Waiting for node assignment
  | 'assigned'                      // Node accepted, preparing
  | 'running'                       // Actively executing
  | 'completed'                     // Finished successfully
  | 'failed'                        // Error during execution
  | 'cancelled'                     // Client cancelled
  | 'timeout';                      // Exceeded timeout

export interface JobResult {
  status: 'success' | 'error';

  // For successful jobs
  outputs?: {
    type: 'inline' | 'url' | 'cid';
    data: string;                   // Actual data, URL, or IPFS CID
    mime_type?: string;
  }[];

  // For errors
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  // Metrics
  execution_time_ms: number;
  resources_used: {
    gpu_seconds?: number;
    cpu_seconds?: number;
    memory_mb_peak?: number;
  };

  // Cost
  actual_cost_cents: number;
}
