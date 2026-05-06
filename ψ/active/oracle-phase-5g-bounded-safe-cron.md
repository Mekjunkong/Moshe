# Oracle Phase 5G — Bounded Safe_now Cron Controls

Date: 2026-05-06
Branch: `oracle-phase-5g-bounded-safe-cron`

## Purpose

Phase 5G turns Phase 5F readiness into a guarded pilot plan for one bounded `safe_now` cron. It does not schedule the recurring job automatically; it creates the control layer and evidence required before Mike enables it.

## Completed prerequisite

A signed-session safe executor pilot was run locally/admin:

- action: `queue-refresh-oracle-snapshot`
- result: completed
- evidence: persisted executor run ledger entry

## Scope

- Define a bounded 3-run `safe_now` cron pilot plan.
- Add preflight controls:
  - safe executor pilot completed
  - report quality gates pass
  - cron quality compliance pass/watch
  - no source-risk blockers
  - finite run budget
- Expose allowed/forbidden scope in the dashboard.
- Keep public/customer/deploy/commit/push/delete/spend/contact forbidden.

## Safety

Phase 5G cannot recurse into creating more cron jobs. It is a draft/readiness layer unless Mike explicitly enables the pilot.

## Verification

- `npm run build`
- `npm test`
- JSON assertions for `phase5G`
- API smoke for all Oracle endpoints
- Browser smoke Improve tab + console check

## Next

If all controls pass, Mike can enable one 3-run safe_now pilot. After that, Phase 5H can evaluate pilot outcomes and decide whether the Oracle is ready for always-on bounded autonomy.
