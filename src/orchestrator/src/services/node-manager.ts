/**
 * Node Manager Service
 *
 * Manages connected nodes, their capabilities, and health status.
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  ConnectedNode,
  NodeCapabilities,
  NodeMessage,
  OrchestratorMessage,
  Job,
  JobRequirements,
} from '../types/index.js';

export class NodeManager {
  private nodes: Map<string, ConnectedNode> = new Map();
  private authTokens: Map<string, string> = new Map(); // token -> nodeId
  private nodeWorkspaces: Map<string, Set<string>> = new Map(); // nodeId -> workspaceIds
  private nodeOwners: Map<string, string> = new Map(); // nodeId -> userId (owner)

  constructor() {
    // Start health check interval
    setInterval(() => this.healthCheck(), 30000);
  }

  /**
   * Register a new node and generate auth token
   */
  registerNode(
    walletAddress: string,
    capabilities: NodeCapabilities
  ): { nodeId: string; authToken: string } {
    const nodeId = capabilities.node_id || uuidv4();
    const authToken = uuidv4();

    this.authTokens.set(authToken, nodeId);

    console.log(`[NodeManager] Registered node ${nodeId} with wallet ${walletAddress}`);

    return { nodeId, authToken };
  }

  /**
   * Handle a new WebSocket connection from a node
   */
  handleConnection(ws: WebSocket): void {
    console.log('[NodeManager] New WebSocket connection');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as NodeMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('[NodeManager] Failed to parse message:', error);
        this.sendError(ws, 'PARSE_ERROR', 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('[NodeManager] WebSocket error:', error);
    });
  }

  /**
   * Handle an incoming message from a node
   */
  private handleMessage(ws: WebSocket, message: NodeMessage): void {
    switch (message.type) {
      case 'register':
        this.handleRegister(ws, message);
        break;

      case 'heartbeat':
        this.handleHeartbeat(ws, message);
        break;

      case 'job_status':
        this.handleJobStatus(ws, message);
        break;

      case 'job_result':
        this.handleJobResult(ws, message);
        break;

      default:
        console.warn('[NodeManager] Unknown message type');
    }
  }

  private handleRegister(
    ws: WebSocket,
    message: Extract<NodeMessage, { type: 'register' }>
  ): void {
    let nodeId: string;

    // Check if this is a returning node with auth token
    if (message.auth_token && this.authTokens.has(message.auth_token)) {
      nodeId = this.authTokens.get(message.auth_token)!;
      console.log(`[NodeManager] Node ${nodeId} reconnected with auth token`);
    } else {
      // New registration
      nodeId = message.capabilities.node_id || uuidv4();
      console.log(`[NodeManager] New node registered: ${nodeId}`);
    }

    // Store the connected node
    const node: ConnectedNode = {
      id: nodeId,
      capabilities: message.capabilities,
      ws,
      available: true,
      current_jobs: 0,
      last_heartbeat: new Date(),
      reputation: 50, // Start with neutral reputation
    };

    this.nodes.set(nodeId, node);

    // Handle workspace assignments from node config
    const workspaceIds = (message as any).workspace_ids as string[] | undefined;
    if (workspaceIds && workspaceIds.length > 0) {
      this.nodeWorkspaces.set(nodeId, new Set(workspaceIds));
      console.log(`[NodeManager] Node ${nodeId} joined workspaces: ${workspaceIds.join(', ')}`);
    }

    // Send registration confirmation
    this.send(ws, {
      type: 'registered',
      node_id: nodeId,
    });

    console.log(
      `[NodeManager] Node ${nodeId} online: ${message.capabilities.gpus.length} GPUs, ` +
      `${message.capabilities.cpu.cores} cores, ${message.capabilities.memory.total_mb}MB RAM`
    );
  }

  private handleHeartbeat(
    ws: WebSocket,
    message: Extract<NodeMessage, { type: 'heartbeat' }>
  ): void {
    const node = this.findNodeByWs(ws);
    if (node) {
      node.available = message.available;
      node.current_jobs = message.current_jobs;
      node.last_heartbeat = new Date();
    }
  }

  private handleJobStatus(
    ws: WebSocket,
    message: Extract<NodeMessage, { type: 'job_status' }>
  ): void {
    console.log(`[NodeManager] Job ${message.job_id} status: ${message.status}`);
    // TODO: Update job status in job queue
  }

  private handleJobResult(
    ws: WebSocket,
    message: Extract<NodeMessage, { type: 'job_result' }>
  ): void {
    console.log(
      `[NodeManager] Job ${message.job_id} completed: ` +
      `success=${message.result.success}, time=${message.result.execution_time_ms}ms`
    );
    // TODO: Store result and notify client
  }

  private handleDisconnect(ws: WebSocket): void {
    const node = this.findNodeByWs(ws);
    if (node) {
      console.log(`[NodeManager] Node ${node.id} disconnected`);
      this.nodes.delete(node.id);
      // Clean up workspace mappings and ownership
      this.nodeWorkspaces.delete(node.id);
      this.nodeOwners.delete(node.id);
    }
  }

  /**
   * Find a suitable node for a job based on requirements
   */
  findNodeForJob(requirements: JobRequirements): ConnectedNode | null {
    const candidates = Array.from(this.nodes.values())
      .filter((node) => this.nodeMatchesRequirements(node, requirements))
      .sort((a, b) => {
        // Sort by: availability, reputation, current load
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (a.reputation !== b.reputation) return b.reputation - a.reputation;
        return a.current_jobs - b.current_jobs;
      });

    return candidates[0] || null;
  }

  /**
   * Check if a node meets job requirements
   */
  private nodeMatchesRequirements(
    node: ConnectedNode,
    requirements: JobRequirements
  ): boolean {
    const caps = node.capabilities;

    // Check GPU requirements
    if (requirements.gpu) {
      const { count, min_vram_mb, requires, preferred_vendor } = requirements.gpu;

      // Must have enough GPUs
      if (caps.gpus.length < count) return false;

      // Check VRAM
      const hasEnoughVram = caps.gpus.some((gpu) => gpu.vram_mb >= min_vram_mb);
      if (!hasEnoughVram) return false;

      // Check required compute APIs
      if (requires) {
        const hasRequired = caps.gpus.some((gpu) =>
          requires.every((req) => {
            switch (req) {
              case 'cuda': return gpu.supports.cuda;
              case 'rocm': return gpu.supports.rocm;
              case 'vulkan': return gpu.supports.vulkan;
              case 'metal': return gpu.supports.metal;
              case 'opencl': return gpu.supports.opencl;
              default: return false;
            }
          })
        );
        if (!hasRequired) return false;
      }
    }

    // Check CPU requirements
    if (requirements.cpu) {
      if (caps.cpu.cores < requirements.cpu.min_cores) return false;
      if (requirements.cpu.min_threads && caps.cpu.threads < requirements.cpu.min_threads) {
        return false;
      }
      if (requirements.cpu.required_features) {
        const hasFeatures = requirements.cpu.required_features.every((f) =>
          caps.cpu.features.includes(f)
        );
        if (!hasFeatures) return false;
      }
    }

    // Check memory requirements
    if (requirements.memory) {
      if (caps.memory.available_mb < requirements.memory.min_mb) return false;
    }

    // Check storage requirements
    if (requirements.storage) {
      if (caps.storage.available_gb < requirements.storage.min_gb) return false;
    }

    // Check MCP adapter
    if (!caps.mcp_adapters.includes(requirements.mcp_adapter)) {
      // For now, accept 'docker' as a fallback
      if (requirements.mcp_adapter !== 'docker') return false;
    }

    return true;
  }

  /**
   * Assign a job to a node
   */
  assignJob(nodeId: string, job: Job): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || !node.available) return false;

    this.send(node.ws, {
      type: 'job_assignment',
      job: {
        id: job.id,
        client_id: job.client_id,
        payload: job.payload,
        timeout_seconds: 3600, // TODO: from job config
        max_cost_cents: job.requirements.max_cost_cents,
      },
    });

    node.current_jobs++;

    return true;
  }

  /**
   * Cancel a job on a node
   */
  cancelJob(nodeId: string, jobId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.send(node.ws, {
        type: 'cancel_job',
        job_id: jobId,
      });
    }
  }

  /**
   * Get all connected nodes
   */
  getNodes(): ConnectedNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes for a specific workspace
   */
  getNodesForWorkspace(workspaceId: string): ConnectedNode[] {
    const nodes: ConnectedNode[] = [];
    for (const [nodeId, workspaceIds] of this.nodeWorkspaces) {
      if (workspaceIds.has(workspaceId)) {
        const node = this.nodes.get(nodeId);
        if (node) {
          nodes.push(node);
        }
      }
    }
    return nodes;
  }

  /**
   * Add a node to a workspace
   */
  addNodeToWorkspace(nodeId: string, workspaceId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    if (!this.nodeWorkspaces.has(nodeId)) {
      this.nodeWorkspaces.set(nodeId, new Set());
    }
    this.nodeWorkspaces.get(nodeId)!.add(workspaceId);
    console.log(`[NodeManager] Node ${nodeId} joined workspace ${workspaceId}`);
    return true;
  }

  /**
   * Remove a node from a workspace
   */
  removeNodeFromWorkspace(nodeId: string, workspaceId: string): boolean {
    const workspaces = this.nodeWorkspaces.get(nodeId);
    if (!workspaces) return false;

    const removed = workspaces.delete(workspaceId);
    if (removed) {
      console.log(`[NodeManager] Node ${nodeId} left workspace ${workspaceId}`);
    }
    return removed;
  }

  /**
   * Get workspaces a node belongs to
   */
  getNodeWorkspaces(nodeId: string): string[] {
    const workspaces = this.nodeWorkspaces.get(nodeId);
    return workspaces ? Array.from(workspaces) : [];
  }

  /**
   * Claim ownership of an unowned node
   */
  claimNode(nodeId: string, userId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Check if already owned
    if (this.nodeOwners.has(nodeId)) {
      return false; // Already owned by someone
    }

    this.nodeOwners.set(nodeId, userId);
    console.log(`[NodeManager] Node ${nodeId} claimed by user ${userId}`);
    return true;
  }

  /**
   * Get the owner of a node
   */
  getNodeOwner(nodeId: string): string | null {
    return this.nodeOwners.get(nodeId) || null;
  }

  /**
   * Check if a user owns a node
   */
  isNodeOwner(nodeId: string, userId: string): boolean {
    const owner = this.nodeOwners.get(nodeId);
    return owner === userId;
  }

  /**
   * Check if a node is unclaimed
   */
  isNodeUnclaimed(nodeId: string): boolean {
    return !this.nodeOwners.has(nodeId);
  }

  /**
   * Send a message to a specific node
   */
  sendToNode(nodeId: string, message: OrchestratorMessage): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    this.send(node.ws, message);
    return true;
  }

  /**
   * Update resource limits for a node
   */
  updateNodeLimits(nodeId: string, limits: {
    cpuCores?: number;
    ramPercent?: number;
    storageGb?: number;
    gpuVramPercent?: number[];
  }): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Send limits update to the node
    this.send(node.ws, {
      type: 'update_limits',
      limits,
    } as any);

    console.log(`[NodeManager] Sent resource limits to node ${nodeId}:`, limits);
    return true;
  }

  /**
   * Find a node for a job, optionally filtered by workspace
   */
  findNodeForJobInWorkspace(requirements: JobRequirements, workspaceId?: string): ConnectedNode | null {
    let candidates = Array.from(this.nodes.values());

    // Filter by workspace if specified
    if (workspaceId) {
      candidates = candidates.filter((node) => {
        const nodeWorkspaces = this.nodeWorkspaces.get(node.id);
        return nodeWorkspaces?.has(workspaceId) ?? false;
      });
    }

    // Filter by requirements and sort
    candidates = candidates
      .filter((node) => this.nodeMatchesRequirements(node, requirements))
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (a.reputation !== b.reputation) return b.reputation - a.reputation;
        return a.current_jobs - b.current_jobs;
      });

    return candidates[0] || null;
  }

  /**
   * Get node statistics
   */
  getStats(): {
    total_nodes: number;
    available_nodes: number;
    total_gpus: number;
    total_cpu_cores: number;
    total_memory_gb: number;
  } {
    const nodes = this.getNodes();
    return {
      total_nodes: nodes.length,
      available_nodes: nodes.filter((n) => n.available).length,
      total_gpus: nodes.reduce((sum, n) => sum + n.capabilities.gpus.length, 0),
      total_cpu_cores: nodes.reduce((sum, n) => sum + n.capabilities.cpu.cores, 0),
      total_memory_gb: Math.round(
        nodes.reduce((sum, n) => sum + n.capabilities.memory.total_mb, 0) / 1024
      ),
    };
  }

  private findNodeByWs(ws: WebSocket): ConnectedNode | undefined {
    return Array.from(this.nodes.values()).find((n) => n.ws === ws);
  }

  private send(ws: WebSocket, message: OrchestratorMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }

  private healthCheck(): void {
    const now = new Date();
    const timeout = 30000; // 30 second timeout

    for (const [nodeId, node] of this.nodes) {
      const timeSinceHeartbeat = now.getTime() - node.last_heartbeat.getTime();
      if (timeSinceHeartbeat > timeout) {
        console.log(`[NodeManager] Node ${nodeId} timed out, removing`);
        node.ws.close();
        this.nodes.delete(nodeId);
        this.nodeWorkspaces.delete(nodeId);
        this.nodeOwners.delete(nodeId);
      }
    }
  }
}
