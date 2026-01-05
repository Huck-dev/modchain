# Handoff Document #001: Project Initialization

**Date**: 2026-01-04
**Author**: Huck-dev
**Status**: In Progress

## What Was Done

1. Created project folder structure at `/mnt/d/modchain/`
2. Wrote PROJECT_OVERVIEW.md with vision and architecture
3. Defined the "Avatar Tail" MCP abstraction concept

## Project Structure

```
/mnt/d/modchain/
├── docs/
│   ├── handoffs/          # Handoff documents (you are here)
│   └── PROJECT_OVERVIEW.md
├── src/
│   ├── node-agent/        # The installable app
│   ├── orchestrator/      # Central coordination
│   ├── payment/           # Crypto payment layer
│   ├── mcp-adapters/      # Hardware abstraction layers
│   └── shared/            # Shared types and utilities
├── scripts/               # Build and deployment scripts
└── docker/                # Container definitions
```

## Key Architecture Decisions

### Decision 1: Start with Node Agent
**Rationale**: This is what users will install. Starting here lets us:
- Define the hardware detection interface
- Understand what capabilities we need to advertise
- Build something tangible quickly

### Decision 2: TypeScript for Orchestrator + MCP
**Rationale**:
- MCP SDK is TypeScript-native
- Fast iteration for MVP
- Easy to refactor later if needed

### Decision 3: Rust for Node Agent
**Rationale**:
- Single binary distribution (no runtime deps)
- Performance for hardware detection
- Cross-platform compilation
- Memory safety for security-critical code

### Decision 4: Capability-Based Routing (not translation)
**Rationale**:
- True CUDA→ROCm translation is unreliable
- Instead: jobs declare requirements, nodes declare capabilities
- MCP adapters handle the matching logic
- Future: can add translation layers for specific workloads

## Next Steps (for next session)

1. [ ] Initialize Rust project for node-agent
2. [ ] Implement hardware detection (list GPUs, CPUs, RAM)
3. [ ] Define capability schema (what a node can do)
4. [ ] Set up basic orchestrator with job queue
5. [ ] Create first MCP adapter (LLM inference)

## Open Questions

1. **Crypto payment processor**: BTCPay Server vs custom vs third-party?
2. **Node discovery**: Central registry vs DHT vs hybrid?
3. **Job format**: Docker Compose vs custom spec vs Kubernetes-style?

## Resources Needed

- GitHub repo (user mentioned "modchain" org)
- Consider: domain name, documentation site

## Notes

The user wants this to be a simple installable app. Priority is UX -
someone should be able to download, run, and start earning with minimal
configuration. Think "Folding@Home but you get paid in crypto".

---

*Next handoff should cover: Node Agent implementation details*
