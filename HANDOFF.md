# OtherThing/RhizOS Cloud - Handoff Document
**Last Updated**: January 12, 2026 (Session 3 - IPFS Phase 3 COMPLETE)

## Project Overview
**OtherThing** is a workspace-scoped distributed compute platform. Users create workspaces, invite team members, contribute compute resources via native node applications, share API keys, and build/run AI flows collaboratively.

## Production Server
- **URL**: http://155.117.46.228
- **SSH**: administrator@155.117.46.228
- **SSH Key Passphrase**: `Leonidas12!`
- **Sudo Password**: `bAttlezone12a!`
- **Systemd Services**: `nginx`, `otherthing`

## Git Repositories
| Repo | URL | Visibility | Purpose |
|------|-----|------------|---------|
| rhizos-cloud | https://github.com/Huck-dev/rhizos-cloud | Public | Main repo (orchestrator, web dashboard, node source) |
| rhizos-node | https://github.com/Huck-dev/rhizos-node | Public (temp) | Node app releases/installers |

---

## IMMEDIATE NEXT STEP

**Deploy orchestrator Phase 3 changes to server:**
```bash
# SSH to server and pull + restart
ssh administrator@155.117.46.228
# Enter passphrase: Leonidas12!
cd /opt/rhizos-cloud
echo 'bAttlezone12a!' | sudo -S git pull
echo 'bAttlezone12a!' | sudo -S systemctl restart otherthing
echo 'bAttlezone12a!' | sudo -S systemctl status otherthing
```

The orchestrator code is committed and pushed (commit f1483bb) but NOT yet deployed.

---

## Session 3 Completions

### IPFS Phase 3 - Orchestrator Changes (COMMITTED, NOT DEPLOYED)

**Files Modified:**
1. `src/orchestrator/src/types/index.ts`
   - Added `ipfsPeerId`, `ipfsAddresses`, `ipfsReady` to ConnectedNode interface
   - Added `ipfs_ready` to NodeMessageSchema
   - Added `WorkspaceJoinedMessage` and `IPFSReadyMessage` interfaces

2. `src/orchestrator/src/services/workspace-manager.ts`
   - Added `ipfsSwarmKey` field to Workspace interface
   - Added `generateSwarmKey()` method (32 random bytes -> hex)
   - Updated `createWorkspace()` to generate swarm key
   - Added `getWorkspaceSwarmKey()` with lazy generation for existing workspaces
   - Added `getWorkspaceIPFSInfo()` method

3. `src/orchestrator/src/services/node-manager.ts`
   - Added `workspaceManager` reference field
   - Added `setWorkspaceManager()` method
   - Added `handleIPFSReady()` to track node IPFS status
   - Updated `addNodeToWorkspaceByShareKey()` to send workspace_joined
   - Added `sendWorkspaceJoinedMessage()` method
   - Added `getBootstrapPeers()` method for peer discovery

4. `src/orchestrator/src/index.ts`
   - Added `nodeManager.setWorkspaceManager(workspaceManager)` wiring

### Previous Completions (This Session)

1. **IPFS Integration (Phase 2) - Node App** ✅
   - Bundled kubo v0.24.0 binaries (Win: 67MB, Linux: 87MB)
   - Created IPFSManager class with full lifecycle management
   - Private network mode for workspace isolation
   - IPFS Storage card in UI with Start/Stop controls
   - Handle workspace_joined message with swarm key
   - Auto-connect to bootstrap peers
   - Send ipfs_ready with peer ID and addresses

2. **Drive Selector (Phase 1)** ✅
   - Added `getDrives()` to hardware.ts
   - Drive selector dropdown in Resource Limits UI
   - Storage path persisted and sent to orchestrator

3. **Release v1.3.0** ✅
   - Windows installer: 99MB
   - Linux AppImage: 137MB
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
│   │       ├── index.ts         # API endpoints + service wiring
│   │       ├── types/index.ts   # TypeScript types + Zod schemas
│   │       └── services/
│   │           ├── workspace-manager.ts  # Workspaces, flows, API keys, IPFS swarm keys
│   │           ├── node-manager.ts       # Node connections, IPFS peer tracking
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

### IPFS Messages (Phase 3) - NOW IMPLEMENTED

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

## Build & Deploy Commands

### Build Node App
```bash
cd /mnt/d/modchain/src/node-electron
npm run dist:win    # Output: release/OtherThing-Node-Setup.exe
npm run dist:linux  # Output: release/OtherThing-Node.AppImage
```

### Deploy Orchestrator (NEEDS TO BE RUN)
```bash
ssh administrator@155.117.46.228
# Passphrase: Leonidas12!
cd /opt/rhizos-cloud
echo 'bAttlezone12a!' | sudo -S git pull
echo 'bAttlezone12a!' | sudo -S systemctl restart otherthing nginx
```

### Create GitHub Release
```bash
cd /tmp/rhizos-node
gh release create v1.4.0 \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe" \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node.AppImage" \
  --title "v1.4.0" --notes "Release notes"
```

### Update Server Downloads
```bash
ssh administrator@155.117.46.228
cd /usr/share/nginx/html/downloads
echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node-Setup.exe 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.4.0/OtherThing-Node-Setup.exe'
echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node.AppImage 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.4.0/OtherThing-Node.AppImage'
```

---

## Remaining TODOs

### IPFS Integration
- [x] Bundle kubo binary in electron app (v1.3.0)
- [x] Workspace swarm key management in orchestrator (Phase 3) - COMMITTED
- [ ] **DEPLOY Phase 3 to server** ← IMMEDIATE NEXT STEP
- [ ] Content operations API (Phase 4)
- [ ] Dashboard storage tab (Phase 5)

### Other
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
