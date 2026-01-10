# OtherThing Project Handoff Document

## Project Overview
**OtherThing** (formerly RhizOS) is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, and contribute compute resources via native node applications.

## Production Deployment
- **URL**: http://155.117.46.228
- **Server**: Ubuntu, administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Remote Script**: `/tmp/remote.sh` (handles SSH with expect)

### Deploy Commands
```bash
# Pull and rebuild
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S pnpm build"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/* && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Project Structure
```
/mnt/d/modchain/
├── src/
│   ├── desktop/          # React frontend (Vite)
│   ├── orchestrator/     # Node.js backend (Express + WebSocket)
│   ├── node-electron/    # Native node installer (Electron) [NEW - IN PROGRESS]
│   ├── cli/              # CLI tools
│   └── mcp-adapters/     # MCP protocol adapters
├── pnpm-workspace.yaml
└── tasks.json            # Task persistence file
```

## Key Features Built

### 1. Workspace Dashboard (`/workspace/:id`)
- **File**: `src/desktop/src/pages/WorkspaceDetail.tsx`
- Kanban board with drag-and-drop (Todo/In Progress/Done)
- Console with built-in commands (help, nodes, members, stats, tasks, clear)
- Resources tab showing connected nodes

### 2. Task Management
- **Backend**: `src/orchestrator/src/services/task-manager.ts`
- **Endpoints**: GET/POST/PATCH/DELETE `/api/v1/workspaces/:id/tasks`
- Persists to `tasks.json` file

### 3. Node Control Page
- **File**: `src/desktop/src/pages/NodeControl.tsx`
- Health check system (Orchestrator/Node/Hardware status)
- Platform-specific download buttons (Windows .exe, macOS .dmg, Linux .AppImage)
- Hardware detection via native node API on port 3847
- WebSocket connection to orchestrator for web-based node mode

## Electron Native Node (IN PROGRESS)

### Location
`/mnt/d/modchain/src/node-electron/`

### Status
- [x] Package.json configured with electron-builder
- [x] TypeScript setup
- [x] Main process (`src/main.ts`) - window, tray, IPC handlers
- [x] Hardware detection (`src/hardware.ts`) - uses systeminformation
- [x] Node service (`src/node-service.ts`) - WebSocket connection, job execution
- [x] Preload script (`src/preload.ts`) - contextBridge API
- [x] UI (`src/index.html`) - full dashboard UI
- [x] Icons created (PNG)
- [x] **Linux AppImage built** - `release/OtherThing-Node.AppImage` (104MB)
- [ ] Windows .exe build (run `pnpm dist:win`)
- [ ] macOS .dmg build (run `pnpm dist:mac`)
- [ ] Upload installers to production server `/downloads/` directory

### Build Commands
```bash
cd /mnt/d/modchain/src/node-electron
pnpm build                 # Compile TypeScript
pnpm dist:linux           # Build Linux AppImage
pnpm dist:win             # Build Windows installer
pnpm dist:mac             # Build macOS dmg
```

### Native Node Features
- Runs HTTP server on port 3847 for hardware detection
- WebSocket connection to orchestrator
- System tray integration
- Auto-reconnect on disconnect
- Job execution (shell commands, docker containers)
- Hardware detection using `systeminformation` library

### API Endpoints (localhost:3847)
- `GET /hardware` - Returns full hardware info (CPU, RAM, GPUs, storage)
- `GET /status` - Returns node running status

## Frontend Download Links
The Node page (`NodeControl.tsx`) links to:
- `/downloads/OtherThing-Node-Setup.exe` (Windows)
- `/downloads/OtherThing-Node.dmg` (macOS)
- `/downloads/OtherThing-Node.AppImage` (Linux)

These files need to be uploaded to nginx's `/usr/share/nginx/html/downloads/` on production.

## Next Steps
1. Build Windows installer: `pnpm dist:win`
2. Build macOS installer: `pnpm dist:mac` (may need macOS for signing)
3. Create `/downloads/` directory on production server
4. Upload built installers to production
5. Test the full flow: download → install → detect hardware → start node

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/desktop/src/pages/NodeControl.tsx` | Node page with download buttons |
| `src/desktop/src/pages/WorkspaceDetail.tsx` | Workspace dashboard with Kanban |
| `src/orchestrator/src/index.ts` | Main backend with all API routes |
| `src/orchestrator/src/services/task-manager.ts` | Task CRUD operations |
| `src/node-electron/src/main.ts` | Electron main process |
| `src/node-electron/src/hardware.ts` | Hardware detection |
| `src/node-electron/src/node-service.ts` | WebSocket node client |

## Git Status
- All changes committed to `main` branch
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Note: Commits should NOT include Claude as co-author per user preference
