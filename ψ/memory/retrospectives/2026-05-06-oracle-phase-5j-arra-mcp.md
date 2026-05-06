# Oracle Phase 5J — Arra MCP Connection — 2026-05-06

## What we worked on
Fixed the `oracle-v2` / Arra Oracle connection for Moshe's Oracle OS. Root cause: Arra Oracle starts a REST/OpenAPI HTTP server, not a direct MCP SSE endpoint. Direct MCP HTTP clients failed because they expected `text/event-stream`.

## Key decisions
- Use a local stdio MCP adapter instead of treating Arra REST as an MCP SSE endpoint.
- Keep the adapter read-only and allowlisted: `health`, `search`, `oracles`.
- Configure Hermes with no-secret `mcp_servers.arra_oracle` using `node` and the adapter path.
- Keep Arra autostart local-only through `ARRA_ORACLE_AUTOSTART=true` and `ORACLE_V2_URL=http://127.0.0.1:47778`.

## Verification
- `npm run build` passed and generated Phase 5J snapshot.
- `npm test` passed, 23/23.
- JSON assertions passed: `phase5J.status = connected`, tools include `health`, `search`, `oracles`, Hermes config detected.
- `mcporter` stdio listed 3 tools successfully.
- Local API smoke passed for Oracle endpoints.
- Browser smoke showed Phase 5J label and Improve tab with 0 console errors.

## Next steps
- Restart Hermes so native MCP discovers `mcp_arra_oracle_*` tools.
- Phase 5K can wire consciousness loop reflections directly to semantic search output.
