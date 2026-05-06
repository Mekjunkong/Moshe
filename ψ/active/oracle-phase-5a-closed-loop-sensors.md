# Oracle Phase 5A — Closed-Loop Sensors

## Scope
Phase 5A adds the first top-phase foundation: Oracle cannot just act; it must know signal quality, repo cleanliness, and live-vs-local deploy freshness before recommending safe execution.

## Implemented sensors

1. **Feedback Ledger**
   - Inputs: action audit entries, active cron jobs, recommendations, autonomy router decisions.
   - Fields: `source`, `businessArea`, `actionability`, `freshness`, `riskLevel`, `approvalRequired`, `mikeFeedback`, `valueSignal`.
   - Current feedback state is `unrated`; Phase 5B will persist Mike feedback.

2. **Repo Hygiene / Ship Readiness**
   - Inputs: git status for tracked repos.
   - Tracks changed files, untracked files, protected-file touches, and verdict: `clean`, `review`, `blocked`.
   - Blocks deploy recommendations when protected/large dirty state exists.

3. **Deployment Freshness Gap**
   - Inputs: Vercel deploy metadata + local git HEAD + worktree dirty state + snapshot age.
   - Verdict: `in_sync`, `review_before_ship`, `approval_required`, `unknown`.
   - Prevents treating “last deploy worked” as “current workspace is safe to ship.”

## Phase 5B path
- Persist Mike feedback from Telegram/dashboard.
- Build evidence-chain extraction from retrospectives.
- Add approval inbox states: approved/rejected/deferred/expired.
- Add safe executor queue for only `safe_now` actions.
- Suppress repeated noisy signals and rank by business value.
