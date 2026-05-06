# Oracle Phase 5C — Autonomous Run-State Loop

Date: 2026-05-06
Branch: `oracle-phase-5c-autonomous-run-state`

## Purpose

Phase 5C moves Oracle from queued safe ideas to an auditable run-state loop:

- dashboard feedback buttons write to the persistent Mike feedback ledger
- safe executor run states persist as `started`, `completed`, `failed`, or `skipped`
- promotion gates decide which `safe_now` actions can graduate to bounded cron execution
- Telegram approval payloads are generated for risky scopes
- live smoke readiness explains whether Phase 5C is deployable

## Guardrails

- Executor endpoint only accepts allowlisted `safe_now` queue items.
- Signed Mike session + same-origin POST + `confirm=true` are required before a run.
- No public/customer-facing sends, deploys, pushes, deletes, spending, or cleanup can execute here.
- Approval-required scopes only become Telegram payload drafts; approval state mutation is a later step.
- Dirty repo hygiene keeps promotion candidates blocked.

## Files

- `galaxy/api/oracle/executor.js`
- `galaxy/api/oracle/auth.test.js`
- `galaxy/vite.config.ts`
- `galaxy/src/oracleData.ts`
- `galaxy/scripts/generateOracleData.mjs`
- `galaxy/src/OracleCommandCenter.tsx`
- `galaxy/public/oracleLive.json`

## Verification target

- `npm run build`
- `npm test`
- JSON asserts for `phase5C.phase`, feedback button wiring, executor endpoint, promotion candidates, Telegram approval payloads, and live smoke readiness
- Browser smoke: home loads, Improve tab renders, console has no JS errors
