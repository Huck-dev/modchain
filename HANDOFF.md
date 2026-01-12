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

3. **Electron Node App**
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
│   │       └── FlowBuilder.tsx      # Main flow builder
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

## WorkspaceDetail.tsx Tabs
1. **Tasks** - Kanban board (todo, in_progress, done)
2. **Flows** - Create/manage workspace flows with EDIT/RUN buttons
3. **Console** - Command interface (help, nodes, members, stats, tasks)
4. **Resources** - Connected nodes, usage summary, members list
5. **API Keys** - Add/remove provider API keys

## Key Interfaces (workspace-manager.ts)

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
  key: string;
  addedBy: string;
  addedAt: string;
}

interface WorkspaceFlow {
  id: string;
  name: string;
  description: string;
  flow: any; // nodes, connections
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ResourceUsageEntry {
  id: string;
  flowId?: string;
  flowName?: string;
  type: 'api_call' | 'compute' | 'storage';
  provider?: string;
  tokensUsed?: number;
  computeSeconds?: number;
  costCents: number;
  userId: string;
  timestamp: string;
}
```

## API Endpoints

### Workspace API Keys
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/workspaces/:id/api-keys` | GET | List keys (masked) |
| `/api/v1/workspaces/:id/api-keys` | POST | Add key |
| `/api/v1/workspaces/:id/api-keys/:keyId` | DELETE | Remove key |

### Workspace Flows
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/workspaces/:id/flows` | GET | List flows |
| `/api/v1/workspaces/:id/flows` | POST | Create flow |
| `/api/v1/workspaces/:id/flows/:flowId` | GET | Get flow |
| `/api/v1/workspaces/:id/flows/:flowId` | PATCH | Update flow |
| `/api/v1/workspaces/:id/flows/:flowId` | DELETE | Delete flow |

### Resource Usage
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/workspaces/:id/usage` | GET | Get raw usage |
| `/api/v1/workspaces/:id/usage/summary` | GET | Get aggregated summary |
| `/api/v1/workspaces/:id/usage` | POST | Record usage entry |

### Nodes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/my-nodes` | GET | Get user's visible nodes |
| `/api/v1/nodes/:nodeId/claim` | POST | Claim unowned node |
| `/api/v1/nodes/:nodeId/workspaces` | POST | Assign to workspaces |
| `/api/v1/nodes/:nodeId/limits` | POST | Set resource limits |

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

# Check built files
/tmp/remote.sh "ls -la /usr/share/nginx/html/"
```

## Build Electron Installer
```bash
# Windows (from WSL)
cd /mnt/d/modchain/src/node-electron
pnpm build && cp src/index.html dist/
powershell.exe -ExecutionPolicy Bypass -Command "$env:Path = 'C:\\Program Files\\nodejs;' + $env:Path; cd D:\\modchain\\src\\node-electron; npm run dist:win"

# Linux
pnpm dist:linux
```

## TODOs / Known Issues
1. Flow "EDIT" button links to FlowBuilder but workspace flow loading not implemented
2. Flow "RUN" button is placeholder (console.log)
3. Resource tracking needs to be called during actual flow execution
4. Consider HTTPS (Let's Encrypt) for better security

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+

## Git Info
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Latest: "Add workspace flows, API keys, and resource tracking"
- Release: v0.1.2 (Windows + Linux installers)
