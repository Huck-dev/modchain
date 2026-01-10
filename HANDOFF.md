# OtherThing Project Handoff Document
**Last Updated**: January 2026

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
# Pull and rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S pnpm build"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/* && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

## Project Structure
```
/mnt/d/modchain/
├── src/
│   ├── desktop/          # React frontend (Vite) - served at production URL
│   ├── orchestrator/     # Node.js backend (Express + WebSocket)
│   ├── node-electron/    # Native node installer (Electron)
│   ├── cli/              # CLI tools
│   └── mcp-adapters/     # MCP protocol adapters
├── pnpm-workspace.yaml
└── tasks.json            # Task persistence file
```

## Electron Native Node

### Location
`/mnt/d/modchain/src/node-electron/`

### Current Status
- [x] Simple UI showing hardware info (CPU, RAM, GPUs, storage)
- [x] Start/Stop node button
- [x] HTTP API on port 3847 for web detection
- [x] WebSocket connection to orchestrator
- [x] Windows installer built and uploaded
- [x] Linux AppImage built and uploaded
- [ ] **Web app "Detect Existing" not connecting to local node** (needs debugging)

### How It Works
1. User downloads installer from web app (Node page)
2. User installs and runs OtherThing Node
3. Electron app detects hardware via `systeminformation` library
4. Electron app runs HTTP server on `localhost:3847`
5. Web app fetches `http://localhost:3847/hardware` to detect the running node
6. User clicks "Start Node" to connect to orchestrator via WebSocket

### Build Commands
```bash
cd /mnt/d/modchain/src/node-electron

# Development
pnpm build              # Compile TypeScript
cp src/index.html dist/ # Copy HTML
npx electron .          # Run in dev mode

# Build installers (run on Windows for .exe)
powershell.exe -ExecutionPolicy Bypass -Command "$env:Path = 'C:\Program Files\nodejs;' + $env:Path; cd D:\modchain\src\node-electron; npm run dist:win"

# Linux (run from WSL)
pnpm dist:linux
```

### Key Files
| File | Purpose |
|------|---------|
| `src/main.ts` | Electron main process, HTTP server on 3847, IPC handlers |
| `src/hardware.ts` | Hardware detection using systeminformation |
| `src/node-service.ts` | WebSocket connection to orchestrator |
| `src/preload.ts` | contextBridge exposing electronAPI to renderer |
| `src/index.html` | Simple UI with hardware display and controls |

### HTTP API (localhost:3847)
- `GET /hardware` - Returns CPU, RAM, GPUs, storage info
- `GET /status` - Returns node running/connected status

## Web App (Desktop Frontend)

### Key Pages
| Route | File | Purpose |
|-------|------|---------|
| `/node` | `NodeControl.tsx` | Download installers, detect hardware, start web node |
| `/workspace/:id` | `WorkspaceDetail.tsx` | Kanban board, console, resources |
| `/workspaces` | `Workspace.tsx` | List/create workspaces |

### Node Page Flow
1. Shows download buttons for Windows/macOS/Linux installers
2. "Detect Existing" button fetches `http://localhost:3847/hardware`
3. If native node detected, shows real hardware info
4. If not, shows placeholder and prompts to download

## Download URLs (LIVE)
- Windows: http://155.117.46.228/downloads/OtherThing-Node-Setup.exe
- Linux: http://155.117.46.228/downloads/OtherThing-Node.AppImage

Files are in `/usr/share/nginx/html/downloads/` on production server.

## Current Issue to Fix
**Web app "Detect Existing" doesn't see the running Electron node**

Possible causes:
1. Browser blocking localhost fetch from remote origin
2. Port 3847 not accessible
3. Electron app not running when testing

Debug steps:
1. Run Electron app locally
2. Open browser console on http://155.117.46.228
3. Try: `fetch('http://localhost:3847/hardware').then(r=>r.json()).then(console.log)`
4. Check for CORS or network errors

## Remaining Tasks
1. Rebuild Windows installer with latest UI changes
2. Upload new installer to production
3. Debug web-to-local-node detection
4. Test full flow: download → install → detect → start → connect

## Git Info
- Remote: https://github.com/Huck-dev/rhizos-cloud.git
- Branch: main
- Note: Do NOT include Claude as co-author in commits
