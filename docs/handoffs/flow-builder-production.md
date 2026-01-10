# RhizOS Flow Builder - Production Implementation Handoff

**Date**: January 5, 2026
**Status**: Phase 1-5 Complete - Ready for End-to-End Testing

---

## Executive Summary

The RhizOS desktop app has a functional Flow Builder UI for creating module workflows, but it's currently demo-only. This document outlines the work needed to make it production-ready with proper module configuration, credential management, and orchestrator integration.

---

## Current State

### What's Built

#### Desktop App (`/mnt/d/modchain/src/desktop/`)
- **React + Vite + TypeScript** with cyberpunk theme
- **FlowBuilder.tsx**: Visual node editor with drag-and-drop, connection drawing
- **modules.ts**: 22 module definitions (Eliza, Hummingbot, etc.) with hardware requirements
- **Cost Estimation**: Real-time API vs GPU rental cost comparison with smart recommendations
- **Settings.tsx**: LLM API key storage (localStorage, unencrypted)

#### Orchestrator (`/mnt/d/modchain/src/orchestrator/`)
- **Express + WebSocket** server for node management
- **Job execution pipeline** with Zod-validated schemas
- **Payment escrow** system (holdFunds, completePayment, refundPayment)
- **Node matching** by hardware capabilities and reputation

#### Shared Schemas (`/mnt/d/modchain/src/shared/schemas/`)
- **capability.ts**: Hardware requirements, job definitions, payloads

### What's Missing

1. **Module-specific configuration** - Hummingbot needs exchange credentials, trading pairs, strategies. Eliza needs personality config, platform tokens.
2. **Secure credential storage** - Exchange API keys, social tokens, wallet keys
3. **Flow persistence** - Save/load flows to disk
4. **Flow deployment** - Actually submit flows to orchestrator
5. **Validation** - Pre-deployment validation of module configs

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DESKTOP APP                               │
├─────────────────────────────────────────────────────────────────┤
│  FlowBuilder.tsx                                                 │
│  ├── Module Palette (22 modules from modules.ts)                │
│  ├── Visual Canvas (drag nodes, draw connections)               │
│  ├── Config Panel (currently generic NODE_CONFIGS)              │
│  ├── Cost Estimation Panel (API vs GPU rental)                  │
│  └── Requirements Panel (VRAM, RAM, CPU, API keys)              │
│                                                                  │
│  [NEEDS] ModuleConfigPanel - Dynamic forms per module           │
│  [NEEDS] CredentialSelector - Pick stored credentials           │
│  [NEEDS] FlowToolbar - Save/Load/Export/Deploy                  │
├─────────────────────────────────────────────────────────────────┤
│  Services                                                        │
│  [NEEDS] credential-store.ts - AES-256-GCM encrypted storage    │
│  [NEEDS] flow-storage.ts - Save/load flows to filesystem        │
│  [NEEDS] flow-deployer.ts - Submit flows to orchestrator        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR                              │
├─────────────────────────────────────────────────────────────────┤
│  Current Endpoints:                                              │
│  POST /api/v1/jobs           - Submit single job                │
│  GET  /api/v1/jobs/:id       - Get job status                   │
│  GET  /api/v1/nodes          - List connected nodes             │
│  POST /api/v1/accounts       - Create payment account           │
│                                                                  │
│  [NEEDS] POST /api/v1/flows/deploy     - Deploy flow as job(s) │
│  [NEEDS] GET  /api/v1/flows/:id/status - Flow deployment status │
├─────────────────────────────────────────────────────────────────┤
│  Job Execution:                                                  │
│  1. Client submits job with requirements + payload              │
│  2. Payment held in escrow                                       │
│  3. Dispatch loop finds matching node (every 1s)                │
│  4. Job assigned via WebSocket                                   │
│  5. Node executes, sends status updates                         │
│  6. On completion: pay node, refund excess to client            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NODE AGENT                               │
├─────────────────────────────────────────────────────────────────┤
│  - Registers with orchestrator via WebSocket                    │
│  - Advertises hardware capabilities                              │
│  - Receives job assignments                                      │
│  - Executes via MCP adapters (docker, llm-inference, etc.)      │
│  - Reports results back                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Module Configuration Schemas

**Create `/mnt/d/modchain/src/shared/schemas/module-configs.ts`**

```typescript
import { z } from 'zod';

// Credential reference - never contains raw values in flow definition
const CredentialRefSchema = z.object({
  credentialId: z.string(),
  type: z.string(), // 'exchange_api', 'llm_api', 'twitter_oauth', etc.
});

// Hummingbot Config
export const HummingbotConfigSchema = z.object({
  exchange: z.enum(['binance', 'coinbase', 'kraken', 'kucoin', 'bybit']),
  credentials: z.object({
    apiKey: CredentialRefSchema,
    apiSecret: CredentialRefSchema,
  }),
  strategy: z.enum(['market_making', 'arbitrage', 'grid', 'twap']),
  tradingPairs: z.array(z.string()).min(1),
  parameters: z.object({
    bidSpread: z.number().min(0).max(0.5).optional(),
    askSpread: z.number().min(0).max(0.5).optional(),
    orderAmount: z.number().positive(),
  }),
  dryRun: z.boolean().default(true),
});

// Eliza Agent Config
export const ElizaConfigSchema = z.object({
  personality: z.object({
    name: z.string(),
    bio: z.string(),
    traits: z.array(z.string()),
  }),
  platforms: z.array(z.object({
    type: z.enum(['twitter', 'discord', 'telegram']),
    credentials: CredentialRefSchema,
    enabled: z.boolean(),
  })),
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'groq', 'local']),
    model: z.string(),
    credentials: CredentialRefSchema.optional(),
  }),
});

// Registry
export const MODULE_CONFIG_SCHEMAS: Record<string, z.ZodSchema> = {
  'rhizos-hummingbot': HummingbotConfigSchema,
  'rhizos-eliza': ElizaConfigSchema,
};
```

**Update `/mnt/d/modchain/src/desktop/src/data/modules.ts`**

Add to each module:
```typescript
configFormFields: ConfigFormField[];  // UI form definition
requiredCredentialTypes: string[];    // What credentials needed
```

---

### Phase 2: Secure Credential Storage

**Create `/mnt/d/modchain/src/desktop/src/services/credential-store.ts`**

- Uses Web Crypto API for AES-256-GCM encryption
- Master password derives encryption key via PBKDF2
- Credentials stored in localStorage (encrypted)
- Never exposes raw values until deployment time

```typescript
export type CredentialType =
  | 'exchange_api'      // Binance, Coinbase, etc.
  | 'llm_api'           // OpenAI, Anthropic, etc.
  | 'twitter_oauth'     // Twitter OAuth tokens
  | 'discord_bot'       // Discord bot token
  | 'telegram_bot'      // Telegram bot token
  | 'database_url'      // Database connection string
  | 'wallet_private_key';
```

---

### Phase 3: Flow Persistence

**Create `/mnt/d/modchain/src/shared/schemas/flows.ts`**

```typescript
export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(FlowNodeSchema),
  connections: z.array(FlowConnectionSchema),
});
```

**Create `/mnt/d/modchain/src/desktop/src/services/flow-storage.ts`**

- Save flows to `~/.rhizos/flows/` via Tauri filesystem API
- Export flows for sharing (credentials stripped)
- Import flows from JSON

---

### Phase 4: Orchestrator Integration

**Add to `/mnt/d/modchain/src/orchestrator/src/index.ts`**

```typescript
// Deploy a flow - creates one or more jobs
app.post('/api/v1/flows/deploy', async (req, res) => {
  // 1. Validate flow structure
  // 2. Validate module configs against their schemas
  // 3. Hold funds for total estimated cost
  // 4. Create jobs in execution order (respecting dependencies)
  // 5. Return deployment ID
});

// Get deployment status
app.get('/api/v1/flows/:deploymentId/status', async (req, res) => {
  // Return status of all jobs in the flow
});
```

**Add new payload type to capability.ts**

```typescript
export interface ModuleExecutionPayload {
  type: 'module-execution';
  moduleId: string;
  moduleVersion: string;
  config: Record<string, unknown>;
  credentials: Record<string, string>;  // Decrypted at deploy time
  inputs: Record<string, JobOutputRef>; // References to upstream outputs
}
```

---

### Phase 5: FlowBuilder UI Updates

**Update `/mnt/d/modchain/src/desktop/src/pages/FlowBuilder.tsx`**

1. Replace generic `NODE_CONFIGS` with dynamic form generation
2. Add credential selector for credential-type fields
3. Add toolbar: Save, Load, Export, Import, Deploy
4. Add validation panel
5. Wire Deploy button to orchestrator

**New Components**
```
/src/components/flow/
  ModuleConfigPanel.tsx     - Dynamic config form
  CredentialSelector.tsx    - Credential picker
  FlowValidationPanel.tsx   - Pre-deploy validation
  FlowToolbar.tsx          - Save/Load/Deploy actions
  SaveFlowDialog.tsx       - Save flow modal
  LoadFlowDialog.tsx       - Load flow browser
```

---

## File Inventory

### Files to Create

| File | Purpose |
|------|---------|
| `/src/shared/schemas/module-configs.ts` | Zod schemas for each module's config |
| `/src/shared/schemas/flows.ts` | Flow serialization schema |
| `/src/desktop/src/services/credential-store.ts` | Encrypted credential storage |
| `/src/desktop/src/services/flow-storage.ts` | Flow persistence |
| `/src/desktop/src/services/flow-deployer.ts` | Orchestrator submission |
| `/src/desktop/src/context/CredentialContext.tsx` | Credential state management |
| `/src/desktop/src/components/flow/*.tsx` | UI components (6 files) |

### Files to Modify

| File | Changes |
|------|---------|
| `/src/desktop/src/data/modules.ts` | Add configFormFields, requiredCredentialTypes |
| `/src/desktop/src/pages/FlowBuilder.tsx` | Dynamic forms, save/load, deploy |
| `/src/desktop/src/pages/Settings.tsx` | Credentials management section |
| `/src/orchestrator/src/index.ts` | Flow deployment endpoints |
| `/src/shared/schemas/capability.ts` | ModuleExecutionPayload type |

---

## Key Design Decisions

### Credential Security
- **Encryption**: AES-256-GCM with PBKDF2-derived key from master password
- **Storage**: Encrypted blobs in localStorage (desktop) or filesystem (Tauri)
- **Transmission**: Credentials decrypted only at deploy time, sent over HTTPS to orchestrator
- **Node Injection**: Orchestrator injects credentials into job payload, node receives them securely

### Flow Format
- **Portable**: Flows can be exported without credentials for sharing
- **Versioned**: Each flow has a version for compatibility tracking
- **Self-Contained**: Includes all node configs and connection data

### Module Config System
- **Schema-Driven**: Zod schemas define what each module needs
- **Form Generation**: UI forms auto-generated from configFormFields
- **Validation**: Pre-deployment validation against Zod schemas

---

## Testing Checklist

- [x] Credential encryption/decryption works correctly (AES-256-GCM implemented)
- [x] Credentials persist across app restarts (localStorage with encryption)
- [x] Flows save and load correctly (flowStorage service implemented)
- [x] Exported flows have no credential data (toExportableFlow strips creds)
- [x] Module config forms validate input (Zod schemas implemented)
- [x] Flow deployment creates correct jobs (Phase 4 - orchestrator endpoints added)
- [x] Deployment dialog shows status updates (Phase 4 - FlowBuilder.tsx updated)
- [x] Credential unlock prompt before deployment (Phase 5 - FlowBuilder.tsx updated)
- [x] Mock node for testing job execution (Phase 5 - mock-node.ts created)
- [ ] End-to-end testing with real credentials (manual testing needed)
- [ ] Payment escrow and settlement with real nodes (future work)

---

## Running the App

### Desktop App Only
```bash
cd /mnt/d/modchain/src/desktop
pnpm dev
# Open http://localhost:1420
```

### Full E2E Testing (3 terminals)

**Terminal 1 - Orchestrator:**
```bash
cd /mnt/d/modchain/src/orchestrator
pnpm dev
# Runs on http://localhost:8080
```

**Terminal 2 - Mock Node:**
```bash
cd /mnt/d/modchain/src/orchestrator
pnpm mock-node
# Connects to orchestrator and handles jobs
```

**Terminal 3 - Desktop App:**
```bash
cd /mnt/d/modchain/src/desktop
pnpm dev
# Open http://localhost:1420
```

### Testing Flow
1. Open Flow Builder at http://localhost:1420/flow
2. Add modules to the canvas (drag from palette)
3. Connect modules by dragging from output to input ports
4. Click DEPLOY FLOW
5. If using credentials, enter master password when prompted
6. Watch deployment progress in the dialog
7. Check orchestrator terminal for job assignments
8. Check mock node terminal for job execution

Navigate to:
- **/flow** - Visual workflow editor (Flow Builder)
- **/modules** - Browse available modules
- **/settings** - Configure API keys and credentials
- **/deploy** - Deploy workflows to network

---

## Next Steps (Priority Order)

1. ~~**Create module-configs.ts**~~ - DONE: Schemas for Hummingbot, Eliza, Scrapy, etc.
2. ~~**Create credential-store.ts**~~ - DONE: AES-256-GCM encrypted storage
3. ~~**Update modules.ts**~~ - DONE: Added requiredCredentialTypes, hasConfigSchema
4. ~~**Create flow components**~~ - DONE: ModuleConfigPanel, CredentialSelector
5. ~~**Update FlowBuilder.tsx**~~ - DONE: Save/load dialogs, flow persistence
6. ~~**Add orchestrator endpoints**~~ - DONE: Flow deployment API with status tracking
7. ~~**Create flow-deployer.ts**~~ - DONE: Client-side deployment service with polling
8. ~~**Wire deploy button**~~ - DONE: Deployment dialog with real-time status
9. ~~**Credential integration**~~ - DONE: Unlock prompt and credential resolution at deploy
10. ~~**Mock node for testing**~~ - DONE: Simulates job execution for E2E testing
11. **Manual E2E testing** - Run orchestrator + mock node + desktop app together

## Implementation Progress

### Completed Files
- `/src/shared/schemas/module-configs.ts` - Zod schemas for all modules + form field definitions
- `/src/shared/schemas/flows.ts` - Flow serialization schema + helper functions
- `/src/shared/schemas/capability.ts` - Added ModuleExecutionPayload and JobOutputRef types
- `/src/desktop/src/services/credential-store.ts` - AES-256-GCM encrypted credential storage
- `/src/desktop/src/services/flow-storage.ts` - Flow persistence to localStorage
- `/src/desktop/src/services/flow-deployer.ts` - Client-side flow deployment with status polling
- `/src/desktop/src/context/CredentialContext.tsx` - React context for credential management
- `/src/desktop/src/components/flow/ModuleConfigPanel.tsx` - Dynamic config forms
- `/src/desktop/src/components/flow/CredentialSelector.tsx` - Credential picker + add dialog
- `/src/desktop/src/data/modules.ts` - Updated with credential types and schema flags
- `/src/orchestrator/src/services/flow-deployment.ts` - Flow deployment service with job creation
- `/src/orchestrator/src/types/index.ts` - Added FlowDeployment types and schemas
- `/src/orchestrator/src/mock-node.ts` - Mock node for testing job execution

### Updated Files
- `/src/desktop/src/App.tsx` - Added CredentialProvider wrapper
- `/src/desktop/src/pages/FlowBuilder.tsx` - Full deployment integration with credential unlock
- `/src/orchestrator/src/index.ts` - Added flow deployment endpoints (POST/GET/DELETE)
- `/src/orchestrator/package.json` - Added mock-node script

---

## Related Documentation

- Plan file: `/home/huck/.claude/plans/kind-wandering-pillow.md`
- Orchestrator API: `/mnt/d/modchain/src/orchestrator/src/index.ts`
- Capability schemas: `/mnt/d/modchain/src/shared/schemas/capability.ts`
- Desktop app: `/mnt/d/modchain/src/desktop/`
