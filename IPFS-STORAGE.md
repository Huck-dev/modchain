# IPFS Storage Implementation Plan

**Status**: Planning Phase
**Last Updated**: January 12, 2026

## Overview

This document outlines the implementation plan for workspace-scoped distributed storage using IPFS. The goal is to allow nodes to share disk space within workspaces while maintaining isolation between workspaces.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACE "Alpha Team"                         │
│  ┌───────────────┐      ┌───────────────┐      ┌───────────────┐       │
│  │   Node A      │      │   Node B      │      │   Node C      │       │
│  │ ┌───────────┐ │      │ ┌───────────┐ │      │ ┌───────────┐ │       │
│  │ │ IPFS Node │◄├──────┼─┤ IPFS Node │◄├──────┼─┤ IPFS Node │ │       │
│  │ │ (Private) │ │      │ │ (Private) │ │      │ │ (Private) │ │       │
│  │ └───────────┘ │      │ └───────────┘ │      │ └───────────┘ │       │
│  │ D:\storage\   │      │ /mnt/data/    │      │ E:\share\     │       │
│  └───────────────┘      └───────────────┘      └───────────────┘       │
│                              ▲                                          │
│                              │ Swarm Key: ws-alpha-xxx                  │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │    Orchestrator     │
                    │  (Key Distribution) │
                    └─────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────┐
│                              │ Swarm Key: ws-beta-yyy                   │
│                           WORKSPACE "Beta Corp"                          │
│  ┌───────────────┐      ┌───────────────┐                               │
│  │   Node X      │      │   Node Y      │     (Completely isolated)     │
│  │ ┌───────────┐ │      │ ┌───────────┐ │                               │
│  │ │ IPFS Node │◄├──────┼─┤ IPFS Node │ │                               │
│  │ └───────────┘ │      │ └───────────┘ │                               │
│  └───────────────┘      └───────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Private IPFS Swarms
- Each workspace gets a unique **swarm key** (32-byte random key)
- Nodes with the same swarm key can only connect to each other
- Content is completely isolated between workspaces
- No data leaks to the public IPFS network

### 2. Drive Selection (Completed)
- Users select which drive/partition to use for storage
- Storage slider controls how much of that drive to share
- Path is saved in node config and sent to orchestrator

### 3. Storage Directory Structure
```
<selected_drive>/
└── otherthing-storage/
    ├── ipfs/                    # IPFS repo
    │   ├── blocks/              # Content-addressed blocks
    │   ├── datastore/           # Metadata
    │   └── config               # IPFS config
    ├── workspace-<id>/          # Per-workspace scratch space
    │   ├── cache/               # Downloaded artifacts
    │   └── working/             # Active job scratch
    └── node-config.json         # Node configuration
```

## Implementation Phases

### Phase 1: Drive Selection ✅ COMPLETED
- [x] Add `getDrives()` to hardware.ts
- [x] Add `storagePath` to node config
- [x] Add drive selector dropdown to UI
- [x] Save/load selected drive
- [x] Update storage slider max based on selected drive
- [x] Send storage path to orchestrator

### Phase 2: IPFS Integration (Node App)
**Estimated Complexity**: Medium-High

#### 2.1 Bundle IPFS Binary
- [ ] Download kubo (Go-IPFS) binaries for Windows/Linux
- [ ] Add to electron-builder extraResources
- [ ] Create IPFS manager class in node app

```typescript
// src/ipfs-manager.ts
export class IPFSManager {
  private process: ChildProcess | null = null;
  private repoPath: string;
  private swarmKey: string | null = null;

  constructor(storagePath: string) {
    this.repoPath = path.join(storagePath, 'otherthing-storage', 'ipfs');
  }

  async init(): Promise<void> {
    // Initialize IPFS repo if not exists
  }

  async setSwarmKey(key: string): Promise<void> {
    // Write swarm.key file to repo
  }

  async start(): Promise<void> {
    // Start IPFS daemon with private network flag
  }

  async stop(): Promise<void> {
    // Gracefully stop IPFS daemon
  }

  async pin(cid: string): Promise<void> {
    // Pin content from workspace
  }

  async add(filePath: string): Promise<string> {
    // Add file and return CID
  }

  async get(cid: string, outputPath: string): Promise<void> {
    // Retrieve content by CID
  }
}
```

#### 2.2 IPFS Binary Sources
- **Windows**: `https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_windows-amd64.zip`
- **Linux**: `https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz`
- Binary size: ~50MB compressed

#### 2.3 electron-builder Config Addition
```json
{
  "extraResources": [
    {
      "from": "ipfs-bin/${os}",
      "to": "ipfs",
      "filter": ["**/*"]
    }
  ]
}
```

### Phase 3: Orchestrator Changes

#### 3.1 Swarm Key Management
- [ ] Generate swarm key per workspace on creation
- [ ] Store swarm key in workspace data
- [ ] Send swarm key to nodes when they join workspace

```typescript
// orchestrator/src/services/workspace-manager.ts
interface Workspace {
  id: string;
  name: string;
  ipfs_swarm_key: string;  // 32-byte hex string
  // ...
}

function generateSwarmKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

#### 3.2 WebSocket Protocol Additions

**Orchestrator → Node: Workspace Joined**
```json
{
  "type": "workspace_joined",
  "workspace_id": "ws-123",
  "ipfs_swarm_key": "a1b2c3d4...",
  "bootstrap_peers": [
    "/ip4/192.168.1.10/tcp/4001/p2p/QmNode1",
    "/ip4/192.168.1.20/tcp/4001/p2p/QmNode2"
  ]
}
```

**Node → Orchestrator: IPFS Ready**
```json
{
  "type": "ipfs_ready",
  "peer_id": "QmNodeABC123",
  "addresses": [
    "/ip4/192.168.1.5/tcp/4001",
    "/ip4/192.168.1.5/udp/4001/quic"
  ]
}
```

#### 3.3 Bootstrap Peer Tracking
- [ ] Track IPFS peer IDs for each connected node
- [ ] Provide bootstrap peers when node joins workspace
- [ ] Handle peer discovery within workspace

### Phase 4: Content Operations

#### 4.1 File Operations API
```typescript
// Node endpoints (local HTTP API)
POST /storage/upload     // Upload file, get CID
GET  /storage/:cid       // Download by CID
POST /storage/pin        // Pin CID from network
DELETE /storage/:cid     // Unpin and garbage collect
GET  /storage/stats      // Storage usage stats
```

#### 4.2 Workspace Content Sync
- When node joins workspace, receive list of pinned CIDs
- Optionally pre-fetch commonly used content (models, datasets)
- Garbage collection for unpinned content

### Phase 5: Dashboard Integration

#### 5.1 Storage Tab in Workspace Detail
- [ ] Show total storage across workspace nodes
- [ ] List pinned content with sizes
- [ ] Upload/download files
- [ ] Storage usage visualization

#### 5.2 Node Storage View
- [ ] Per-node storage breakdown
- [ ] Pinned content list
- [ ] Manual pin/unpin controls

## Security Considerations

### Swarm Key Security
- Swarm keys are transmitted over WebSocket (should use WSS in production)
- Keys stored in memory on node, not persisted to disk
- Key rotation mechanism for compromised workspaces

### Content Isolation
- Private swarm prevents external access
- No DHT announcements to public network
- Bootstrap only within workspace peers

### Resource Limits
- Storage quota enforced by IPFS repo size limit
- Bandwidth limits for IPFS operations
- CPU limits for IPFS daemon

## Technical Decisions

### Why Kubo (Go-IPFS) vs js-ipfs?
| Aspect | Kubo | js-ipfs |
|--------|------|---------|
| Performance | Excellent | Good |
| Memory | ~100MB | ~200MB |
| Binary size | ~50MB | 0 (bundled) |
| Stability | Battle-tested | Some edge cases |
| Features | Full | Most features |

**Decision**: Use Kubo for production reliability. Bundle as external binary.

### Why Not IPFS Cluster?
- Adds complexity (separate daemon)
- Our use case is simpler (private swarms per workspace)
- Orchestrator already handles coordination

### Storage Path Options
| Option | Pros | Cons |
|--------|------|------|
| User-selected drive | User control, can use fast drive | Must handle path validation |
| App data folder | Simple, always exists | May be on small system drive |
| Dedicated partition | True isolation | Complex setup |

**Decision**: User-selected drive with validation. Fallback to app data.

## File Size Estimates

### Node App Size Impact
- Current installer: ~73MB (Windows), ~100MB (Linux)
- With IPFS binary: ~120MB (Windows), ~150MB (Linux)
- Acceptable increase for functionality gained

### Storage Overhead
- IPFS repo base: ~50MB
- Per-file overhead: ~1-5% (for small files), <0.1% (for large files)
- Datastore indexes: scales with file count

## API Reference

### New IPC Handlers (main.ts)
```typescript
// IPFS Operations
ipcMain.handle('ipfs-start', async () => { ... });
ipcMain.handle('ipfs-stop', async () => { ... });
ipcMain.handle('ipfs-status', async () => { ... });
ipcMain.handle('ipfs-add', async (_, filePath) => { ... });
ipcMain.handle('ipfs-get', async (_, cid, outputPath) => { ... });
ipcMain.handle('ipfs-pin', async (_, cid) => { ... });
ipcMain.handle('ipfs-unpin', async (_, cid) => { ... });
ipcMain.handle('ipfs-stats', async () => { ... });
```

### New WebSocket Messages
| Direction | Type | Purpose |
|-----------|------|---------|
| O→N | `workspace_joined` | Send swarm key + bootstrap peers |
| N→O | `ipfs_ready` | Node's IPFS peer ID and addresses |
| O→N | `pin_content` | Request node to pin CID |
| N→O | `content_pinned` | Confirm content pinned |
| O→N | `bootstrap_update` | New peer joined workspace |

## Testing Plan

### Unit Tests
- [ ] Drive detection on Windows/Linux
- [ ] IPFS manager init/start/stop
- [ ] Swarm key generation/validation

### Integration Tests
- [ ] Two nodes in same workspace can share content
- [ ] Nodes in different workspaces cannot access each other's content
- [ ] Content persists across node restart

### Manual Tests
- [ ] Install on fresh Windows machine
- [ ] Install on fresh Linux machine
- [ ] Multi-workspace node behavior
- [ ] Storage quota enforcement

## Rollout Plan

1. **Alpha**: Internal testing with 2-3 nodes
2. **Beta**: Limited release to trusted users
3. **GA**: Full release with documentation

## Open Questions

1. **Multi-workspace nodes**: How to handle a node in 2+ workspaces?
   - Option A: Separate IPFS instances (more isolation, more resources)
   - Option B: Single IPFS with content tagging (efficient, less isolation)
   - **Recommendation**: Start with Option A, optimize later

2. **Large file handling**: Chunking strategy for files > 1GB?
   - IPFS handles this automatically (256KB chunks)
   - May need custom logic for very large files (100GB+)

3. **Offline sync**: What happens when node goes offline?
   - Content remains on other nodes
   - Orchestrator tracks which nodes have which content
   - Re-pin on reconnect if content lost

## Dependencies

### NPM Packages (already installed)
- `systeminformation` - Hardware/drive detection

### New Dependencies Needed
- None for Phase 2 (shell out to IPFS binary)
- Consider `ipfs-http-client` for Phase 4 HTTP API

### External Binaries
- Kubo v0.24.0+ (Windows x64, Linux x64)

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | ✅ Done | - |
| Phase 2 | 2-3 days | IPFS binaries |
| Phase 3 | 1-2 days | Phase 2 |
| Phase 4 | 2-3 days | Phase 3 |
| Phase 5 | 1-2 days | Phase 4 |

**Total**: ~7-10 days of focused work

## References

- [IPFS Private Networks](https://github.com/ipfs/kubo/blob/master/docs/experimental-features.md#private-networks)
- [Kubo Downloads](https://dist.ipfs.tech/#kubo)
- [IPFS Swarm Key Generator](https://github.com/Kubuxu/go-ipfs-swarm-key-gen)
- [electron-builder extraResources](https://www.electron.build/configuration/contents#extraresources)
