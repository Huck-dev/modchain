# OtherThing Project Handoff Document
**Last Updated**: January 11, 2026

## Project Overview
**OtherThing** is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, and contribute compute resources via native node applications.

## Production Server
- **URL**: http://155.117.46.228
- **SSH**: administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Remote Script**: `/tmp/remote.sh` (handles SSH with expect)
- **Note**: Repo is PRIVATE - must make public temporarily for server to git pull

## Current State (Jan 11 2026)

### What's Working
1. **Electron Node App** (`src/node-electron/`)
   - Hardware detection and display (CPU, RAM, GPUs, storage)
   - WebSocket connection to orchestrator with auto-reconnect
   - Receives resource limit updates from web app
   - Receives workspace assignment updates
   - Windows installer on prod: `/usr/share/nginx/html/downloads/OtherThing-Node-Setup.exe` (73MB)

2. **Web App** (`src/desktop/`)
   - Node page auto-detects connected nodes (polls every 10 seconds)
   - Resource allocation sliders (CPU cores, RAM %, Storage GB, GPU VRAM %)
   - "Apply Limits" button sends limits to connected node
   - "Assign to Workspaces" button assigns node to selected workspaces
   - Workspace dashboard with Kanban board
   - Task/ticket creation with error feedback
   - Fixed: `crypto.randomUUID` fallback for HTTP (non-secure) contexts

3. **Orchestrator** (`src/orchestrator/`)
   - `GET /api/v1/my-nodes` - Returns all connected nodes (no auth required)
   - `POST /api/v1/nodes/:nodeId/workspaces` - Assign node to workspaces
   - `POST /api/v1/nodes/:nodeId/limits` - Send resource limits to node
   - Task CRUD endpoints for workspaces (require auth) - WORKING

### No Known Issues
All previously reported issues have been resolved.

## Key Files

### Electron App
| File | Purpose |
|------|---------|
| `src/node-electron/src/main.ts` | Main process, HTTP server on 3847, IPC |
| `src/node-electron/src/hardware.ts` | Hardware detection via systeminformation |
| `src/node-electron/src/node-service.ts` | WebSocket connection, handles `update_limits` and `workspaces_updated` messages |
| `src/node-electron/src/index.html` | Simple UI |

### Web App
| File | Purpose |
|------|---------|
| `src/desktop/src/pages/NodeControl.tsx` | Node page - resource sliders, workspace assignment, 10s polling |
| `src/desktop/src/pages/WorkspaceDetail.tsx` | Workspace dashboard with Kanban, task creation |

### Orchestrator
| File | Purpose |
|------|---------|
| `src/orchestrator/src/index.ts` | Main backend - all API endpoints |
| `src/orchestrator/src/services/node-manager.ts` | Node management, `sendToNode()`, `updateNodeLimits()` |
| `src/orchestrator/src/services/task-manager.ts` | Task CRUD, persists to tasks.json |

## API Endpoints (Key ones)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/v1/my-nodes` | No | Get all connected nodes |
| `POST /api/v1/nodes/:nodeId/workspaces` | Yes | Assign node to workspaces |
| `POST /api/v1/nodes/:nodeId/limits` | Yes | Send resource limits to node |
| `GET /api/v1/workspaces/:id/tasks` | Yes | Get tasks for workspace |
| `POST /api/v1/workspaces/:id/tasks` | Yes | Create task |

## Deploy Commands
```bash
# IMPORTANT: Repo is private - make public first
gh repo edit --visibility public

# Pull and rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S rm -rf dist && echo 'bAttlezone12a!' | sudo -S pnpm build"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/assets /usr/share/nginx/html/index.html && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"

# Make private again
gh repo edit --visibility private
```

## Build Electron Installer (Windows)
```bash
cd /mnt/d/modchain/src/node-electron
pnpm build && cp src/index.html dist/

# Build Windows installer (run from WSL):
powershell.exe -ExecutionPolicy Bypass -Command "\$env:Path = 'C:\\Program Files\\nodejs;' + \$env:Path; cd D:\\modchain\\src\\node-electron; npm run dist:win"
```

## Upload Installer to Prod
```bash
# Use GitHub Releases (SCP/rsync hangs on large files)
# 1. Create release with installer
gh release create v0.1.x "/mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe" --title "vX.X.X" --notes "Description"

# 2. Make repo public temporarily
gh repo edit --visibility public

# 3. Download on server
/tmp/remote.sh "cd /usr/share/nginx/html/downloads && echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node-Setup.exe 'https://github.com/Huck-dev/rhizos-cloud/releases/download/v0.1.x/OtherThing-Node-Setup.exe'"

# 4. Make repo private again
gh repo edit --visibility private
```

## Git
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Latest commit: `ae048d9` - "Fix crypto.randomUUID in task-manager backend"
- GitHub Release: v0.1.1 (contains Windows installer)

## Next Steps
1. **Test full flow**: Install Electron app, connect to orchestrator, assign to workspace, create tasks
2. **Consider HTTPS** - Let's Encrypt would improve security and fix some browser API limitations
3. **Add more features** - Task assignment, due dates, notifications

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+
