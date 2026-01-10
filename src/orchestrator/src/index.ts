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
      },
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

// Get all connected nodes (for detecting local node from web app)
// No auth required - allows hardware detection before login
app.get('/api/v1/my-nodes', (req, res) => {
  // Return ALL connected nodes for hardware detection
  // This allows the web app to detect nodes even before workspace association
  const allNodes = nodeManager.getNodes();

  const nodes = allNodes.map((node) => ({
    id: node.id,
    workspaceId: null,
    workspaceName: 'Not assigned',
    available: node.available,
    capabilities: node.capabilities,
    connectedAt: node.connected_at,
  }));

  res.json({ nodes });
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
