/**
 * RhizOS Orchestrator
 *
 * Central coordination service for the RhizOS compute network.
 * Handles node registration, job dispatch, and client API.
 */

import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

import { NodeManager } from './services/node-manager.js';
import { JobQueue } from './services/job-queue.js';
import { PaymentService } from './services/payment.js';
import { FlowDeploymentService } from './services/flow-deployment.js';
import { WorkspaceManager } from './services/workspace-manager.js';
import { taskManager } from './services/task-manager.js';
import {
  RegisterNodeRequestSchema,
  CreateJobRequestSchema,
  DeployFlowRequestSchema,
} from './types/index.js';
import {
  requireAuth,
  requireAdmin,
  signup,
  loginWithPassword,
  loginWithKey,
  logout,
  generateKey,
  listKeys,
  revokeKey,
} from './middleware/auth.js';

// ============ Configuration ============

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = '/ws/node';

// ============ Initialize Services ============

const nodeManager = new NodeManager();
const paymentService = new PaymentService();
const jobQueue = new JobQueue(nodeManager, paymentService);
const flowDeploymentService = new FlowDeploymentService(jobQueue, paymentService);
const workspaceManager = new WorkspaceManager();

// ============ Express App ============

const app = express();
app.use(express.json());

// Health check (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    uptime: process.uptime(),
  });
});

// ============ Auth Endpoints (public) ============

// Signup with username/password
app.post('/api/v1/auth/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const result = await signup(username, password);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ token: result.token, user: result.user });
});

// Login with username/password
app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password, key } = req.body;

  // Support both login methods
  if (key) {
    // Legacy invite key login
    const result = loginWithKey(key);
    if (!result.success) {
      res.status(401).json({ error: result.error });
      return;
    }
    res.json({ token: result.token });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const result = await loginWithPassword(username, password);

  if (!result.success) {
    res.status(401).json({ error: result.error });
    return;
  }

  res.json({ token: result.token, user: result.user });
});

// Logout
app.post('/api/v1/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    logout(token);
  }

  res.json({ success: true });
});

// Check session validity
app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  const session = (req as any).session;
  res.json({
    authenticated: true,
    userId: session.userId,
    username: session.username,
    expiresAt: session.expiresAt,
  });
});

// ============ Admin Key Management ============

// Generate a new invite key (admin only)
app.post('/api/v1/auth/keys', requireAdmin, (req, res) => {
  const { name } = req.body;
  const adminKey = req.headers['x-admin-key']?.toString() || '';

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const result = generateKey(adminKey, name);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ key: result.key, name });
});

// List all keys (admin only)
app.get('/api/v1/auth/keys', requireAdmin, (req, res) => {
  const adminKey = req.headers['x-admin-key']?.toString() || '';
  const result = listKeys(adminKey);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ keys: result.keys });
});

// Revoke a key (admin only)
app.delete('/api/v1/auth/keys/:keyPrefix', requireAdmin, (req, res) => {
  const adminKey = req.headers['x-admin-key']?.toString() || '';
  const result = revokeKey(adminKey, req.params.keyPrefix);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ success: true });
});

// ============ Workspace Endpoints ============

// Create a new workspace
app.post('/api/v1/workspaces', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { name, description = '', isPrivate = true } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  const workspace = workspaceManager.createWorkspace(
    name.trim(),
    description,
    session.userId,
    session.username,
    isPrivate
  );

  res.status(201).json({
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    isPrivate: workspace.isPrivate,
    inviteCode: workspace.inviteCode,
    members: workspace.members,
    createdAt: workspace.createdAt,
  });
});

// Get user's workspaces
app.get('/api/v1/workspaces', requireAuth, (req, res) => {
  const session = (req as any).session;
  const workspaces = workspaceManager.getUserWorkspaces(session.userId);

  // Also get node counts for each workspace
  const workspacesWithNodes = workspaces.map((ws) => {
    const nodeCount = nodeManager.getNodesForWorkspace(ws.id).length;
    return {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      isPrivate: ws.isPrivate,
      inviteCode: ws.ownerId === session.userId ? ws.inviteCode : undefined,
      members: ws.members,
      nodeCount,
      createdAt: ws.createdAt,
    };
  });

  res.json({ workspaces: workspacesWithNodes });
});

// Get a specific workspace
app.get('/api/v1/workspaces/:id', requireAuth, (req, res) => {
  const session = (req as any).session;
  const workspace = workspaceManager.getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  // Check membership
  if (!workspaceManager.isMember(workspace.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const nodes = nodeManager.getNodesForWorkspace(workspace.id);

  res.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      isPrivate: workspace.isPrivate,
      inviteCode: workspace.ownerId === session.userId ? workspace.inviteCode : undefined,
      members: workspace.members,
      nodeCount: nodes.length,
      createdAt: workspace.createdAt,
    },
  });
});

// Join a workspace by invite code
app.post('/api/v1/workspaces/join', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { inviteCode } = req.body;

  if (!inviteCode) {
    res.status(400).json({ error: 'Invite code is required' });
    return;
  }

  const result = workspaceManager.joinWorkspace(inviteCode, session.userId, session.username);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    workspace: {
      id: result.workspace!.id,
      name: result.workspace!.name,
      description: result.workspace!.description,
      members: result.workspace!.members,
    },
  });
});

// Leave a workspace
app.post('/api/v1/workspaces/:id/leave', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.leaveWorkspace(req.params.id, session.userId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ success: true });
});

// Delete a workspace
app.delete('/api/v1/workspaces/:id', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.deleteWorkspace(req.params.id, session.userId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ success: true });
});

// Regenerate invite code
app.post('/api/v1/workspaces/:id/regenerate-invite', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.regenerateInviteCode(req.params.id, session.userId);

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ inviteCode: result.inviteCode });
});

// Get nodes for a workspace
app.get('/api/v1/workspaces/:id/nodes', requireAuth, (req, res) => {
  const session = (req as any).session;

  if (!workspaceManager.isMember(req.params.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const nodes = nodeManager.getNodesForWorkspace(req.params.id);

  res.json({
    nodes: nodes.map((n) => ({
      id: n.id,
      hostname: n.id.split('-')[0] || 'node',
      status: n.available ? 'online' : 'busy',
      capabilities: {
        gpuCount: n.capabilities.gpus.length,
        cpuCores: n.capabilities.cpu.cores,
        memoryMb: n.capabilities.memory.total_mb,
        gpus: n.capabilities.gpus.map(g => ({
          model: g.model,
          vramMb: g.vram_mb,
        })),
      },
      resourceLimits: n.resourceLimits || null,
      remoteControlEnabled: n.remoteControlEnabled ?? false,
      reputation: n.reputation,
    })),
  });
});

// ============ Task Endpoints ============

// Get tasks for a workspace
app.get('/api/v1/workspaces/:id/tasks', requireAuth, (req, res) => {
  const session = (req as any).session;

  if (!workspaceManager.isMember(req.params.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const tasks = taskManager.getTasksForWorkspace(req.params.id);
  res.json({ tasks });
});

// Create a task
app.post('/api/v1/workspaces/:id/tasks', requireAuth, (req, res) => {
  const session = (req as any).session;

  if (!workspaceManager.isMember(req.params.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const { title, description, priority } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }

  const task = taskManager.createTask(req.params.id, session.userId, {
    title: title.trim(),
    description: description || '',
    priority: priority || 'medium',
  });

  res.status(201).json({ task });
});

// Update a task
app.patch('/api/v1/workspaces/:id/tasks/:taskId', requireAuth, (req, res) => {
  const session = (req as any).session;

  if (!workspaceManager.isMember(req.params.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const task = taskManager.getTask(req.params.taskId);
  if (!task || task.workspaceId !== req.params.id) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const { title, description, status, priority, assignedTo } = req.body;
  const updates: Record<string, any> = {};

  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (assignedTo !== undefined) updates.assignedTo = assignedTo;

  const updatedTask = taskManager.updateTask(req.params.taskId, updates);
  res.json({ task: updatedTask });
});

// Delete a task
app.delete('/api/v1/workspaces/:id/tasks/:taskId', requireAuth, (req, res) => {
  const session = (req as any).session;

  if (!workspaceManager.isMember(req.params.id, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  const task = taskManager.getTask(req.params.taskId);
  if (!task || task.workspaceId !== req.params.id) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  taskManager.deleteTask(req.params.taskId);
  res.json({ success: true });
});

// ============ Workspace API Keys ============

// Get API keys for a workspace (masked)
app.get('/api/v1/workspaces/:id/api-keys', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.getApiKeys(req.params.id, session.userId);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ apiKeys: result.apiKeys });
});

// Add an API key to a workspace
app.post('/api/v1/workspaces/:id/api-keys', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { provider, name, key } = req.body;

  if (!provider || !name || !key) {
    res.status(400).json({ error: 'provider, name, and key are required' });
    return;
  }

  const validProviders = ['openai', 'anthropic', 'google', 'groq', 'custom'];
  if (!validProviders.includes(provider)) {
    res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    return;
  }

  const result = workspaceManager.addApiKey(
    req.params.id,
    session.userId,
    provider,
    name,
    key
  );

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  // Return the key with masked value
  res.json({
    success: true,
    apiKey: {
      id: result.apiKey!.id,
      provider: result.apiKey!.provider,
      name: result.apiKey!.name,
      maskedKey: key.slice(0, 8) + '...' + key.slice(-4),
      addedBy: result.apiKey!.addedBy,
      addedAt: result.apiKey!.addedAt,
    },
  });
});

// Remove an API key from a workspace
app.delete('/api/v1/workspaces/:id/api-keys/:keyId', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.removeApiKey(
    req.params.id,
    session.userId,
    req.params.keyId
  );

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ success: true });
});

// ============ Workspace Flows ============

// Get all flows for a workspace
app.get('/api/v1/workspaces/:id/flows', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.getFlows(req.params.id, session.userId);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ flows: result.flows });
});

// Get a specific flow
app.get('/api/v1/workspaces/:id/flows/:flowId', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.getFlow(req.params.id, req.params.flowId, session.userId);

  if (!result.success) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.json({ flow: result.flow });
});

// Create a new flow
app.post('/api/v1/workspaces/:id/flows', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { name, description, flow } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Flow name is required' });
    return;
  }

  const result = workspaceManager.createFlow(
    req.params.id,
    session.userId,
    name,
    description || '',
    flow || { nodes: [], connections: [] }
  );

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ flow: result.flow });
});

// Update a flow
app.patch('/api/v1/workspaces/:id/flows/:flowId', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { name, description, flow } = req.body;

  const result = workspaceManager.updateFlow(
    req.params.id,
    req.params.flowId,
    session.userId,
    { name, description, flow }
  );

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ flow: result.flow });
});

// Delete a flow
app.delete('/api/v1/workspaces/:id/flows/:flowId', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.deleteFlow(
    req.params.id,
    req.params.flowId,
    session.userId
  );

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ success: true });
});

// ============ Workspace Resource Usage ============

// Get resource usage for a workspace
app.get('/api/v1/workspaces/:id/usage', requireAuth, (req, res) => {
  const session = (req as any).session;
  const result = workspaceManager.getResourceUsage(req.params.id, session.userId);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ usage: result.usage });
});

// Get resource usage summary (aggregated)
app.get('/api/v1/workspaces/:id/usage/summary', requireAuth, (req, res) => {
  const session = (req as any).session;
  const days = parseInt(req.query.days as string) || 30;
  const result = workspaceManager.getUsageSummary(req.params.id, session.userId, days);

  if (!result.success) {
    res.status(403).json({ error: result.error });
    return;
  }

  res.json({ summary: result.summary });
});

// Record resource usage (typically called internally during flow execution)
app.post('/api/v1/workspaces/:id/usage', requireAuth, (req, res) => {
  const session = (req as any).session;
  const { flowId, flowName, type, provider, tokensUsed, computeSeconds, costCents } = req.body;

  if (!type) {
    res.status(400).json({ error: 'Usage type is required' });
    return;
  }

  const result = workspaceManager.recordUsage(
    req.params.id,
    session.userId,
    {
      flowId,
      flowName,
      type,
      provider,
      tokensUsed,
      computeSeconds,
      costCents: costCents || 0,
      userId: session.userId,
    }
  );

  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(201).json({ entry: result.entry });
});

// ============ Protected API Endpoints ============

// Network statistics
app.get('/api/v1/stats', requireAuth, (req, res) => {
  res.json({
    nodes: nodeManager.getStats(),
    jobs: jobQueue.getStats(),
    flows: flowDeploymentService.getStats(),
  });
});

// List connected nodes
app.get('/api/v1/nodes', requireAuth, (req, res) => {
  const nodes = nodeManager.getNodes().map((n) => ({
    id: n.id,
    available: n.available,
    current_jobs: n.current_jobs,
    capabilities: {
      gpus: n.capabilities.gpus.length,
      cpu_cores: n.capabilities.cpu.cores,
      memory_mb: n.capabilities.memory.total_mb,
    },
    reputation: n.reputation,
  }));

  res.json({ nodes });
});

// Get nodes visible to the current user (nodes in their workspaces)
app.get('/api/v1/my-nodes', requireAuth, (req, res) => {
  const session = (req as any).session;

  // Get all workspaces the user is a member of
  const userWorkspaces = workspaceManager.getUserWorkspaces(session.userId);
  const userWorkspaceIds = new Set(userWorkspaces.map(ws => ws.id));

  // Get all connected nodes
  const allNodes = nodeManager.getNodes();

  // Filter to only nodes in the user's workspaces
  const visibleNodes: Array<{
    id: string;
    workspaceIds: string[];
    workspaceNames: string[];
    available: boolean;
    capabilities: any;
    connectedAt: any;
  }> = [];

  for (const node of allNodes) {
    const nodeWorkspaceIds = nodeManager.getNodeWorkspaces(node.id);
    const sharedWorkspaces = nodeWorkspaceIds.filter(wsId => userWorkspaceIds.has(wsId));

    // Only include nodes that share at least one workspace with the user
    // OR nodes that have no workspace assigned (for initial setup)
    if (sharedWorkspaces.length > 0 || nodeWorkspaceIds.length === 0) {
      const workspaceNames = sharedWorkspaces.map(wsId => {
        const ws = userWorkspaces.find(w => w.id === wsId);
        return ws?.name || 'Unknown';
      });

      const ownerId = nodeManager.getNodeOwner(node.id);
      visibleNodes.push({
        id: node.id,
        workspaceIds: sharedWorkspaces,
        workspaceNames: workspaceNames.length > 0 ? workspaceNames : ['Not assigned'],
        available: node.available,
        capabilities: node.capabilities,
        connectedAt: node.last_heartbeat,
        ownerId,
        isOwner: ownerId === session.userId,
        isUnclaimed: !ownerId,
      } as any);
    }
  }

  res.json({ nodes: visibleNodes });
});

// Claim an unclaimed node
app.post('/api/v1/nodes/:nodeId/claim', requireAuth, (req, res) => {
  const { nodeId } = req.params;
  const session = (req as any).session;

  // Check if node exists
  const nodes = nodeManager.getNodes();
  const node = nodes.find(n => n.id === nodeId);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  // Check if already claimed
  if (!nodeManager.isNodeUnclaimed(nodeId)) {
    res.status(403).json({ error: 'Node is already claimed by another user' });
    return;
  }

  // Claim the node
  const success = nodeManager.claimNode(nodeId, session.userId);
  if (!success) {
    res.status(500).json({ error: 'Failed to claim node' });
    return;
  }

  res.json({
    success: true,
    nodeId,
    ownerId: session.userId,
    message: 'Node claimed successfully'
  });
});

// Assign a node to workspaces
app.post('/api/v1/nodes/:nodeId/workspaces', requireAuth, (req, res) => {
  const { nodeId } = req.params;
  const { workspaceIds } = req.body;
  const session = (req as any).session;

  if (!workspaceIds || !Array.isArray(workspaceIds)) {
    res.status(400).json({ error: 'workspaceIds array is required' });
    return;
  }

  // Check ownership - must own the node or node must be unclaimed
  const isOwner = nodeManager.isNodeOwner(nodeId, session.userId);
  const isUnclaimed = nodeManager.isNodeUnclaimed(nodeId);

  if (!isOwner && !isUnclaimed) {
    res.status(403).json({ error: 'You do not own this node' });
    return;
  }

  // If unclaimed, claim it for this user
  if (isUnclaimed) {
    nodeManager.claimNode(nodeId, session.userId);
  }

  // Verify user is a member of all specified workspaces
  for (const wsId of workspaceIds) {
    if (!workspaceManager.isMember(wsId, session.userId)) {
      res.status(403).json({ error: `Not a member of workspace ${wsId}` });
      return;
    }
  }

  // Add node to each workspace
  let added = 0;
  for (const wsId of workspaceIds) {
    if (nodeManager.addNodeToWorkspace(nodeId, wsId)) {
      added++;
    }
  }

  // Also notify the node of its workspace assignments
  nodeManager.sendToNode(nodeId, {
    type: 'workspaces_updated',
    workspaceIds,
  } as any);

  res.json({
    success: true,
    nodeId,
    workspaces: nodeManager.getNodeWorkspaces(nodeId),
    message: `Node assigned to ${added} workspace(s)`
  });
});

// Add a node to a workspace using share key
app.post('/api/v1/workspaces/:id/nodes/add-by-key', requireAuth, (req, res) => {
  const { id: workspaceId } = req.params;
  const { shareKey } = req.body;
  const session = (req as any).session;

  if (!shareKey || typeof shareKey !== 'string') {
    res.status(400).json({ error: 'shareKey is required' });
    return;
  }

  // Check user is member of workspace
  if (!workspaceManager.isMember(workspaceId, session.userId)) {
    res.status(403).json({ error: 'Not a member of this workspace' });
    return;
  }

  // Try to add node by share key
  const nodeId = nodeManager.addNodeToWorkspaceByShareKey(shareKey, workspaceId);

  if (!nodeId) {
    res.status(404).json({ error: 'Invalid share key or node is offline' });
    return;
  }

  // Get the node details
  const node = nodeManager.getNodeByShareKey(shareKey);

  res.json({
    success: true,
    nodeId,
    hostname: node?.id.split('-')[0] || 'node',
    capabilities: node?.capabilities || {},
    message: 'Node added to workspace',
  });
});

// Update resource limits for a node
app.post('/api/v1/nodes/:nodeId/limits', requireAuth, (req, res) => {
  const { nodeId } = req.params;
  const { cpuCores, ramPercent, storageGb, gpuVramPercent } = req.body;
  const session = (req as any).session;

  // Check ownership - must own the node
  if (!nodeManager.isNodeOwner(nodeId, session.userId)) {
    res.status(403).json({ error: 'You do not own this node' });
    return;
  }

  const limits = {
    cpuCores: cpuCores !== undefined ? Number(cpuCores) : undefined,
    ramPercent: ramPercent !== undefined ? Number(ramPercent) : undefined,
    storageGb: storageGb !== undefined ? Number(storageGb) : undefined,
    gpuVramPercent: gpuVramPercent,
  };

  const success = nodeManager.updateNodeLimits(nodeId, limits);

  if (!success) {
    res.status(404).json({ error: 'Node not found or not connected' });
    return;
  }

  res.json({ success: true, nodeId, limits });
});

// Register a new node (HTTP endpoint for initial registration)
app.post('/api/v1/nodes/register', (req, res) => {
  const result = RegisterNodeRequestSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    return;
  }

  const { wallet_address, capabilities } = result.data;
  const registration = nodeManager.registerNode(wallet_address, capabilities);

  res.json(registration);
});

// Submit a job
app.post('/api/v1/jobs', requireAuth, async (req, res) => {
  const result = CreateJobRequestSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    return;
  }

  const clientId = req.headers['x-client-id']?.toString() || 'anonymous';
  const accountId = req.headers['x-account-id']?.toString();

  try {
    const job = await jobQueue.submitJob(clientId, result.data, accountId);

    res.status(201).json({
      job_id: job.id,
      status: job.status,
      created_at: job.created_at,
    });
  } catch (error) {
    res.status(402).json({ error: String(error) });
  }
});

// Get job status
app.get('/api/v1/jobs/:jobId', requireAuth, (req, res) => {
  const job = jobQueue.getJob(req.params.jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    id: job.id,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    result: job.result,
  });
});

// Cancel a job
app.delete('/api/v1/jobs/:jobId', requireAuth, async (req, res) => {
  const cancelled = await jobQueue.cancelJob(req.params.jobId);

  if (!cancelled) {
    res.status(404).json({ error: 'Job not found or already completed' });
    return;
  }

  res.json({ success: true });
});

// List jobs for a client
app.get('/api/v1/jobs', requireAuth, (req, res) => {
  const clientId = req.headers['x-client-id']?.toString() || 'anonymous';
  const jobs = jobQueue.getClientJobs(clientId);

  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      created_at: j.created_at,
    })),
  });
});

// ============ Payment Endpoints ============

// Get or create account for a wallet
app.post('/api/v1/accounts', requireAuth, (req, res) => {
  const { wallet_address, currency = 'USDC' } = req.body;

  if (!wallet_address) {
    res.status(400).json({ error: 'wallet_address is required' });
    return;
  }

  const account = paymentService.getOrCreateAccount(wallet_address, currency);

  res.json({
    account_id: account.id,
    wallet_address: account.wallet_address,
    balance_cents: account.balance_cents,
    currency: account.currency,
  });
});

// Get account balance
app.get('/api/v1/accounts/:accountId', requireAuth, (req, res) => {
  const account = paymentService.getAccount(req.params.accountId);

  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  res.json({
    account_id: account.id,
    wallet_address: account.wallet_address,
    balance_cents: account.balance_cents,
    currency: account.currency,
  });
});

// Request a deposit
app.post('/api/v1/accounts/:accountId/deposit', requireAuth, async (req, res) => {
  const { amount_cents, currency = 'USDC' } = req.body;

  if (!amount_cents || amount_cents <= 0) {
    res.status(400).json({ error: 'Valid amount_cents is required' });
    return;
  }

  try {
    const deposit = await paymentService.requestDeposit(
      req.params.accountId,
      amount_cents,
      currency
    );
    res.json(deposit);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Confirm a deposit (webhook simulation for testing)
app.post('/api/v1/deposits/:depositId/confirm', requireAuth, async (req, res) => {
  const confirmed = await paymentService.confirmDeposit(req.params.depositId);

  if (!confirmed) {
    res.status(404).json({ error: 'Deposit not found or already confirmed' });
    return;
  }

  res.json({ success: true });
});

// Add test credits (development only)
app.post('/api/v1/accounts/:accountId/test-credits', requireAuth, (req, res) => {
  const { amount_cents } = req.body;

  if (!amount_cents || amount_cents <= 0) {
    res.status(400).json({ error: 'Valid amount_cents is required' });
    return;
  }

  const success = paymentService.addTestCredits(req.params.accountId, amount_cents);

  if (!success) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const account = paymentService.getAccount(req.params.accountId);
  res.json({
    success: true,
    new_balance_cents: account?.balance_cents || 0,
  });
});

// Request a withdrawal
app.post('/api/v1/accounts/:accountId/withdraw', requireAuth, async (req, res) => {
  const { amount_cents, destination_address } = req.body;

  if (!amount_cents || !destination_address) {
    res.status(400).json({ error: 'amount_cents and destination_address are required' });
    return;
  }

  try {
    const withdrawal = await paymentService.requestWithdraw(
      req.params.accountId,
      amount_cents,
      destination_address
    );
    res.json(withdrawal);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get payment history
app.get('/api/v1/accounts/:accountId/payments', requireAuth, (req, res) => {
  const payments = paymentService.getPaymentHistory(req.params.accountId);

  res.json({
    payments: payments.map((p) => ({
      id: p.id,
      amount_cents: p.amount_cents,
      currency: p.currency,
      status: p.status,
      job_id: p.job_id,
      created_at: p.created_at,
    })),
  });
});

// Get payment stats
app.get('/api/v1/payments/stats', requireAuth, (req, res) => {
  res.json(paymentService.getStats());
});

// ============ Flow Deployment Endpoints ============

// Deploy a flow
app.post('/api/v1/flows/deploy', requireAuth, async (req, res) => {
  const result = DeployFlowRequestSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.issues });
    return;
  }

  const clientId = req.headers['x-client-id']?.toString() || 'anonymous';
  const accountId = req.headers['x-account-id']?.toString();

  try {
    const deployment = await flowDeploymentService.deployFlow(clientId, result.data, accountId);

    res.status(201).json({
      deployment_id: deployment.id,
      flow_id: deployment.flowId,
      name: deployment.name,
      status: deployment.status,
      node_statuses: deployment.nodeStatuses,
      created_at: deployment.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// Get flow deployment status
app.get('/api/v1/flows/:deploymentId/status', requireAuth, (req, res) => {
  const deployment = flowDeploymentService.getDeployment(req.params.deploymentId);

  if (!deployment) {
    res.status(404).json({ error: 'Deployment not found' });
    return;
  }

  res.json({
    id: deployment.id,
    flow_id: deployment.flowId,
    name: deployment.name,
    status: deployment.status,
    node_statuses: deployment.nodeStatuses,
    node_jobs: deployment.nodeJobs,
    total_cost_cents: deployment.totalCostCents,
    created_at: deployment.createdAt,
    updated_at: deployment.updatedAt,
    completed_at: deployment.completedAt,
    error: deployment.error,
  });
});

// Cancel a flow deployment
app.delete('/api/v1/flows/:deploymentId', requireAuth, async (req, res) => {
  const cancelled = await flowDeploymentService.cancelDeployment(req.params.deploymentId);

  if (!cancelled) {
    res.status(404).json({ error: 'Deployment not found or already completed' });
    return;
  }

  res.json({ success: true });
});

// List deployments for a client
app.get('/api/v1/flows', requireAuth, (req, res) => {
  const clientId = req.headers['x-client-id']?.toString() || 'anonymous';
  const deployments = flowDeploymentService.getClientDeployments(clientId);

  res.json({
    deployments: deployments.map((d) => ({
      id: d.id,
      flow_id: d.flowId,
      name: d.name,
      status: d.status,
      total_cost_cents: d.totalCostCents,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    })),
  });
});

// Get flow deployment statistics
app.get('/api/v1/flows/stats', requireAuth, (req, res) => {
  res.json(flowDeploymentService.getStats());
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ HTTP Server ============

const server = http.createServer(app);

// ============ WebSocket Server ============

const wss = new WebSocketServer({ server, path: WS_PATH });

wss.on('connection', (ws: WebSocket) => {
  nodeManager.handleConnection(ws);
});

// ============ Start Server ============

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  RhizOS Orchestrator v0.1.0');
  console.log('========================================');
  console.log(`  HTTP API:    http://localhost:${PORT}`);
  console.log(`  WebSocket:   ws://localhost:${PORT}${WS_PATH}`);
  console.log('========================================');
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /health                    - Health check');
  console.log('  GET  /api/v1/stats              - Network statistics');
  console.log('  GET  /api/v1/nodes              - List connected nodes');
  console.log('  POST /api/v1/nodes/register     - Register a node');
  console.log('  POST /api/v1/jobs               - Submit a job');
  console.log('  GET  /api/v1/jobs/:id           - Get job status');
  console.log('  DELETE /api/v1/jobs/:id         - Cancel a job');
  console.log('  POST /api/v1/flows/deploy       - Deploy a flow');
  console.log('  GET  /api/v1/flows              - List flow deployments');
  console.log('  GET  /api/v1/flows/:id/status   - Get deployment status');
  console.log('  DELETE /api/v1/flows/:id        - Cancel deployment');
  console.log('');
  console.log('Waiting for nodes to connect...');
});

// ============ Graceful Shutdown ============

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
