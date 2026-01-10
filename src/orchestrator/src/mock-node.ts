/**
 * Mock Node for Testing
 *
 * A simulated node that connects to the orchestrator and handles job assignments.
 * Useful for testing the deployment flow without a full node agent.
 *
 * Usage: npx ts-node src/mock-node.ts
 */

import WebSocket from 'ws';

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'ws://localhost:8080/ws/node';
const NODE_ID = process.env.NODE_ID || `mock-node-${Date.now()}`;
const JOB_DURATION_MS = parseInt(process.env.JOB_DURATION_MS || '2000', 10);

// Node capabilities
const CAPABILITIES = {
  node_id: NODE_ID,
  node_version: '0.1.0-mock',
  gpus: [
    {
      vendor: 'nvidia',
      model: 'RTX 4090 (Mock)',
      vram_mb: 24576,
      compute_capability: '8.9',
      driver_version: '535.104.05',
      supports: {
        cuda: true,
        rocm: false,
        vulkan: true,
        metal: false,
        opencl: true,
      },
    },
  ],
  cpu: {
    vendor: 'AMD',
    model: 'Ryzen 9 5950X (Mock)',
    cores: 16,
    threads: 32,
    frequency_mhz: 3400,
    architecture: 'X86_64',
    features: ['avx2', 'avx512'],
  },
  memory: {
    total_mb: 65536,
    available_mb: 48000,
  },
  storage: {
    total_gb: 2000,
    available_gb: 1500,
    storage_type: 'Nvme',
  },
  docker_version: '24.0.6',
  container_runtimes: ['docker', 'nvidia-docker'],
  mcp_adapters: ['docker', 'llm-inference', 'image-gen'],
};

// State
let ws: WebSocket | null = null;
let currentJobs = 0;
let isAvailable = true;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Connect to orchestrator
function connect() {
  console.log(`[Mock Node] Connecting to ${ORCHESTRATOR_URL}...`);

  ws = new WebSocket(ORCHESTRATOR_URL);

  ws.on('open', () => {
    console.log('[Mock Node] Connected to orchestrator');

    // Send registration
    sendMessage({
      type: 'register',
      capabilities: CAPABILITIES,
    });

    // Start heartbeat
    heartbeatInterval = setInterval(() => {
      sendMessage({
        type: 'heartbeat',
        available: isAvailable,
        current_jobs: currentJobs,
      });
    }, 10000);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    } catch (err) {
      console.error('[Mock Node] Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Mock Node] Disconnected from orchestrator');
    cleanup();

    // Reconnect after delay
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('[Mock Node] WebSocket error:', err.message);
  });
}

// Send message to orchestrator
function sendMessage(message: object) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Handle messages from orchestrator
function handleMessage(message: { type: string; [key: string]: unknown }) {
  console.log(`[Mock Node] Received: ${message.type}`);

  switch (message.type) {
    case 'registered':
      console.log(`[Mock Node] Registered successfully`);
      console.log(`[Mock Node] Node ID: ${message.node_id}`);
      break;

    case 'job_assignment':
      handleJobAssignment(message);
      break;

    case 'cancel_job':
      handleCancelJob(message.job_id as string);
      break;

    case 'error':
      console.error(`[Mock Node] Error from orchestrator: ${message.message}`);
      break;

    default:
      console.log(`[Mock Node] Unknown message type: ${message.type}`);
  }
}

// Handle job assignment
async function handleJobAssignment(message: { [key: string]: unknown }) {
  const jobId = message.job_id as string;
  const payload = message.payload as { type?: string; moduleId?: string; [key: string]: unknown };

  console.log(`[Mock Node] Job assigned: ${jobId}`);
  console.log(`[Mock Node] Payload type: ${payload?.type || 'unknown'}`);

  currentJobs++;
  isAvailable = currentJobs < 3;

  // Send accepted status
  sendMessage({
    type: 'job_status',
    job_id: jobId,
    status: 'accepted',
  });

  // Simulate preparation
  await sleep(500);
  sendMessage({
    type: 'job_status',
    job_id: jobId,
    status: 'preparing',
  });

  // Simulate execution
  await sleep(500);
  sendMessage({
    type: 'job_status',
    job_id: jobId,
    status: 'running',
  });

  // Simulate job duration
  const duration = JOB_DURATION_MS + Math.random() * 1000;
  await sleep(duration);

  // Determine result (90% success rate for testing)
  const success = Math.random() > 0.1;

  if (success) {
    // Send successful result
    sendMessage({
      type: 'job_result',
      job_id: jobId,
      result: {
        success: true,
        outputs: [
          {
            type: 'inline',
            data: JSON.stringify({
              message: 'Mock job completed successfully',
              moduleId: payload?.moduleId,
              timestamp: new Date().toISOString(),
              mockData: {
                iterations: Math.floor(Math.random() * 100),
                metrics: {
                  accuracy: 0.95 + Math.random() * 0.05,
                  latency_ms: Math.floor(Math.random() * 100),
                },
              },
            }),
            mime_type: 'application/json',
          },
        ],
        execution_time_ms: Math.floor(duration),
        actual_cost_cents: Math.floor(Math.random() * 50) + 10,
      },
    });
    console.log(`[Mock Node] Job ${jobId} completed successfully`);
  } else {
    // Send failure result
    sendMessage({
      type: 'job_result',
      job_id: jobId,
      result: {
        success: false,
        error: 'Mock execution failed (simulated error for testing)',
        execution_time_ms: Math.floor(duration),
        actual_cost_cents: Math.floor(Math.random() * 10),
      },
    });
    console.log(`[Mock Node] Job ${jobId} failed (simulated)`);
  }

  currentJobs--;
  isAvailable = true;
}

// Handle job cancellation
function handleCancelJob(jobId: string) {
  console.log(`[Mock Node] Job cancelled: ${jobId}`);
  // In a real node, we would stop the job execution
  currentJobs = Math.max(0, currentJobs - 1);
  isAvailable = true;
}

// Cleanup on disconnect
function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  currentJobs = 0;
  isAvailable = true;
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Mock Node] Shutting down...');
  cleanup();
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Mock Node] Shutting down...');
  cleanup();
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

// Start
console.log('========================================');
console.log('  RhizOS Mock Node v0.1.0');
console.log('========================================');
console.log(`  Node ID:     ${NODE_ID}`);
console.log(`  GPU:         ${CAPABILITIES.gpus[0].model}`);
console.log(`  CPU:         ${CAPABILITIES.cpu.model}`);
console.log(`  Memory:      ${CAPABILITIES.memory.total_mb / 1024} GB`);
console.log(`  Job Duration: ${JOB_DURATION_MS}ms`);
console.log('========================================');
console.log('');

connect();
