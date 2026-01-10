/**
 * Flow Deployer Service
 *
 * Client-side service for deploying flows to the RhizOS orchestrator.
 * Handles credential resolution, API communication, and status polling.
 */

import type { Flow, FlowNode, FlowConnection } from '../../../shared/schemas/flows';

// ============ Types ============

export interface DeployFlowRequest {
  flowId: string;
  name: string;
  nodes: {
    id: string;
    moduleId: string;
    moduleName: string;
    moduleVersion?: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
    credentialRefs?: Record<string, { credentialId: string; type: string }>;
  }[];
  connections: {
    id: string;
    sourceNodeId: string;
    sourcePort: string;
    targetNodeId: string;
    targetPort: string;
  }[];
  resolvedCredentials: Record<string, Record<string, string>>;
  options?: {
    dryRun?: boolean;
    priority?: 'low' | 'normal' | 'high';
    maxCostCents?: number;
  };
}

export interface DeploymentResponse {
  deployment_id: string;
  flow_id: string;
  name: string;
  status: DeploymentStatus;
  node_statuses: Record<string, NodeDeploymentStatus>;
  created_at: string;
}

export interface DeploymentStatusResponse {
  id: string;
  flow_id: string;
  name: string;
  status: DeploymentStatus;
  node_statuses: Record<string, NodeDeploymentStatus>;
  node_jobs: Record<string, string>;
  total_cost_cents: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error?: string;
}

export interface NodeDeploymentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  jobId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: unknown;
}

export type DeploymentStatus =
  | 'pending'
  | 'deploying'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DeploymentListItem {
  id: string;
  flow_id: string;
  name: string;
  status: DeploymentStatus;
  total_cost_cents: number;
  created_at: string;
  updated_at: string;
}

export interface DeploymentError {
  error: string;
  details?: unknown;
}

// ============ Configuration ============

const DEFAULT_ORCHESTRATOR_URL = 'http://localhost:8080';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300; // 10 minutes at 2s intervals

// ============ Flow Deployer Class ============

export class FlowDeployer {
  private orchestratorUrl: string;
  private clientId: string;
  private accountId?: string;

  constructor(options?: {
    orchestratorUrl?: string;
    clientId?: string;
    accountId?: string;
  }) {
    this.orchestratorUrl = options?.orchestratorUrl || DEFAULT_ORCHESTRATOR_URL;
    this.clientId = options?.clientId || this.generateClientId();
    this.accountId = options?.accountId;
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    const stored = localStorage.getItem('rhizos_client_id');
    if (stored) return stored;

    const newId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('rhizos_client_id', newId);
    return newId;
  }

  /**
   * Set the account ID for payment tracking
   */
  setAccountId(accountId: string): void {
    this.accountId = accountId;
  }

  /**
   * Deploy a flow to the orchestrator
   */
  async deployFlow(
    flow: Flow,
    resolvedCredentials: Record<string, Record<string, string>>,
    options?: {
      dryRun?: boolean;
      priority?: 'low' | 'normal' | 'high';
      maxCostCents?: number;
    }
  ): Promise<DeploymentResponse> {
    const request: DeployFlowRequest = {
      flowId: flow.id,
      name: flow.name,
      nodes: flow.nodes.map((node) => ({
        id: node.id,
        moduleId: node.moduleId,
        moduleName: node.moduleName,
        moduleVersion: node.moduleVersion,
        position: node.position,
        config: node.config,
        credentialRefs: node.credentialRefs,
      })),
      connections: flow.connections.map((conn) => ({
        id: conn.id,
        sourceNodeId: conn.sourceNodeId,
        sourcePort: conn.sourcePort || 'output',
        targetNodeId: conn.targetNodeId,
        targetPort: conn.targetPort || 'input',
      })),
      resolvedCredentials,
      options,
    };

    const response = await fetch(`${this.orchestratorUrl}/api/v1/flows/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': this.clientId,
        ...(this.accountId && { 'X-Account-Id': this.accountId }),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Deployment failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatusResponse> {
    const response = await fetch(
      `${this.orchestratorUrl}/api/v1/flows/${deploymentId}/status`,
      {
        headers: {
          'X-Client-Id': this.clientId,
        },
      }
    );

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel a deployment
   */
  async cancelDeployment(deploymentId: string): Promise<boolean> {
    const response = await fetch(
      `${this.orchestratorUrl}/api/v1/flows/${deploymentId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Client-Id': this.clientId,
        },
      }
    );

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Failed to cancel: ${response.statusText}`);
    }

    return true;
  }

  /**
   * List deployments for this client
   */
  async listDeployments(): Promise<DeploymentListItem[]> {
    const response = await fetch(`${this.orchestratorUrl}/api/v1/flows`, {
      headers: {
        'X-Client-Id': this.clientId,
      },
    });

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Failed to list deployments: ${response.statusText}`);
    }

    const data = await response.json();
    return data.deployments;
  }

  /**
   * Wait for deployment to complete with status updates
   */
  async waitForCompletion(
    deploymentId: string,
    onStatusUpdate?: (status: DeploymentStatusResponse) => void
  ): Promise<DeploymentStatusResponse> {
    let attempts = 0;

    while (attempts < MAX_POLL_ATTEMPTS) {
      const status = await this.getDeploymentStatus(deploymentId);

      if (onStatusUpdate) {
        onStatusUpdate(status);
      }

      if (
        status.status === 'completed' ||
        status.status === 'failed' ||
        status.status === 'cancelled'
      ) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;
    }

    throw new Error('Deployment timed out');
  }

  /**
   * Deploy and wait for completion
   */
  async deployAndWait(
    flow: Flow,
    resolvedCredentials: Record<string, Record<string, string>>,
    options?: {
      dryRun?: boolean;
      priority?: 'low' | 'normal' | 'high';
      maxCostCents?: number;
      onStatusUpdate?: (status: DeploymentStatusResponse) => void;
    }
  ): Promise<DeploymentStatusResponse> {
    const deployment = await this.deployFlow(flow, resolvedCredentials, {
      dryRun: options?.dryRun,
      priority: options?.priority,
      maxCostCents: options?.maxCostCents,
    });

    return this.waitForCompletion(deployment.deployment_id, options?.onStatusUpdate);
  }

  /**
   * Get or create a payment account
   */
  async getOrCreateAccount(walletAddress: string): Promise<{
    account_id: string;
    wallet_address: string;
    balance_cents: number;
    currency: string;
  }> {
    const response = await fetch(`${this.orchestratorUrl}/api/v1/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Failed to create account: ${response.statusText}`);
    }

    const account = await response.json();
    this.accountId = account.account_id;
    return account;
  }

  /**
   * Add test credits to account (development only)
   */
  async addTestCredits(amountCents: number): Promise<number> {
    if (!this.accountId) {
      throw new Error('No account ID set');
    }

    const response = await fetch(
      `${this.orchestratorUrl}/api/v1/accounts/${this.accountId}/test-credits`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount_cents: amountCents }),
      }
    );

    if (!response.ok) {
      const error: DeploymentError = await response.json();
      throw new Error(error.error || `Failed to add credits: ${response.statusText}`);
    }

    const result = await response.json();
    return result.new_balance_cents;
  }

  /**
   * Check orchestrator health
   */
  async checkHealth(): Promise<{
    status: string;
    version: string;
    uptime: number;
  }> {
    const response = await fetch(`${this.orchestratorUrl}/health`);

    if (!response.ok) {
      throw new Error(`Orchestrator unhealthy: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get network statistics
   */
  async getStats(): Promise<{
    nodes: { total: number; available: number };
    jobs: { pending: number; running: number; completed: number };
    flows: { pending: number; running: number; completed: number; failed: number };
  }> {
    const response = await fetch(`${this.orchestratorUrl}/api/v1/stats`);

    if (!response.ok) {
      throw new Error(`Failed to get stats: ${response.statusText}`);
    }

    return response.json();
  }
}

// ============ Singleton Instance ============

let deployerInstance: FlowDeployer | null = null;

export function getFlowDeployer(options?: {
  orchestratorUrl?: string;
  clientId?: string;
  accountId?: string;
}): FlowDeployer {
  if (!deployerInstance || options) {
    deployerInstance = new FlowDeployer(options);
  }
  return deployerInstance;
}

// ============ Helper Functions ============

/**
 * Resolve credential references to actual values
 * This should only be called at deployment time
 */
export async function resolveCredentials(
  nodes: FlowNode[],
  getCredentialValue: (credentialId: string, field: string) => Promise<string | undefined>
): Promise<Record<string, Record<string, string>>> {
  const resolved: Record<string, Record<string, string>> = {};

  for (const node of nodes) {
    if (node.credentialRefs) {
      for (const [key, ref] of Object.entries(node.credentialRefs)) {
        if (!resolved[ref.credentialId]) {
          resolved[ref.credentialId] = {};
        }

        // Get all fields for this credential type
        const value = await getCredentialValue(ref.credentialId, key);
        if (value) {
          resolved[ref.credentialId][key] = value;
        }
      }
    }
  }

  return resolved;
}

/**
 * Estimate deployment cost based on module requirements
 */
export function estimateDeploymentCost(nodes: FlowNode[]): number {
  // Module cost estimates in cents per hour
  const MODULE_COSTS: Record<string, number> = {
    'rhizos-hummingbot': 100,
    'rhizos-eliza': 100,
    'rhizos-scrapy': 50,
    'rhizos-hrm': 500,
    'rhizos-bittensor': 300,
    'rhizos-nautilus': 200,
    'rhizos-ipfs': 50,
    'rhizos-docker': 100,
    'rhizos-polymarket': 150,
    'rhizos-social-analyzer': 100,
  };

  const DEFAULT_COST = 100;

  return nodes.reduce((total, node) => {
    return total + (MODULE_COSTS[node.moduleId] || DEFAULT_COST);
  }, 0);
}
