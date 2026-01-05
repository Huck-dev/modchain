# Modchain: Decentralized Hardware-Agnostic Compute Platform

## Vision

A platform where anyone can:
1. **Expose their hardware** - Install an app, contribute compute, get paid in crypto
2. **Consume compute** - Simple API, pay in crypto, no complex auth
3. **Trust the system** - Open source, transparent pricing, low margins

## The "Avatar Tail" Concept

The key innovation is using **MCP (Model Context Protocol) servers as hardware abstraction layers**.

Think of it like the neural link in Avatar - the MCP adapter is the "tail" that allows:
- A standardized job request to connect to ANY hardware
- Translation between what the user wants and what the hardware can do
- Different hardware types to speak the same language

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User/Client   │────▶│   Orchestrator  │────▶│   Node Agent    │
│   (API Call)    │     │   (Job Router)  │     │   (Hardware)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  MCP Adapter    │
                                                │  (The "Tail")   │
                                                └─────────────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                            ┌───────────┐       ┌───────────┐       ┌───────────┐
                            │  NVIDIA   │       │   AMD     │       │   CPU     │
                            │  (CUDA)   │       │  (ROCm)   │       │  (x86/ARM)│
                            └───────────┘       └───────────┘       └───────────┘
```

## Core Components

### 1. Node Agent (The Installable App)
- Runs on contributor machines
- Detects available hardware (GPUs, CPUs, RAM, storage)
- Registers with the orchestrator
- Receives and executes jobs via containers
- Reports job status and collects payment

### 2. Orchestrator (The Brain)
- Central coordination service (can be federated later)
- Receives job requests from clients
- Matches jobs to compatible nodes
- Handles payment escrow
- Monitors node health and reputation

### 3. Payment Layer
- Crypto payment processing (starting with stablecoins)
- Escrow for job completion
- Node payout management
- Transparent fee structure

### 4. MCP Adapters (The Magic)
- Hardware-specific adapters that normalize capabilities
- Job translation layers
- Capability advertisement
- Result standardization

## Technology Stack

- **Node Agent**: Rust or Go (for performance and easy distribution)
- **Orchestrator**: Node.js/TypeScript (fast iteration)
- **Containers**: Docker (universal runtime)
- **MCP**: TypeScript SDK
- **Crypto**: BTCPay Server or similar (self-hostable)
- **Communication**: gRPC + WebSocket

## Key Challenges to Solve

1. **Hardware Detection** - Reliable cross-platform GPU/CPU detection
2. **Job Sandboxing** - Secure container execution
3. **Payment Verification** - Proof that work was done
4. **Network Discovery** - How nodes find orchestrators
5. **Trust/Reputation** - Preventing bad actors

## MVP Scope

Phase 1: Basic container execution
- Node agent that detects hardware and registers
- Orchestrator that accepts jobs and routes them
- Simple crypto payment (manual verification first)
- Support for: Docker containers with exposed ports

Phase 2: MCP Integration
- MCP adapters for common workloads (LLM inference, image gen)
- Automatic capability matching
- Result verification

Phase 3: Decentralization
- Federated orchestrators
- On-chain payment verification
- Reputation system

---

*Project started: 2026-01-04*
*Last updated: 2026-01-04*
