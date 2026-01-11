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

## Current State (Jan 11 2026)

### What's Working
1. **Electron Node App** (`src/node-electron/`)
   - Hardware detection and display (CPU, RAM, GPUs, storage)
   - WebSocket connection to orchestrator with auto-reconnect
   - Receives resource limit updates from web app
   - Receives workspace assignment updates
   - Windows installer built: `release/OtherThing-Node-Setup.exe` (73MB)
   - **NOTE**: New installer needs to be uploaded to prod (upload was stuck)

2. **Web App** (`src/desktop/`)
   - Node page auto-detects connected nodes (polls every 10 seconds)
   - Resource allocation sliders (CPU cores, RAM %, Storage GB, GPU VRAM %)
   - "Apply Limits" button sends limits to connected node
   - "Assign to Workspaces" button assigns node to selected workspaces
   - Workspace dashboard with Kanban board
   - Fixed: `crypto.randomUUID` fallback for HTTP (non-secure) contexts

3. **Orchestrator** (`src/orchestrator/`)
   - `GET /api/v1/my-nodes` - Returns all connected nodes (no auth required)
   - `POST /api/v1/nodes/:nodeId/workspaces` - Assign node to workspaces
   - `POST /api/v1/nodes/:nodeId/limits` - Send resource limits to node
   - Task CRUD endpoints for workspaces (require auth)

### Known Issues / In Progress

1. **Installer Upload Stuck**
   - New Electron installer with limit handling built locally
   - Location: `D:\modchain\src\node-electron\release\OtherThing-Node-Setup.exe`
   - SCP upload to prod server keeps getting stuck
   - Old installer (Jan 10) still on prod at `/usr/share/nginx/html/downloads/`
   - **TODO**: Upload new installer to prod

2. **Ticket/Task Creation**
   - User reports "creating a ticket does nothing"
   - Endpoints exist: `POST /api/v1/workspaces/:id/tasks`
   - Requires authentication - check if user is logged in
   - Check browser Network tab for 401 errors

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
| `src/desktop/src/pages/WorkspaceDetail.tsx` | Workspace dashboard with Kanban |

### Orchestrator
| File | Purpose |
|------|---------|
| `src/orchestrator/src/index.ts` | Main backend - all API endpoints |
| `src/orchestrator/src/services/node-manager.ts` | Node management, `sendToNode()`, `updateNodeLimits()` |

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
# Pull and rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S rm -rf dist && echo 'bAttlezone12a!' | sudo -S pnpm build"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/assets /usr/share/nginx/html/index.html && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Build Electron Installer (Windows)
```bash
cd /mnt/d/modchain/src/node-electron
pnpm build && cp src/index.html dist/

# Build Windows installer (run from WSL):
powershell.exe -ExecutionPolicy Bypass -Command "\$env:Path = 'C:\\Program Files\\nodejs;' + \$env:Path; cd D:\\modchain\\src\\node-electron; npm run dist:win"
```

## Upload Installer to Prod (NEEDS FIXING)
```bash
# This keeps getting stuck - try alternative methods:
sshpass -p 'bAttlezone12a!' scp /mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe administrator@155.117.46.228:/tmp/

# Then move to downloads:
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S mv /tmp/OtherThing-Node-Setup.exe /usr/share/nginx/html/downloads/"
```

## Git
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Latest commit: `12fec51` - "Fix crypto.randomUUID for HTTP and add node status polling"

## Next Steps
1. **Upload new installer to prod** - SCP keeps getting stuck, try rsync or split file
2. **Debug ticket creation** - Check browser Network tab, ensure user is logged in
3. **Test full flow**: Install new Electron app, connect, assign to workspace, apply limits
4. **Consider HTTPS** - Let's Encrypt would fix remaining browser API issues

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+
