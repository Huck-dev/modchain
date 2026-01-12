# OtherThing/RhizOS Cloud - Handoff Document
**Last Updated**: January 12, 2026 (Session 3 - IPFS Phase 3)

## Project Overview
**OtherThing** is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, contribute compute resources via native node applications, share API keys, and build/run AI flows collaboratively.

## Production Server
- **URL**: http://155.117.46.228
- **SSH**: administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Remote Script**: `/tmp/remote.sh` (handles SSH with expect)
- **Systemd Services**: `nginx`, `otherthing`

## Git Repositories
| Repo | URL | Visibility | Purpose |
|------|-----|------------|---------|
| rhizos-cloud | https://github.com/Huck-dev/rhizos-cloud | Public | Main repo (orchestrator, web dashboard, node source) |
| rhizos-node | https://github.com/Huck-dev/rhizos-node | Public (temp) | Node app releases/installers |

---

## Recent Completions (This Session)

### 1. IPFS Integration (Phase 2)
- Bundled kubo v0.24.0 binaries (Win: 67MB, Linux: 87MB)
- Created IPFSManager class with full lifecycle management
- Private network mode for workspace isolation
- IPFS Storage card in UI with Start/Stop controls
- Real-time stats display (repo size, objects, peers)
- Handle workspace_joined message with swarm key
- Auto-connect to bootstrap peers
- Send ipfs_ready with peer ID and addresses

### 2. Drive Selector (Phase 1)
- Added `getDrives()` to hardware.ts - detects all drives/partitions
- Drive selector dropdown in Resource Limits UI
- Visual drive usage bar with color coding
- Storage path persisted and sent to orchestrator

### 3. Release v1.3.0
- Windows installer: 99MB (was 73MB, +IPFS)
- Linux AppImage: 137MB (was 100MB, +IPFS)
- Downloads updated on production server

---

## Key Project Structure
```
/mnt/d/modchain/
├── src/
│   ├── desktop/                 # React frontend (Vite)
│   │   └── src/pages/
│   │       ├── WorkspaceDetail.tsx  # Workspace view (5 tabs)
│   │       ├── FlowBuilder.tsx      # Flow builder with workspace selector
│   │       └── NodeControl.tsx      # Node management, downloads
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
│   │   ├── src/
│   │   │   ├── main.ts          # Electron main process, IPC
│   │   │   ├── preload.ts       # Exposed APIs to renderer
│   │   │   ├── index.html       # GUI (cyber aesthetic)
│   │   │   ├── node-service.ts  # WebSocket, job execution
│   │   │   ├── hardware.ts      # Hardware/drive detection
│   │   │   └── ipfs-manager.ts  # IPFS daemon lifecycle
│   │   ├── ipfs-bin/            # Bundled IPFS binaries
│   │   │   ├── win/ipfs.exe     # Windows kubo (67MB)
│   │   │   └── linux/ipfs       # Linux kubo (87MB)
│   │   ├── package.json         # Build scripts + extraResources
│   │   └── release/             # Built installers
│   │
│   └── shared/                  # Shared schemas (flows.ts)
│
└── workspaces.json              # Workspace data (server: /opt/rhizos-cloud/)

/tmp/rhizos-node/                # Separate repo for node releases
```

---

## Node App Architecture

### Features
- Custom frameless window (Windows) with title bar controls
- Hardware detection (CPU, RAM, Storage, GPUs via systeminformation)
- Resource limit sliders (saved to local config)
- Share key (8-char, locally generated, persistent)
- Remote control toggle (opt-in for dashboard management)
- WebSocket connection with auto-reconnect
- Workspace assignment display

### Build Commands
```bash
cd /mnt/d/modchain/src/node-electron

# Windows
npm run dist:win
# Output: release/OtherThing-Node-Setup.exe

# Linux
npm run dist:linux
# Output: release/OtherThing-Node.AppImage

# Launch locally (Windows)
powershell.exe -Command "Start-Process 'D:\modchain\src\node-electron\release\win-unpacked\OtherThing Node.exe'"
```

### Config Storage
- Path: `%APPDATA%/otherthing-node/node-config.json` (Windows)
- Contains: shareKey, nodeId, resourceLimits, remoteControlEnabled, storagePath

### IPFS Integration (v1.3.0+)
- **IPFSManager** class (`src/ipfs-manager.ts`) handles all IPFS operations
- Bundled kubo v0.24.0 binary in `resources/ipfs/`
- Private network mode (no public DHT, no mDNS)
- IPFS repo stored at `<storagePath>/otherthing-storage/ipfs/`
- Swarm key written to repo when workspace_joined received
- Auto-connects to bootstrap peers from orchestrator

---

## WebSocket Protocol

### Node → Orchestrator (Registration)
```json
{
  "type": "register",
  "share_key": "AB3X7K9M",
  "capabilities": {
    "node_id": "node-abc123",
    "gpus": [...],
    "cpu": { "model": "...", "cores": 64 },
    "memory": { "total_mb": 262144 },
    "storage": { "total_gb": 15000 }
  },
  "workspace_ids": [],
  "resource_limits": { "cpuCores": 32, "ramPercent": 50 },
  "remote_control_enabled": true
}
```

### Orchestrator → Node (Confirmation)
```json
{
  "type": "registered",
  "node_id": "node-abc123",
  "share_key": "AB3X7K9M",
  "workspace_ids": ["ws-123", "ws-456"]
}
```

### Heartbeat (every 15s)
```json
{
  "type": "heartbeat",
  "available": true,
  "current_jobs": 0,
  "remote_control_enabled": true
}
```

### IPFS Messages (Phase 3)

**Orchestrator → Node: workspace_joined**
```json
{
  "type": "workspace_joined",
  "workspace_id": "ws-123",
  "ipfs_swarm_key": "a1b2c3d4e5f6...",  // 64-char hex (32 bytes)
  "bootstrap_peers": [
    "/ip4/192.168.1.10/tcp/4001/p2p/QmNode1...",
    "/ip4/192.168.1.20/tcp/4001/p2p/QmNode2..."
  ]
}
```

**Node → Orchestrator: ipfs_ready**
```json
{
  "type": "ipfs_ready",
  "peer_id": "QmNodeABC123...",
  "addresses": [
    "/ip4/192.168.1.5/tcp/4001",
    "/ip4/192.168.1.5/udp/4001/quic"
  ]
}
```

---

## Deploy Commands

### Full Deployment
```bash
# 1. Commit changes (both repos)
cd /mnt/d/modchain && git add -A && git commit -m "message" && git push
cd /tmp/rhizos-node && git add -A && git commit -m "message" && git push

# 2. Build installers
cd /mnt/d/modchain/src/node-electron
npm run dist:win
npm run dist:linux

# 3. Create GitHub release
cd /tmp/rhizos-node
gh release create v1.1.0 \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe" \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node.AppImage" \
  --title "v1.1.0" --notes "Release notes here"

# 4. Update server
/tmp/remote.sh "cd /opt/rhizos-cloud && echo 'bAttlezone12a!' | sudo -S git pull"

# 5. Rebuild frontend
/tmp/remote.sh "cd /opt/rhizos-cloud/src/desktop && echo 'bAttlezone12a!' | sudo -S rm -rf dist && echo 'bAttlezone12a!' | sudo -S pnpm build"

# 6. Deploy frontend
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S rm -rf /usr/share/nginx/html/assets /usr/share/nginx/html/index.html && echo 'bAttlezone12a!' | sudo -S cp -r /opt/rhizos-cloud/src/desktop/dist/* /usr/share/nginx/html/"

# 7. Update downloads
/tmp/remote.sh "cd /usr/share/nginx/html/downloads && echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node-Setup.exe 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.1.0/OtherThing-Node-Setup.exe' && echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node.AppImage 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.1.0/OtherThing-Node.AppImage'"

# 8. Restart services
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
```

### Quick Commands
```bash
# Check service status
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl status nginx otherthing --no-pager | head -20"

# View orchestrator logs
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S journalctl -u otherthing --since '5 minutes ago' --no-pager | tail -30"

# Restart services
/tmp/remote.sh "echo 'bAttlezone12a!' | sudo -S systemctl restart nginx otherthing"
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

### Nodes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/nodes` | GET | List all nodes |
| `/api/v1/my-nodes` | GET | List nodes in user's workspaces |
| `/api/v1/nodes/:id/limits` | POST | Update resource limits |

---

## Remaining TODOs
- [ ] **IPFS Integration** (see IPFS-STORAGE.md)
  - [x] Bundle kubo binary in electron app (v1.3.0)
  - [ ] Workspace swarm key management in orchestrator (Phase 3)
  - [ ] Private IPFS clusters per workspace (Phase 3)
  - [ ] Content operations API (Phase 4)
  - [ ] Dashboard storage tab (Phase 5)
- [ ] HTTPS (Let's Encrypt) for production security
- [ ] Make rhizos-node repo private again
- [ ] Full token/cost tracking in orchestrator
- [ ] Job execution and result streaming
- [ ] Node reputation system based on job completion
- [ ] Multiple GPUs resource limit support (per-GPU sliders)

---

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores, 128 threads)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+

## Current Release
- **rhizos-node**: v1.3.0 (IPFS Integration)
- **Downloads**: http://155.117.46.228/downloads/

## Planning Documents
- **IPFS-STORAGE.md**: Comprehensive plan for workspace-scoped distributed storage using private IPFS swarms
