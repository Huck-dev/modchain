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
- **GitHub**: https://github.com/Huck-dev/rhizos-cloud (PRIVATE repo)
- **Systemd Services**: `nginx`, `otherthing`

---

## 🚨 PRIORITY TODO: Workspace-Integrated Flow Builder

### Goal
Allow users to select a workspace directly from the main Flow Builder page (http://155.117.46.228/flow). When a workspace is selected:
1. Show the workspace's available compute resources (CPU, RAM, GPU from connected nodes)
2. Show the workspace's API keys that can be used
3. When the flow is saved, it appears in the selected workspace's Flows tab
4. When the flow is deployed/run, it uses the workspace's compute nodes

### Implementation Steps

#### 1. Add Workspace Selector to FlowBuilder.tsx
- Add a dropdown/selector in the toolbar to pick a workspace
- Fetch user's workspaces via `GET /api/v1/workspaces`
- Store selected workspace ID in state

#### 2. Fetch & Display Workspace Resources
When a workspace is selected:
- Fetch workspace nodes via `GET /api/v1/workspaces/:id/nodes`
- Fetch workspace API keys via `GET /api/v1/workspaces/:id/api-keys`
- Update the "Compute Requirements" panel to show:
  - **AVAILABLE**: Total CPU/RAM/GPU from workspace nodes
  - **REQUIRED**: What the flow needs (already calculated)
  - **STATUS**: Green if workspace has enough, yellow/red if not

#### 3. Use Workspace API Keys
- When workspace is selected, use workspace API keys instead of local settings
- Update `computeRequirements.missingKeys` logic to check workspace keys
- Show which workspace keys are available for each provider

#### 4. Save Flow to Workspace
When saving with a workspace selected:
- Call `POST /api/v1/workspaces/:id/flows` to create flow in workspace
- OR call `PATCH /api/v1/workspaces/:id/flows/:flowId` to update existing
- Flow then appears in workspace's Flows tab

#### 5. Deploy Using Workspace Compute
When deploying:
- Send workspace ID to orchestrator
- Orchestrator routes execution to workspace's connected nodes
- Track resource usage in workspace

### Key Files to Modify
- `src/desktop/src/pages/FlowBuilder.tsx` - Main changes
- `src/orchestrator/src/index.ts` - May need endpoint for workspace nodes
- `src/orchestrator/src/services/node-manager.ts` - Get nodes by workspace

### UI Mockup
```
┌─────────────────────────────────────────────────────────────────┐
│ [←] Flow Name                    [Workspace: My Project ▼]      │
│     Editing flow                 [SAVE] [DEPLOY]                │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐                      │
│ │ COMPUTE REQUIRED │  │ WORKSPACE AVAIL. │  ← New panel         │
│ │ VRAM: 24 GB      │  │ VRAM: 32 GB ✓    │                      │
│ │ RAM: 16 GB       │  │ RAM: 64 GB ✓     │                      │
│ │ CPU: 4 cores     │  │ CPU: 16 cores ✓  │                      │
│ └──────────────────┘  └──────────────────┘                      │
│                                                                 │
│ API KEYS: OpenAI ✓  Anthropic ✓  (from workspace)              │
├─────────────────────────────────────────────────────────────────┤
│                        [Flow Canvas]                            │
│                                                                 │
```

---

## Current State (Jan 12, 2026)

### What's Working
1. **Workspace Features**
   - API Keys management (OpenAI, Anthropic, Google, Groq, custom)
   - Workspace Flows (create, edit, delete)
   - Resource Usage Tracking (tokens, compute time, costs)
   - Task/Ticket Kanban board
   - Console with workspace commands
   - Member management with invite codes

2. **Node Management**
   - Node ownership/claiming system
   - Resource limit controls (CPU, RAM, GPU, Storage)
   - Workspace assignment
   - Health check with 30s timeout, 15s heartbeat
   - Auto-cleanup of stale nodes

3. **Flow Builder**
   - Drag-and-drop module placement
   - Connection drawing between nodes
   - Module palette with categories
   - Compute requirements calculation
   - Local flow save/load
   - Workspace flow editing (via URL params)

4. **Electron Node App**
   - Windows installer: `/usr/share/nginx/html/downloads/OtherThing-Node-Setup.exe`
   - Linux AppImage: `/usr/share/nginx/html/downloads/OtherThing-Node.AppImage`
   - GitHub Release: v0.1.2

## Key Project Structure
```
/mnt/d/modchain/
├── src/
│   ├── desktop/                 # React frontend (Vite)
│   │   └── src/pages/
│   │       ├── WorkspaceDetail.tsx  # Workspace view (5 tabs)
│   │       ├── NodeControl.tsx      # Node management
│   │       └── FlowBuilder.tsx      # Main flow builder ← MODIFY THIS
│   │
│   ├── orchestrator/            # Backend (Express + WebSocket)
│   │   └── src/
│   │       ├── index.ts         # API endpoints
│   │       └── services/
│   │           ├── workspace-manager.ts  # Workspaces, flows, API keys, usage
│   │           ├── node-manager.ts       # Node connections, ownership
│   │           └── task-manager.ts       # Task/ticket management
│   │
│   ├── node-electron/           # Desktop node app (Electron)
│   └── shared/                  # Shared schemas (flows.ts)
│
└── workspaces.json              # Workspace data (on server: /opt/rhizos-cloud/)
```

## Key Interfaces

### workspace-manager.ts
```typescript
interface Workspace {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  inviteCode: string;
  ownerId: string;
  members: WorkspaceMember[];
  apiKeys: WorkspaceApiKey[];
  flows: WorkspaceFlow[];
  resourceUsage: WorkspaceResourceUsage;
  createdAt: string;
}

interface WorkspaceApiKey {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';
  name: string;
  key: string;  // Full key stored, masked when returned to client
  addedBy: string;
  addedAt: string;
}

interface WorkspaceFlow {
  id: string;
  name: string;
  description: string;
  flow: any; // { nodes: [...], connections: [...] }
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### node-manager.ts
```typescript
interface ConnectedNode {
  id: string;
  hostname: string;
  ownerId: string | null;
  workspaces: string[];  // Workspace IDs this node is assigned to
  status: 'online' | 'offline' | 'busy';
  capabilities: {
    cpuCores: number;
    memoryMb: number;
    gpuCount: number;
    storageMb: number;
  };
  limits: {
    maxCpuPercent: number;
    maxMemoryMb: number;
    maxGpuPercent: number;
    maxStorageMb: number;
  };
}
```

## API Endpoints

### Workspaces
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/workspaces` | GET | List user's workspaces |
| `/api/v1/workspaces/:id` | GET | Get workspace details |
| `/api/v1/workspaces/:id/nodes` | GET | Get nodes assigned to workspace |
| `/api/v1/workspaces/:id/api-keys` | GET | List API keys (masked) |
| `/api/v1/workspaces/:id/flows` | GET | List flows |
| `/api/v1/workspaces/:id/flows` | POST | Create flow |
| `/api/v1/workspaces/:id/flows/:flowId` | PATCH | Update flow |

### Nodes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/my-nodes` | GET | Get user's visible nodes |
| `/api/v1/nodes/:nodeId/claim` | POST | Claim unowned node |
| `/api/v1/nodes/:nodeId/workspaces` | POST | Assign to workspaces |

## Deploy Commands
```bash
# 1. Commit and push
git add -A && git commit -m "message" && git push

# 2. Make repo public (required for server pull)
gh repo edit Huck-dev/rhizos-cloud --visibility public

# 3. Pull on server
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"

# 4. Make repo private again
gh repo edit Huck-dev/rhizos-cloud --visibility private

# 5. Rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S rm -rf dist && echo 'bAttlezone12a!' | sudo -S pnpm build"

# 6. Deploy and restart
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/assets /usr/share/nginx/html/index.html && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/ && echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Useful Server Commands
```bash
# Check service status
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl status nginx otherthing --no-pager | head -20"

# View orchestrator logs
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S journalctl -u otherthing --since '5 minutes ago' --no-pager | tail -30"

# Restart services
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Other TODOs
- [ ] HTTPS (Let's Encrypt) for better security
- [ ] Full token/cost tracking requires orchestrator-side implementation
- [ ] Orchestrator needs to actually route jobs to workspace nodes

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+

## Git Info
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Latest: "Add workspace flow editor integration"
- Release: v0.1.2 (Windows + Linux installers)
