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
import {
  RegisterNodeRequestSchema,
  CreateJobRequestSchema,
} from './types/index.js';

// ============ Configuration ============

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PATH = '/ws/node';

// ============ Initialize Services ============

const nodeManager = new NodeManager();
const paymentService = new PaymentService();
const jobQueue = new JobQueue(nodeManager, paymentService);

// ============ Express App ============

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    uptime: process.uptime(),
  });
});

// Network statistics
app.get('/api/v1/stats', (req, res) => {
  res.json({
    nodes: nodeManager.getStats(),
    jobs: jobQueue.getStats(),
  });
});

// List connected nodes
app.get('/api/v1/nodes', (req, res) => {
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
app.post('/api/v1/jobs', async (req, res) => {
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
app.get('/api/v1/jobs/:jobId', (req, res) => {
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
app.delete('/api/v1/jobs/:jobId', async (req, res) => {
  const cancelled = await jobQueue.cancelJob(req.params.jobId);

  if (!cancelled) {
    res.status(404).json({ error: 'Job not found or already completed' });
    return;
  }

  res.json({ success: true });
});

// List jobs for a client
app.get('/api/v1/jobs', (req, res) => {
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
app.post('/api/v1/accounts', (req, res) => {
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
app.get('/api/v1/accounts/:accountId', (req, res) => {
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
app.post('/api/v1/accounts/:accountId/deposit', async (req, res) => {
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
app.post('/api/v1/deposits/:depositId/confirm', async (req, res) => {
  const confirmed = await paymentService.confirmDeposit(req.params.depositId);

  if (!confirmed) {
    res.status(404).json({ error: 'Deposit not found or already confirmed' });
    return;
  }

  res.json({ success: true });
});

// Add test credits (development only)
app.post('/api/v1/accounts/:accountId/test-credits', (req, res) => {
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
app.post('/api/v1/accounts/:accountId/withdraw', async (req, res) => {
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
app.get('/api/v1/accounts/:accountId/payments', (req, res) => {
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
app.get('/api/v1/payments/stats', (req, res) => {
  res.json(paymentService.getStats());
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
  console.log('  GET  /health              - Health check');
  console.log('  GET  /api/v1/stats        - Network statistics');
  console.log('  GET  /api/v1/nodes        - List connected nodes');
  console.log('  POST /api/v1/nodes/register - Register a node');
  console.log('  POST /api/v1/jobs         - Submit a job');
  console.log('  GET  /api/v1/jobs/:id     - Get job status');
  console.log('  DELETE /api/v1/jobs/:id   - Cancel a job');
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
