/**
 * Flow Deployment Service
 *
 * Manages the deployment and execution of flows.
 * Handles dependency resolution, job creation, and status tracking.
 */

import {
  FlowDeployment,
  FlowNode,
  FlowConnection,
  DeployFlowRequest,
  FlowDeploymentStatus,
  JobRequirements,
  JobPayload,
} from '../types/index.js';
import { JobQueue } from './job-queue.js';
import { PaymentService } from './payment.js';

// Module to hardware requirements mapping
const MODULE_REQUIREMENTS: Record<string, Partial<JobRequirements>> = {
  'rhizos-hummingbot': {
    cpu: { min_cores: 4 },
    memory: { min_mb: 8192 },
    mcp_adapter: 'docker',
    max_cost_cents: 100,
    currency: 'USDC',
  },
  'rhizos-eliza': {
    cpu: { min_cores: 4 },
    memory: { min_mb: 8192 },
    mcp_adapter: 'docker',
    max_cost_cents: 100,
    currency: 'USDC',
  },
  'rhizos-scrapy': {
    cpu: { min_cores: 4 },
    memory: { min_mb: 8192 },
    mcp_adapter: 'docker',
    max_cost_cents: 50,
    currency: 'USDC',
  },
  'rhizos-hrm': {
    gpu: { count: 1, min_vram_mb: 16000, requires: ['cuda'] },
    cpu: { min_cores: 8 },
    memory: { min_mb: 32768 },
    mcp_adapter: 'llm-inference',
    max_cost_cents: 500,
    currency: 'USDC',
  },
  'rhizos-bittensor': {
    gpu: { count: 1, min_vram_mb: 8000, requires: ['cuda'] },
    cpu: { min_cores: 4 },
    memory: { min_mb: 16384 },
    mcp_adapter: 'docker',
    max_cost_cents: 300,
    currency: 'USDC',
  },
};

const DEFAULT_REQUIREMENTS: JobRequirements = {
  cpu: { min_cores: 2 },
  memory: { min_mb: 4096 },
  mcp_adapter: 'docker',
  max_cost_cents: 100,
  currency: 'USDC',
};

export class FlowDeploymentService {
  private deployments: Map<string, FlowDeployment> = new Map();
  private jobQueue: JobQueue;
  private paymentService: PaymentService;

  constructor(jobQueue: JobQueue, paymentService: PaymentService) {
    this.jobQueue = jobQueue;
    this.paymentService = paymentService;
  }

  /**
   * Deploy a flow - creates jobs for each node in execution order
   */
  async deployFlow(
    clientId: string,
    request: DeployFlowRequest,
    accountId?: string
  ): Promise<FlowDeployment> {
    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create deployment record
    const deployment: FlowDeployment = {
      id: deploymentId,
      flowId: request.flowId,
      name: request.name,
      clientId,
      workspaceId: request.workspaceId, // Optional workspace for routing
      status: 'pending',
      nodes: request.nodes,
      connections: request.connections,
      nodeJobs: {},
      nodeStatuses: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      totalCostCents: 0,
    };

    // Initialize node statuses
    for (const node of request.nodes) {
      deployment.nodeStatuses[node.id] = { status: 'pending' };
    }

    this.deployments.set(deploymentId, deployment);

    // If dry run, just return the deployment without actually executing
    if (request.options?.dryRun) {
      deployment.status = 'completed';
      return deployment;
    }

    // Get execution order (topological sort)
    const executionOrder = this.getExecutionOrder(request.nodes, request.connections);

    // Start deployment
    deployment.status = 'deploying';
    deployment.updatedAt = new Date();

    // Execute nodes in order (pass workspaceId for routing)
    this.executeFlow(deployment, executionOrder, request.resolvedCredentials, accountId, request.workspaceId)
      .catch((error) => {
        deployment.status = 'failed';
        deployment.error = String(error);
        deployment.updatedAt = new Date();
      });

    return deployment;
  }

  /**
   * Execute flow nodes in order
   */
  private async executeFlow(
    deployment: FlowDeployment,
    executionOrder: string[],
    credentials: Record<string, Record<string, string>>,
    accountId?: string,
    workspaceId?: string
  ): Promise<void> {
    deployment.status = 'running';
    deployment.updatedAt = new Date();

    const nodeOutputs: Record<string, unknown> = {};

    for (const nodeId of executionOrder) {
      const node = deployment.nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      // Update status
      deployment.nodeStatuses[nodeId] = {
        status: 'running',
        startedAt: new Date(),
      };
      deployment.updatedAt = new Date();

      try {
        // Get inputs from upstream nodes
        const inputs = this.resolveInputs(nodeId, deployment.connections, nodeOutputs);

        // Get node credentials
        const nodeCredentials = this.resolveNodeCredentials(node, credentials);

        // Create job for this node (include workspaceId for routing)
        const jobId = await this.createNodeJob(
          deployment.clientId,
          node,
          inputs,
          nodeCredentials,
          accountId,
          workspaceId
        );

        deployment.nodeJobs[nodeId] = jobId;
        deployment.nodeStatuses[nodeId].jobId = jobId;

        // Wait for job completion
        const result = await this.waitForJob(jobId);

        if (result.success) {
          deployment.nodeStatuses[nodeId].status = 'completed';
          deployment.nodeStatuses[nodeId].completedAt = new Date();
          deployment.nodeStatuses[nodeId].output = result.outputs;
          deployment.totalCostCents += result.actual_cost_cents || 0;

          // Store output for downstream nodes
          nodeOutputs[nodeId] = result.outputs;
        } else {
          deployment.nodeStatuses[nodeId].status = 'failed';
          deployment.nodeStatuses[nodeId].error = result.error;
          deployment.nodeStatuses[nodeId].completedAt = new Date();

          // Mark downstream nodes as skipped
          this.skipDownstreamNodes(nodeId, deployment);

          deployment.status = 'failed';
          deployment.error = `Node ${node.moduleName} failed: ${result.error}`;
          deployment.updatedAt = new Date();
          return;
        }
      } catch (error) {
        deployment.nodeStatuses[nodeId].status = 'failed';
        deployment.nodeStatuses[nodeId].error = String(error);
        deployment.nodeStatuses[nodeId].completedAt = new Date();

        this.skipDownstreamNodes(nodeId, deployment);

        deployment.status = 'failed';
        deployment.error = `Node ${node.moduleName} error: ${error}`;
        deployment.updatedAt = new Date();
        return;
      }

      deployment.updatedAt = new Date();
    }

    // All nodes completed successfully
    deployment.status = 'completed';
    deployment.completedAt = new Date();
    deployment.updatedAt = new Date();
  }

  /**
   * Create a job for a node
   */
  private async createNodeJob(
    clientId: string,
    node: FlowNode,
    inputs: Record<string, unknown>,
    credentials: Record<string, Record<string, string>>,
    accountId?: string,
    workspaceId?: string
  ): Promise<string> {
    // Get module requirements
    const baseRequirements = MODULE_REQUIREMENTS[node.moduleId] || DEFAULT_REQUIREMENTS;

    const requirements: JobRequirements = {
      ...DEFAULT_REQUIREMENTS,
      ...baseRequirements,
    };

    // Create payload
    const payload: JobPayload = {
      type: 'module-execution',
      moduleId: node.moduleId,
      moduleVersion: node.moduleVersion || '1.0.0',
      config: node.config,
      credentials,
      inputs,
    };

    const job = await this.jobQueue.submitJob(
      clientId,
      { requirements, payload, timeout_seconds: 3600 },
      accountId,
      workspaceId // Pass workspaceId for routing to workspace nodes
    );

    return job.id;
  }

  /**
   * Wait for a job to complete
   */
  private async waitForJob(
    jobId: string,
    timeoutMs: number = 600000
  ): Promise<{ success: boolean; outputs?: unknown[]; error?: string; actual_cost_cents?: number }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const job = this.jobQueue.getJob(jobId);

      if (!job) {
        return { success: false, error: 'Job not found' };
      }

      if (job.status === 'completed' && job.result) {
        return {
          success: job.result.success,
          outputs: job.result.outputs,
          error: job.result.error,
          actual_cost_cents: job.result.actual_cost_cents,
        };
      }

      if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'timeout') {
        return {
          success: false,
          error: job.result?.error || `Job ${job.status}`,
        };
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { success: false, error: 'Job timeout' };
  }

  /**
   * Get topological sort of nodes for execution order
   */
  private getExecutionOrder(nodes: FlowNode[], connections: FlowConnection[]): string[] {
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};

    // Initialize
    for (const node of nodes) {
      inDegree[node.id] = 0;
      adjacency[node.id] = [];
    }

    // Build graph
    for (const conn of connections) {
      adjacency[conn.sourceNodeId]?.push(conn.targetNodeId);
      if (inDegree[conn.targetNodeId] !== undefined) {
        inDegree[conn.targetNodeId]++;
      }
    }

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

      adjacency[current]?.forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // Check for cycles
    if (order.length !== nodes.length) {
      throw new Error('Flow contains cycles - cannot determine execution order');
    }

    return order;
  }

  /**
   * Resolve inputs from upstream nodes
   */
  private resolveInputs(
    nodeId: string,
    connections: FlowConnection[],
    nodeOutputs: Record<string, unknown>
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    for (const conn of connections) {
      if (conn.targetNodeId === nodeId) {
        inputs[conn.targetPort] = {
          sourceNodeId: conn.sourceNodeId,
          sourcePort: conn.sourcePort,
          data: nodeOutputs[conn.sourceNodeId],
        };
      }
    }

    return inputs;
  }

  /**
   * Resolve credentials for a node
   */
  private resolveNodeCredentials(
    node: FlowNode,
    allCredentials: Record<string, Record<string, string>>
  ): Record<string, Record<string, string>> {
    const nodeCredentials: Record<string, Record<string, string>> = {};

    if (node.credentialRefs) {
      for (const [key, ref] of Object.entries(node.credentialRefs)) {
        if (allCredentials[ref.credentialId]) {
          nodeCredentials[key] = allCredentials[ref.credentialId];
        }
      }
    }

    return nodeCredentials;
  }

  /**
   * Mark downstream nodes as skipped
   */
  private skipDownstreamNodes(failedNodeId: string, deployment: FlowDeployment): void {
    const downstream = this.getDownstreamNodes(failedNodeId, deployment.connections);

    for (const nodeId of downstream) {
      if (deployment.nodeStatuses[nodeId].status === 'pending') {
        deployment.nodeStatuses[nodeId].status = 'skipped';
      }
    }
  }

  /**
   * Get all downstream nodes (recursive)
   */
  private getDownstreamNodes(nodeId: string, connections: FlowConnection[]): string[] {
    const downstream: Set<string> = new Set();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const conn of connections) {
        if (conn.sourceNodeId === current && !downstream.has(conn.targetNodeId)) {
          downstream.add(conn.targetNodeId);
          queue.push(conn.targetNodeId);
        }
      }
    }

    return Array.from(downstream);
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): FlowDeployment | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * Get deployments for a client
   */
  getClientDeployments(clientId: string): FlowDeployment[] {
    return Array.from(this.deployments.values())
      .filter((d) => d.clientId === clientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return false;

    if (deployment.status === 'completed' || deployment.status === 'failed') {
      return false;
    }

    deployment.status = 'cancelled';
    deployment.updatedAt = new Date();

    // Cancel all running jobs
    for (const [nodeId, jobId] of Object.entries(deployment.nodeJobs)) {
      if (deployment.nodeStatuses[nodeId].status === 'running') {
        await this.jobQueue.cancelJob(jobId);
        deployment.nodeStatuses[nodeId].status = 'skipped';
      }
    }

    return true;
  }

  /**
   * Get deployment statistics
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const stats = {
      total: this.deployments.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const deployment of this.deployments.values()) {
      if (deployment.status === 'pending' || deployment.status === 'deploying') {
        stats.pending++;
      } else if (deployment.status === 'running') {
        stats.running++;
      } else if (deployment.status === 'completed') {
        stats.completed++;
      } else if (deployment.status === 'failed') {
        stats.failed++;
      } else if (deployment.status === 'cancelled') {
        stats.cancelled++;
      }
    }

    return stats;
  }
}
