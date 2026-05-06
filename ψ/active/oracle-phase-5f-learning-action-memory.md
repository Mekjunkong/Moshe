# Oracle Phase 5F — Learning Action Memory

Date: 2026-05-06
Branch: `oracle-phase-5f-learning-action-memory`

## Purpose

Phase 5F turns Phase 5E quality/taste rules into durable action memory and report quality gates before any recurring safe-now automation.

## Scope

- Derive learning-action rules from feedback, approval callbacks, executor runs, and Phase 5E taste filters.
- Gate proactive reports with explicit pass/watch/fail checks.
- Track safe executor pilot evidence before cron promotion.
- Check cron-quality compliance against Wiro-first and no-approval-framing rules.
- Keep top-phase as `watch` until safe pilot evidence and feedback/approval history are persisted.

## Safety Model

- Phase 5F does not execute external/customer-facing actions.
- It does not create recurring cron jobs automatically.
- It does not deploy or publish.
- It prepares the evidence layer required before a bounded `safe_now` cron pilot.

## Verification Plan

- `npm run build`
- `npm test`
- JSON assertions for `phase5F`
- Local API smoke for Oracle endpoints
- Browser smoke Improve and Terminal tabs

## Next After 5F

- Run one signed-session safe executor pilot.
- Persist one explicit feedback/approval decision.
- Deploy local prebuilt Phase 5F snapshot.
- Only then consider one bounded `safe_now` cron pilot.
