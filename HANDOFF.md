# OtherThing (formerly RhizOS) - Handoff Document

**Last Updated**: 2026-01-10
**Status**: Workspace-scoped compute IMPLEMENTED

---

## Quick Resume

```bash
# Start everything for development
cd /mnt/d/modchain
pkill -f "tsx\|vite" 2>/dev/null  # Kill old processes

# Terminal 1: Orchestrator
cd /mnt/d/modchain/src/orchestrator && pnpm dev

# Terminal 2: Desktop UI
cd /mnt/d/modchain/src/desktop && pnpm dev
```

**URLs:**
- Desktop UI: http://localhost:1420
- Orchestrator API: http://localhost:8080

**Login:** Create account via Sign Up (username/password)

---

## Recent Changes (2026-01-10)

1. **Rebranded to "OtherThing"**
   - Login page: "OtherThing" with hint "Install RhizOS to unlock more features"
   - App header: "OtherThing"

2. **Auth system complete** - Username/password signup/login with bcrypt + sessions

---

## Completed: Workspace-Scoped Compute

### What Was Built

1. **WorkspaceManager Service** (`src/orchestrator/src/services/workspace-manager.ts`)
   - Full CRUD for workspaces stored in `workspaces.json`
   - Invite code generation and validation
   - Membership management (join, leave, roles)

2. **Workspace API Endpoints**
   - `POST /api/v1/workspaces` - Create workspace
   - `GET /api/v1/workspaces` - List user's workspaces (with node counts)
   - `GET /api/v1/workspaces/:id` - Get workspace details + nodes
   - `POST /api/v1/workspaces/join` - Join by invite code
   - `POST /api/v1/workspaces/:id/leave` - Leave workspace
   - `DELETE /api/v1/workspaces/:id` - Delete workspace (owner only)
   - `POST /api/v1/workspaces/:id/regenerate-invite` - New invite code
   - `GET /api/v1/workspaces/:id/nodes` - Get workspace's nodes

3. **NodeManager Workspace Support**
   - `nodeWorkspaces` map tracks node → workspace membership
   - `getNodesForWorkspace(workspaceId)` - Filter nodes by workspace
   - `addNodeToWorkspace()` / `removeNodeFromWorkspace()` - Runtime updates
   - `findNodeForJobInWorkspace()` - Job dispatch filtered by workspace
   - Nodes can send `workspace_ids` array on registration

4. **Workspace.tsx Rewrite**
   - Fully wired to API (no more localStorage)
   - Create/Join/Leave/Delete workspaces
   - Shows real node counts per workspace
   - Invite code copy + regeneration
   - Member avatars with roles

### How Nodes Join Workspaces

Option 1: **Via API** (after node connects)
```javascript
nodeManager.addNodeToWorkspace(nodeId, workspaceId)
```

Option 2: **On Registration** (node sends workspace_ids)
```json
{
  "type": "register",
  "capabilities": {...},
  "workspace_ids": ["workspace-uuid-here"]
}
```

### Next Steps (Future)
- Add workspace selector to Node page in UI
- Let users pick which workspaces their node joins
- Job submission scoped to workspace

---

## Project Structure

```
/mnt/d/modchain/
├── HANDOFF.md                   # This file
├── users.json                   # User accounts (hashed passwords)
├── keys.json                    # Legacy invite keys
├── workspaces.json              # NEW: Workspace data
├── src/
│   ├── orchestrator/            # Backend API (Express + TypeScript)
│   │   └── src/
│   │       ├── index.ts         # Main server + routes
│   │       ├── middleware/auth.ts
│   │       └── services/
│   │           ├── node-manager.ts    # Node pool management
│   │           ├── workspace-manager.ts # NEW: Workspace management
│   │           └── ...
│   ├── desktop/                 # Frontend (React + Vite)
│   │   └── src/
│   │       ├── App.tsx          # Main app (now "OtherThing")
│   │       └── pages/
│   │           ├── Login.tsx    # Login (now "OtherThing")
│   │           ├── Workspace.tsx # Workspace UI (needs API wiring)
│   │           └── FlowBuilder.tsx
│   └── node-agent/              # Rust compute node
└── docker/
```

---

## Key Files Modified

| File | What Changed |
|------|--------|
| `src/orchestrator/src/services/workspace-manager.ts` | NEW - Workspace CRUD + membership |
| `src/orchestrator/src/services/node-manager.ts` | Added workspace tracking + filtering |
| `src/orchestrator/src/index.ts` | Added workspace API routes |
| `src/desktop/src/pages/Workspace.tsx` | Rewrote to use API |
| `src/desktop/src/pages/Login.tsx` | Rebranded to OtherThing |
| `src/desktop/src/App.tsx` | Rebranded header to OtherThing |

---

## Tech Stack
- **Backend**: Express.js + TypeScript + tsx (hot reload)
- **Frontend**: React 18 + Vite + TypeScript
- **Node Agent**: Rust (Tauri for desktop)
- **Auth**: bcrypt passwords + session tokens
- **Storage**: JSON files (users.json, keys.json, workspaces.json)

---

## Notes
- Invite key login (`7480836b`) still works as legacy fallback
- Sessions are in-memory (restart clears them)
- The "Install RhizOS" hint is placeholder for future native app features
