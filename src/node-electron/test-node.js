const WebSocket = require('ws');

const ORCHESTRATOR_URL = 'ws://155.117.46.228/ws/node';
const SHARE_KEY = 'TEST1234';
const NODE_ID = 'test-node-' + Date.now();

console.log(`Connecting to ${ORCHESTRATOR_URL}...`);
console.log(`Node ID: ${NODE_ID}`);
console.log(`Share Key: ${SHARE_KEY}`);

const ws = new WebSocket(ORCHESTRATOR_URL);

ws.on('open', () => {
  console.log('Connected! Sending registration...');
  
  const registerMsg = {
    type: 'register',
    share_key: SHARE_KEY,
    capabilities: {
      node_id: NODE_ID,
      gpus: [{
        vendor: 'nvidia',
        model: 'Test GPU',
        vram_mb: 8192,
        supports: { cuda: true, rocm: false, vulkan: true, metal: false, opencl: true }
      }],
      cpu: { model: 'Test CPU', cores: 8, threads: 16, features: [] },
      memory: { total_mb: 16384, available_mb: 8192 },
      storage: { total_gb: 500, available_gb: 250 },
      mcp_adapters: ['docker']
    },
    workspace_ids: [],
    resource_limits: {}
  };
  
  ws.send(JSON.stringify(registerMsg));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg, null, 2));
  
  if (msg.type === 'registered') {
    console.log('\n✓ Node registered successfully!');
    console.log(`  Node ID: ${msg.node_id}`);
    console.log(`  Share Key: ${msg.share_key}`);
    console.log('\nKeeping connection open for 30 seconds...');
    console.log('Try adding this node to a workspace using the share key: ' + SHARE_KEY);
    
    // Send heartbeats
    setInterval(() => {
      ws.send(JSON.stringify({ type: 'heartbeat', available: true, current_jobs: 0 }));
    }, 10000);
    
    // Close after 30 seconds
    setTimeout(() => {
      console.log('\nClosing connection...');
      ws.close();
      process.exit(0);
    }, 30000);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('Connection closed');
});
