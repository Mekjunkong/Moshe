# Oracle Phase 4 Autonomy Router — Implementation + Phase 5 Roadmap

## Phase 4 definition
Oracle is Phase 4 when every recommendation and executable API action is routed before action into exactly one lane:

- `safe_now`: read-only, reversible, internal, or private draft work. Moshe may execute within guardrails.
- `draft_only`: Moshe may prepare the asset, but must not publish, send, spend, deploy, commit/push, or contact anyone.
- `approval_required`: Mike approval required before execution. Includes customer-facing, public, paid, destructive, cleanup/delete, commit/push, deploy, outbound, or live workflow changes.

## Implemented scope

- Dashboard JSON data contract includes autonomy decisions, lane guardrails, and Phase 5 requirements.
- `scripts/generateOracleData.mjs` enriches approval queue items with `autonomyLevel`, `businessArea`, `riskReason`, `nextSafeStep`, and `approvalTrigger`.
- `/api/oracle/actions` exposes Phase 4 policy and classifies allowlisted actions.
- Approval-required API execution is blocked unless the request carries explicit `approvedByMike=true` plus signed session, same-origin, and `confirm=true`.
- Galaxy UI shows lane allowed/blocked work and per-action routing metadata.

## How to reach Phase 5

Phase 5 is not “more automation.” It is safe closed-loop operation:

1. **Feedback Ledger** — every proactive report/action gets scored as useful/noisy/stale/action-driving.
2. **Deployment Freshness Gap** — compare live production, local git HEAD, and snapshot age before recommending deploy.
3. **Repo Hygiene / Ship Readiness** — block deploy recommendations when unrelated dirty/untracked work is present.
4. **Evidence Chain Extractor** — convert retrospectives into structured proof: build, tests, smoke, endpoints, commit, deploy.
5. **Safe Executor Loop** — only `safe_now` actions can run automatically, with audit log, rollback notes, and bounded tool budgets.
6. **Approval Inbox** — Mike sees approval-required items with approve/reject/defer state; Oracle learns from the decision.
7. **Business Value Scoring** — link outputs to `wiro_growth`, `deploy_reliability`, `business_opportunity`, `memory_continuity`, or `decision_load_reduction`.

## Phase 5 readiness gate

Oracle can be considered top-phase only when:

- 7 consecutive autonomous runs finish without tool-call ceiling failures.
- No secrets are exposed in generated JSON, logs, memory, or UI.
- Every live action has autonomy metadata and audit entries.
- Every deployment recommendation includes an evidence chain and freshness check.
- Mike feedback is captured and changes future prioritization.
