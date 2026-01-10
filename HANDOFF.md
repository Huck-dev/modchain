# OtherThing Project Handoff Document
**Last Updated**: January 2026

## Project Overview
**OtherThing** is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, and contribute compute resources via native node applications.

## Production Server
- **URL**: http://155.117.46.228
- **SSH**: administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Remote Script**: `/tmp/remote.sh` (handles SSH with expect)

## Current State

### What's Working
1. **Electron Node App** (`src/node-electron/`)
   - Simple UI showing hardware info (CPU, RAM, GPUs, storage)
   - Start/Stop button to connect to orchestrator
   - HTTP API on port 3847 (localhost)
   - Windows installer: `release/OtherThing-Node-Setup.exe`
   - Linux installer: `release/OtherThing-Node.AppImage`
   - Installers uploaded to production: `/usr/share/nginx/html/downloads/`

2. **Web App** (`src/desktop/`)
   - Node page with download buttons
   - Workspace dashboard with Kanban board
   - All deployed to production

### Recently Resolved
**Web app "Detect Existing" now works via orchestrator API** (Fixed Jan 10 2026)

**Problem was**: Browser security blocked HTTP sites from fetching localhost (Private Network Access policy).

**Solution implemented**: Detect via orchestrator instead of localhost
- Added `GET /api/v1/my-nodes` endpoint to orchestrator
- Updated `NodeControl.tsx` to query orchestrator for connected nodes
- When Electron node connects, it sends hardware info to orchestrator
- Web app queries `/api/v1/my-nodes` and displays hardware from connected nodes

**Flow**:
1. User starts Electron node app
2. Node connects to orchestrator WebSocket, sends hardware capabilities
3. User opens web app Node page
4. Web app calls `/api/v1/my-nodes`
5. If nodes found, displays hardware info from connected node(s)

## Key Files

### Electron App
| File | Purpose |
|------|---------|
| `src/node-electron/src/main.ts` | Main process, HTTP server on 3847, IPC |
| `src/node-electron/src/hardware.ts` | Hardware detection via systeminformation |
| `src/node-electron/src/node-service.ts` | WebSocket connection to orchestrator |
| `src/node-electron/src/index.html` | Simple UI |

### Web App
| File | Purpose |
|------|---------|
| `src/desktop/src/pages/NodeControl.tsx` | Node page - detects nodes via `/api/v1/my-nodes` |
| `src/desktop/src/pages/WorkspaceDetail.tsx` | Workspace dashboard with Kanban |

### Orchestrator
| File | Purpose |
|------|---------|
| `src/orchestrator/src/index.ts` | Main backend - includes `/api/v1/my-nodes` endpoint |

## Deploy Commands
```bash
# Pull and rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S pnpm build"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/* && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Build Electron Installer (Windows)
```bash
cd /mnt/d/modchain/src/node-electron
pnpm build && cp src/index.html dist/
# Run on Windows with admin:
powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -Command \"cd D:\modchain\src\node-electron; npm run dist:win\"'"
```

## Git
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- **Note**: Do NOT include Claude as co-author

## Next Steps
1. Test the full flow: Start Electron node, visit web app, click "Detect Existing"
2. Consider adding auto-refresh/polling to NodeControl.tsx to detect new nodes
3. Add node count indicator to workspace cards
4. Consider adding HTTPS (Let's Encrypt) to fully enable all browser APIs

## User's Hardware (for reference)
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+
