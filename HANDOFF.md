# OtherThing/RhizOS Cloud - Handoff Document
**Last Updated**: January 12, 2026

## Project Overview
**OtherThing** is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, contribute compute resources via native node applications, share API keys, and build/run AI flows collaboratively.

## Production Server
- **URL**: http://155.117.46.228
- **SSH**: administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Remote Script**: `/tmp/remote.sh` (handles SSH with expect)
- **GitHub**: https://github.com/Huck-dev/rhizos-cloud (PUBLIC repo)
- **Systemd Services**: `nginx`, `otherthing`

---

## Recent Completions (This Session)

### 1. Local-First Node Share Key Architecture
- **Node app generates share key locally** (8-char alphanumeric, e.g., `AB3X7K9M`)
- Share key persisted in `userData/node-config.json`
- Node sends `share_key` to orchestrator during registration
- Orchestrator accepts node's share key (no longer generates its own)

### 2. Workspace Share Key Input
- Added "Add Node by Share Key" card in workspace Resources tab
- User enters 8-char share key from node app
- API: `POST /api/v1/workspaces/:id/nodes/add-by-key`
- Node joins workspace and appears in nodes list

### 3. Resource Limit Controls in Node App
- Added sliders for CPU cores, RAM %, Storage GB, GPU VRAM %
- Limits saved to local config and sent to orchestrator
- UI auto-adjusts max values based on detected hardware
- GPU slider only shown when GPUs detected

### 4. Resource Limits Display in Workspace UI
- Node cards show full GPU details (model + VRAM)
- Resource limits displayed as styled badges when set
- Shows: CPU cores, RAM%, Storage GB, GPU%

### 5. Workspace-Integrated Flow Builder (Previous Session)
- Workspace selector in Flow Builder header
- Shows workspace available resources vs flow requirements
- Uses workspace API keys for provider validation
- Saves/deploys flows to selected workspace
- Jobs route to workspace nodes when workspaceId specified

---

## Current Architecture

### Share Key Flow
```
1. Node App starts → Generates local share key (persisted)
2. Node connects to orchestrator → Sends share_key in registration
3. Orchestrator stores share_key → nodeId mapping
4. User enters share key in workspace UI
5. API looks up nodeId by share key → Adds node to workspace
6. Node appears in workspace with capabilities + resource limits
```

### Key Files Modified This Session
```
src/node-electron/
├── src/node-service.ts     # Local key generation, resource limits
├── src/main.ts             # IPC handlers for limits
├── src/preload.ts          # Exposed APIs
└── src/index.html          # Resource limits UI

src/orchestrator/
├── src/types/index.ts      # ResourceLimits interface
├── src/services/node-manager.ts  # Store limits from registration
└── src/index.ts            # Return limits in nodes API

src/desktop/
└── src/pages/WorkspaceDetail.tsx  # Share key input, limits display
```

---

## Key Project Structure
```
/mnt/d/modchain/
├── src/
│   ├── desktop/                 # React frontend (Vite)
│   │   └── src/pages/
│   │       ├── WorkspaceDetail.tsx  # Workspace view (5 tabs)
│   │       ├── FlowBuilder.tsx      # Flow builder with workspace selector
│   │       └── NodeControl.tsx      # Node management
│   │
│   ├── orchestrator/            # Backend (Express + WebSocket)
│   │   └── src/
│   │       ├── index.ts         # API endpoints
│   │       └── services/
│   │           ├── workspace-manager.ts  # Workspaces, flows, API keys
│   │           ├── node-manager.ts       # Node connections, share keys
│   │           └── job-queue.ts          # Job routing by workspace
│   │
│   ├── node-electron/           # Desktop node app (Electron)
│   │   ├── src/node-service.ts  # Core node logic, local config
│   │   └── release/             # Built installers
│   │
│   └── shared/                  # Shared schemas (flows.ts)
│
└── workspaces.json              # Workspace data (server: /opt/rhizos-cloud/)
```

---

## Key Interfaces

### ResourceLimits (orchestrator/types)
```typescript
interface ResourceLimits {
  cpuCores?: number;
  ramPercent?: number;
  storageGb?: number;
  gpuVramPercent?: number[];
}
```

### ConnectedNode (orchestrator/types)
```typescript
interface ConnectedNode {
  id: string;
  capabilities: NodeCapabilities;
  ws: WebSocket;
  available: boolean;
  current_jobs: number;
  last_heartbeat: Date;
  reputation: number;
  resourceLimits?: ResourceLimits;  // NEW
}
```

### NodeConfig (node-electron/node-service.ts)
```typescript
interface NodeConfig {
  shareKey: string;      // Locally generated, persistent
  nodeId: string;        // Locally generated, persistent
  resourceLimits: ResourceLimits;
}
```

---

## API Endpoints

### Workspaces
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/workspaces` | GET | List user's workspaces |
| `/api/v1/workspaces/:id` | GET | Get workspace details |
| `/api/v1/workspaces/:id/nodes` | GET | Get nodes (includes resourceLimits) |
| `/api/v1/workspaces/:id/nodes/add-by-key` | POST | Add node by share key |
| `/api/v1/workspaces/:id/api-keys` | GET | List API keys (masked) |
| `/api/v1/workspaces/:id/flows` | GET/POST | List/create flows |

### Node WebSocket Messages
```typescript
// Node → Orchestrator (registration)
{
  type: 'register',
  share_key: 'AB3X7K9M',  // Node's local share key
  capabilities: { ... },
  workspace_ids: [],
  resource_limits: { cpuCores: 8, ramPercent: 50, ... }
}

// Orchestrator → Node (confirmation)
{
  type: 'registered',
  node_id: 'node-abc123',
  share_key: 'AB3X7K9M'
}
```

---

## Deploy Commands
```bash
# 1. Commit and push
git add -A && git commit -m "message" && git push

# 2. Pull on server (repo is now public)
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"

# 3. Rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S rm -rf dist && echo 'bAttlezone12a!' | sudo -S pnpm build"

# 4. Deploy and restart
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/assets /usr/share/nginx/html/index.html && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/ && echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"

# Build Windows installer
powershell.exe -ExecutionPolicy Bypass -Command 'cd D:\modchain\src\node-electron; $env:Path = "C:\Program Files\nodejs;" + $env:Path; npm run dist:win'

# Upload to release
gh release upload v0.1.2 "/mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe" --clobber

# Update installer on server
/tmp/remote.sh "cd /usr/share/nginx/html/downloads && echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node-Setup.exe 'https://github.com/Huck-dev/rhizos-cloud/releases/download/v0.1.2/OtherThing-Node-Setup.exe'"
```

---

## Useful Server Commands
```bash
# Check service status
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl status nginx otherthing --no-pager | head -20"

# View orchestrator logs
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S journalctl -u otherthing --since '5 minutes ago' --no-pager | tail -30"

# Restart services
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

---

## Remaining TODOs
- [ ] HTTPS (Let's Encrypt) for production security
- [ ] Full token/cost tracking in orchestrator
- [ ] Job execution and result streaming
- [ ] Node reputation system based on job completion
- [ ] Multiple GPUs resource limit support (per-GPU sliders)
- [ ] Remote configuration opt-in for nodes

---

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+

## Git Info
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Release: v0.1.2 (Windows + Linux installers)
- Latest commit: "feat: show node resource limits in workspace UI"
