# Oracle Phase 5H — Integration Roadmap

Date: 2026-05-06
Branch: `oracle-phase-5h-integration-roadmap`

## Missing Features Mike surfaced

1. **oracle-v2 MCP** — fix connection (`arra-oracle`)
2. **Oracle Studio Dashboard** — `bunx oracle-studio`
3. **maw-js** — multi-oracle fleet CLI
4. **Consciousness Loop** — autonomous thinking system

## Priority / Dependency Order

### 1. oracle-v2 MCP connection — Priority 1

Why first: Oracle Studio needs the oracle-v2 HTTP server, and the consciousness loop needs durable semantic memory/search.

Current known issue from `ψ/inbox/roadmap-oracle-features.md`:

- `bunx --bun arra-oracle@github:Soul-Brews-Studio/arra-oracle#main` fails
- Need clone/run-local debug before adding Hermes MCP config

Safe next step:

- diagnose `arra-oracle` locally
- identify install/runtime error
- fix or pin a known-good local command
- only then add MCP config with redacted/no-secret safety

### 2. Oracle Studio Dashboard — Priority 2

Depends on oracle-v2 HTTP server.

Target commands:

```bash
bun run server # expected port 47778
bunx oracle-studio # expected localhost:3000
```

Goal:

- real-time Oracle activity feed
- knowledge map
- search UI
- traces explorer

### 3. maw-js fleet CLI — Priority 3

Goal:

- multi-oracle messaging/fleet management
- command surface: `maw hey [oracle] "message"`

Known local knowledge exists at:

- `ψ/learn/Soul-Brews-Studio/maw-js/2026-04-19/`

### 4. Consciousness Loop — Priority 4

Long-term 7-step autonomous thinking system:

1. Reflect
2. Wonder
3. Soul
4. Dream
5. Aspire
6. Propose
7. Complete

Safety rule: this remains **draft/read-only/propose** until bounded safe_now pilots prove reliable. It must not publish, spend, contact customers, deploy, or recursively schedule jobs without Mike approval.

## Phase 5H Scope

Phase 5H does not install/fix all tools yet. It makes the roadmap visible and actionable inside Galaxy so the next engineering step is clear and dependency-aware.

## Next Real Engineering Step

Debug `arra-oracle` / oracle-v2 MCP locally.
