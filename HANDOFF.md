# OtherThing/RhizOS Cloud - Handoff Document
**Last Updated**: January 16, 2026 (Session 4 - Repos Integration COMPLETE)

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
| on-bored | https://github.com/Huck-dev/on-bored | Public | Repo analysis CLI (cloned to `/opt/on-bored` on server) |

---

## Current State

### Repos Integration - COMPLETE

Workspaces now support adding GitHub repositories for analysis. The system clones repos and runs on-bored analysis to generate developer onboarding documentation.

**Features:**
- Add repos to workspaces via Repos tab
- Clone and analyze repos with on-bored CLI
- View analysis results: contributors, tech stack, security issues, code hotspots
- AI enhancement available via local Ollama or workspace GPU nodes

**API Endpoints:**
- `GET /api/v1/workspaces/:id/repos` - List repos
- `POST /api/v1/workspaces/:id/repos` - Add repo
- `GET /api/v1/workspaces/:id/repos/:repoId` - Get repo details
- `POST /api/v1/workspaces/:id/repos/:repoId/analyze` - Trigger analysis
- `DELETE /api/v1/workspaces/:id/repos/:repoId` - Delete repo

### IPFS Phases 1-4 COMPLETE

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Drive Selector | ✅ Deployed |
| 2 | IPFS Integration (Node App) | ✅ Deployed (v1.3.0) |
| 3 | Orchestrator Changes | ✅ Deployed |
| 4 | File Operations API | ✅ Committed (not built/released) |

### Next Steps

1. **Build new node app with Phase 4**:
```bash
cd /mnt/d/modchain/src/node-electron
npm run dist:win
npm run dist:linux
```

2. **Create v1.4.0 release**:
```bash
cd /tmp/rhizos-node
gh release create v1.4.0 \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node-Setup.exe" \
  "/mnt/d/modchain/src/node-electron/release/OtherThing-Node.AppImage" \
  --title "v1.4.0 - File Operations" --notes "IPFS file add/get/pin/unpin APIs"
```

3. **Update server downloads**:
```bash
ssh administrator@155.117.46.228
cd /usr/share/nginx/html/downloads
echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node-Setup.exe 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.4.0/OtherThing-Node-Setup.exe'
echo 'bAttlezone12a!' | sudo -S curl -L -o OtherThing-Node.AppImage 'https://github.com/Huck-dev/rhizos-node/releases/download/v1.4.0/OtherThing-Node.AppImage'
```

4. **Phase 5**: Dashboard storage tab (UI for file operations)

---

## Session 4 Summary

### Completed This Session

1. **Repos Integration** - Full workspace repo analysis
   - Added Repos tab to WorkspaceDetail with list/detail views
   - WorkspaceRepo interface and repos array in workspace data
   - CRUD API endpoints for repos
   - Analyze endpoint that clones repos and runs on-bored
   - AI routing to workspace GPU nodes or local Ollama
   - Deployed on-bored CLI to `/opt/on-bored` on server
   - Added `ON_BORED_CLI` env var to systemd service

2. **on-bored CLI Enhancements**
   - Added `--json` flag for programmatic JSON output
   - Added `--ollama-host` flag for remote Ollama instances
   - Suppressed progress logging in JSON mode

---

## Session 3 Summary

### Completed That Session

1. **IPFS Phase 2** - Node app IPFS integration
   - Bundled kubo v0.24.0 binaries
   - IPFSManager class with full lifecycle
   - Private network mode
   - IPFS Storage card in UI

2. **IPFS Phase 3** - Orchestrator changes
   - Swarm key generation per workspace
   - workspace_joined message with swarm key + bootstrap peers
   - ipfs_ready tracking per node
   - Bootstrap peer discovery

3. **IPFS Phase 4** - File operations API
   - `ipfs-add` - Add file by path
   - `ipfs-add-content` - Add content string
   - `ipfs-get` - Retrieve by CID
   - `ipfs-pin` - Pin content
   - `ipfs-unpin` - Unpin content

---

## Key Files

### Desktop App (`src/desktop/`)
| File | Purpose |
|------|---------|
| `src/pages/WorkspaceDetail.tsx` | Workspace UI with Repos tab |

### Orchestrator (`src/orchestrator/`)
| File | Purpose |
|------|---------|
| `src/index.ts` | API + service wiring, repos endpoints |
| `src/services/workspace-manager.ts` | Workspace + repo management |
| `src/services/node-manager.ts` | IPFS peer tracking |
| `src/types/index.ts` | Message types |

### Node App (`src/node-electron/`)
| File | Purpose |
|------|---------|
| `src/main.ts` | IPC handlers for IPFS operations |
| `src/node-service.ts` | IPFS methods wrapper |
| `src/ipfs-manager.ts` | Kubo daemon lifecycle |
| `src/preload.ts` | Exposed APIs to renderer |
| `src/hardware.ts` | Drive detection |
| `ipfs-bin/` | Bundled kubo binaries |

### on-bored (`/opt/on-bored` on server, `/home/huck/on-bored` local)
| File | Purpose |
|------|---------|
| `bin/cli.js` | Main CLI with --json and --ollama-host flags |
| `lib/generateHTML.js` | HTML report generator |

---

## Build Commands

```bash
# Desktop app
cd /mnt/d/modchain/src/desktop
pnpm build

# Node app
cd /mnt/d/modchain/src/node-electron
npm run dist:win    # Windows installer
npm run dist:linux  # Linux AppImage

# Orchestrator
cd /mnt/d/modchain/src/orchestrator
pnpm build
```

## Deploy Commands

```bash
# SSH to server
ssh administrator@155.117.46.228
# Passphrase: Leonidas12!

# Pull and restart orchestrator
cd /opt/rhizos-cloud
echo 'bAttlezone12a!' | sudo -S git pull
echo 'bAttlezone12a!' | sudo -S pnpm build --filter orchestrator
echo 'bAttlezone12a!' | sudo -S systemctl restart otherthing nginx

# Update on-bored
cd /opt/on-bored
echo 'bAttlezone12a!' | sudo -S git pull

# Check status
echo 'bAttlezone12a!' | sudo -S systemctl status otherthing --no-pager | head -15
```

---

## Remaining TODOs

### IPFS
- [x] Phase 1: Drive Selector
- [x] Phase 2: IPFS Integration (Node)
- [x] Phase 3: Orchestrator Changes
- [x] Phase 4: File Operations API
- [ ] **Build & release v1.4.0**
- [ ] Phase 5: Dashboard storage tab

### Repos
- [x] Repos tab UI
- [x] Repos API endpoints
- [x] on-bored integration
- [x] Deploy to production
- [ ] AI enhancement with workspace GPU nodes (infrastructure ready, needs Ollama on nodes)

### Other
- [ ] HTTPS (Let's Encrypt)
- [ ] Make rhizos-node repo private
- [ ] Token/cost tracking
- [ ] Job execution
- [ ] Node reputation system

---

## User's Hardware
- CPU: Ryzen Threadripper PRO 5995WX (64 cores)
- RAM: 256 GB
- GPUs: RTX 3070 (8GB), RTX 2060 SUPER (8GB)
- Storage: 15TB+

## Current Release
- **rhizos-node**: v1.3.0 (IPFS Integration)
- **Downloads**: http://155.117.46.228/downloads/
