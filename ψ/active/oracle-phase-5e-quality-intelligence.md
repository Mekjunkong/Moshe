# Oracle Phase 5E — Quality Intelligence Layer

Date: 2026-05-06
Branch: `oracle-phase-5e-quality-intelligence`

## Purpose

Phase 5E improves Oracle quality before more autonomy. It prevents generic or annoying reports by adding a taste filter, Wiro-first opportunity scoring, approval UX copy, and a safe executor pilot readiness signal.

## Scope

- Treat business ideas as hypotheses: `watch`, `test manually`, or `ignore` — not “approve”.
- Downrank generic AI SaaS ideas unless tied to a real Wiro/Mike observed fact.
- Add a quality rubric for evidence, fit, revenue potential, validation effort, and annoyance risk.
- Add a Wiro-first opportunity filter to anchor suggestions in tour/business operations.
- Improve approval UX with `Approve once`, `Draft only`, `Not useful`, and `Ask me later` decisions.
- Keep safe executor pilot as a readiness gate before recurring automation.

## Guardrails

- No customer contact.
- No public publish.
- No spending.
- No deploy/commit/push without scoped approval.
- No generic proactive business reports without observed Wiro/Mike evidence.

## Verification Plan

- `npm run build`
- `npm test`
- JSON assertions for `phase5E`
- Local API smoke for `/oracleLive.json`
- Browser smoke Improve tab and console check

## Next After 5E

- Run one safe executor pilot locally/admin.
- Persist one `not_useful`/`ask_later` approval decision to prove taste feedback loop.
- Only then consider a bounded safe_now cron pilot.
