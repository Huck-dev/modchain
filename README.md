# RhizOS Cloud

**Decentralized compute network with MCP-powered hardware abstraction**

RhizOS is a peer-to-peer compute marketplace where users can rent GPU/CPU resources and providers can monetize idle hardware. Built on the Model Context Protocol (MCP) for hardware-agnostic execution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          RHIZOS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   Desktop    │    │  Orchestrator │    │  Node Agent  │     │
│   │   (Tauri)    │◄──►│  (TypeScript) │◄──►│    (Rust)    │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│                              │                    │              │
│                              │                    ▼              │
│                              │           ┌──────────────┐       │
│                              │           │ MCP Adapters │       │
│                              │           │ ┌──────────┐ │       │
│                              │           │ │  Docker  │ │       │
│                              │           │ │  CUDA    │ │       │
│                              │           │ │  WASM    │ │       │
│                              │           │ └──────────┘ │       │
│                              │           └──────────────┘       │
│                              ▼                                   │
│                     ┌──────────────┐                            │
│                     │   Modules    │ ◄── chain://<module_id>    │
│                     │  (Registry)  │                            │
│                     └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Language | Description |
|-----------|----------|-------------|
| **Orchestrator** | TypeScript | Job matching, payment escrow, node registry |
| **Node Agent** | Rust | Hardware detection, job execution, MCP adapters |
| **Desktop App** | Tauri + React | Cyberpunk UI for monitoring and control |
| **MCP Adapters** | TypeScript | Docker, CUDA, WASM execution backends |
| **Shared Schemas** | TypeScript | Zod schemas for type-safe APIs |

## Features

- **Hardware Agnostic**: MCP adapters abstract GPU/CPU differences
- **Payment Escrow**: USDC payments held until job completion
- **Module Registry**: Chain-based MCP module resolution
- **Real-time Monitoring**: Live stats, logs, and job tracking
- **Cross-platform**: Desktop installers for Windows/Linux

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Rust (for node-agent)
- Docker (for job execution)

### Development

```bash
# Clone the repo
git clone https://github.com/Huck-dev/rhizos-cloud.git
cd rhizos-cloud

# Install dependencies
pnpm install

# Start orchestrator + dashboard
pnpm dev

# In another terminal, start node agent
cd src/node-agent
cargo run

# Or preview desktop app
cd src/desktop
pnpm dev
# Open http://localhost:1420
```

### Build Desktop App

```bash
# Install Tauri dependencies (Linux)
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Build installers
pnpm build:desktop
```

## Project Structure

```
rhizos-cloud/
├── src/
│   ├── orchestrator/      # Job matching & payment service
│   │   └── src/
│   │       ├── routes/    # REST API endpoints
│   │       ├── services/  # Business logic
│   │       └── db/        # SQLite with Drizzle ORM
│   │
│   ├── node-agent/        # Rust compute node
│   │   └── src/
│   │       ├── hardware.rs   # GPU/CPU detection
│   │       ├── executor.rs   # Job execution
│   │       └── mcp/          # MCP client
│   │
│   ├── desktop/           # Tauri desktop app
│   │   ├── src/           # React frontend
│   │   │   ├── pages/     # Dashboard, Modules, Settings
│   │   │   ├── components/
│   │   │   └── styles/    # Cyberpunk CSS
│   │   └── src-tauri/     # Rust backend
│   │
│   ├── mcp-adapters/      # Execution backends
│   │   └── src/
│   │       ├── docker.ts
│   │       ├── cuda.ts
│   │       └── wasm.ts
│   │
│   └── shared/
│       └── schemas/       # Zod type definitions
│
├── docs/
│   └── handoffs/          # Session documentation
│
└── package.json           # Workspace root
```

## API Endpoints

### Orchestrator (`localhost:3000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/accounts` | Create account |
| GET | `/api/v1/accounts/:id` | Get account details |
| POST | `/api/v1/jobs` | Submit compute job |
| GET | `/api/v1/jobs/:id` | Get job status |
| POST | `/api/v1/jobs/:id/refund` | Request refund |
| POST | `/api/v1/nodes/register` | Register node |
| POST | `/api/v1/nodes/:id/heartbeat` | Node keepalive |

## Desktop Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Network stats, jobs, nodes |
| Deploy | `/deploy` | GPU selection & quick templates |
| Flow | `/flow` | Visual workflow builder |
| Modules | `/modules` | Browse MCP modules |
| Node | `/node` | Control local node agent |
| Settings | `/settings` | Configuration |

## Module System

Modules are MCP servers registered on-chain:

```
chain://mod-llama-inference    # LLaMA text generation
chain://mod-stable-diffusion   # Image generation
chain://mod-whisper            # Audio transcription
chain://mod-blender-render     # GPU rendering
chain://mod-ffmpeg             # Video transcoding
```

Resolution backends:
- Local JSON index (development)
- HTTP endpoint (staging)
- Substrate blockchain RPC (production)

## Payment Flow

```
1. User submits job with max_cost_cents
2. Orchestrator creates escrow hold
3. Job dispatched to matching node
4. Node executes via MCP adapter
5. On success: escrow released to node (minus 5% fee)
6. On failure: escrow refunded to user
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, React Router
- **Desktop**: Tauri 2.x (Rust)
- **Backend**: Hono, Drizzle ORM, SQLite
- **Node Agent**: Rust, Tokio, Bollard (Docker)
- **Styling**: Custom cyberpunk CSS with animations

## Configuration

### Node Agent (`config.toml`)

```toml
[orchestrator]
url = "http://localhost:3000"

[pricing]
gpu_hour_cents = 50
cpu_hour_cents = 2
memory_gb_hour_cents = 1

[limits]
max_concurrent_jobs = 4
max_memory_mb = 32768
```

### Desktop Settings

Stored in platform config directory:
- Linux: `~/.config/rhizos/settings.json`
- Windows: `%APPDATA%/rhizos/settings.json`

## Development Status

| Component | Status |
|-----------|--------|
| Orchestrator API | Complete |
| Node Agent | Complete |
| Desktop UI | Complete |
| MCP Adapters | Complete |
| Payment System | Complete |
| Module Registry | Mock data |
| Chain Integration | Planned |

## Related Projects

- [modc2](https://github.com/modc2) - Compute marketplace ecosystem
- [commune-ai](https://github.com/commune-ai) - AI module library
- [MCP Specification](https://modelcontextprotocol.io/) - Model Context Protocol

## License

MIT

---

Built by [Huck-dev](https://github.com/Huck-dev)
