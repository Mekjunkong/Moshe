import { useEffect, useState } from 'react'
import type { OracleData } from './oracleData'
import { ORACLE_FALLBACK_DATA } from './oracleData'
import './OracleCommandCenter.css'

interface Props {
  data: import('./types').GalaxyData
}

interface OracleActionManifestItem {
  id: string
  title: string
  description: string
  transport: string
  risk: string
  requiresConfirmation: boolean
}

interface OracleActionAuditEntry {
  id: string
  requestedAt: string
  actor: string
  actionId: string
  outcome: 'allowed' | 'denied' | 'preview' | string
  detail: string
}

interface OracleActionPreviewResponse {
  ok: boolean
  requestId?: string
  decision?: 'preview' | 'executed' | 'queued'
  message?: string
  error?: string
  nextStep?: string
  source?: 'live-api' | 'local-fallback'
  action?: OracleActionManifestItem
  policy?: OracleData['automation']
  session?: {
    actor: string
    expiresAt: string
  }
  auditTrail?: OracleActionAuditEntry[]
}

interface OracleSessionResponse {
  ok: boolean
  requestId?: string
  configured: boolean
  authenticated: boolean
  actor?: string | null
  expiresAt?: string | null
  message?: string
  error?: string
  policy?: OracleData['automation']
}

interface OracleTerminalResponse {
  ok: boolean
  requestId?: string
  command?: string
  cwd?: string
  exitCode?: number
  timedOut?: boolean
  durationMs?: number
  stdout?: string
  stderr?: string
  error?: string
  message?: string
  policy?: OracleData['terminal']
  recipes?: { label: string; command: string; cwd: string }[]
}


interface OracleFeedbackResponse {
  ok: boolean
  requestId?: string
  message?: string
  error?: string
  entry?: {
    id: string
    signalId: string
    rating: string
    note: string
    source: string
    actor: string
    createdAt: string
  }
}

interface OracleExecutorResponse {
  ok: boolean
  requestId?: string
  decision?: string
  error?: string
  message?: string
  run?: {
    id: string
    queueItemId: string
    actionId: string
    state: string
    summary: string
    rollbackNote: string
  }
}


interface OracleApprovalResponse {
  ok: boolean
  requestId?: string
  message?: string
  error?: string
  decision?: {
    id: string
    approvalInboxId: string
    decision: string
    actor: string
    source: string
    note: string
    createdAt: string
  }
}

interface OracleSessionState {
  status: 'loading' | 'ready' | 'authenticated' | 'error'
  message: string
  detail: string
  configured: boolean
  actor: string | null
  expiresAt: string | null
}

function useOracleLiveData(refreshNonce = 0): OracleData {
  const [d, setD] = useState<OracleData>(ORACLE_FALLBACK_DATA)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/oracleLive.json?ts=${Date.now()}&refresh=${refreshNonce}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<OracleData>
      })
      .then(setD)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          console.warn('Oracle live data unavailable; using fallback', err.message)
        }
      })
    return () => controller.abort()
  }, [refreshNonce])

  return d
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso || '—'
  const diff = Date.now() - then
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function isHttpUrl(url?: string) {
  return Boolean(url && /^https?:\/\//.test(url))
}

function timelineBadgeClass(state: string) {
  const s = state.toLowerCase()
  if (s === 'ready' || s === 'clean') return 'active'
  if (s === 'uncommitted-changes' || s === 'building' || s === 'ahead') return 'scheduled'
  if (s === 'error' || s === 'failed') return 'failed'
  return 'env-missing'
}

function syncBadgeClass(syncState?: string) {
  if (syncState === 'in-sync') return 'active'
  if (syncState === 'behind' || syncState === 'ahead') return 'scheduled'
  return 'env-missing'
}

const tabs = [
  { id: 'today', label: 'Today', alert: true },
  { id: 'intel', label: 'Intel', alert: true },
  { id: 'overview', label: 'Overview' },
  { id: 'wiro', label: 'Wiro' },
  { id: 'improve', label: 'Improve' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'sites', label: 'Sites' },
  { id: 'repos', label: 'Repos' },
  { id: 'sensors', label: 'Sensors' },
  { id: 'learnings', label: 'Learnings' },
] as const

export default function OracleCommandCenter({ data }: Props) {
  const [oracleRefreshNonce, setOracleRefreshNonce] = useState(0)
  const oracle = useOracleLiveData(oracleRefreshNonce)
  const [tab, setTab] = useState<'today' | 'intel' | 'overview' | 'wiro' | 'improve' | 'terminal' | 'sites' | 'repos' | 'sensors' | 'learnings'>('today')
  const [previewReason, setPreviewReason] = useState('Refresh the Oracle snapshot before any future action.')
  const [previewState, setPreviewState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    result: OracleActionPreviewResponse | null
    detail: string
  }>({
    status: 'idle',
    result: null,
    detail: '',
  })
  const [actionAuditTrail, setActionAuditTrail] = useState<OracleActionAuditEntry[]>([])
  const [sessionPassphrase, setSessionPassphrase] = useState('')
  const [sessionState, setSessionState] = useState<OracleSessionState>({
    status: 'loading',
    message: 'Checking session gate…',
    detail: 'The browser is checking whether a Mike-only signed cookie is already present.',
    configured: false,
    actor: null,
    expiresAt: null,
  })
  const [terminalCommand, setTerminalCommand] = useState('command -v codex && codex --version')
  const [terminalCwd, setTerminalCwd] = useState('/Users/pasuthunjunkong/workspace/Moshe')
  const [terminalState, setTerminalState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; result: OracleTerminalResponse | null }>({
    status: 'idle',
    result: null,
  })
  const [terminalRecipes, setTerminalRecipes] = useState<{ label: string; command: string; cwd: string }[]>([])
  const [terminalLivePolicy, setTerminalLivePolicy] = useState<OracleData['terminal'] | null>(null)
  const feedbackLoopNote =
    oracle.nextActions.find((item) => item.toLowerCase().includes('audit trail events into learnings'))
    ?? 'Audit trail events are being converted into reusable learnings.'
  const phase5A = oracle.phase5A ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5a' as const,
    summary: 'Phase 5A sensors are waiting for a live snapshot.',
    feedbackLedger: {
      updatedAt: oracle.generated,
      summary: 'No feedback ledger yet.',
      signals: [],
      counts: { useful: 0, noisy: 0, unrated: 0, highActionability: 0, approvalRequired: 0 },
      nextLearningStep: 'Generate a fresh Oracle snapshot.',
    },
    repoHygiene: {
      updatedAt: oracle.generated,
      verdict: 'review' as const,
      summary: 'No repo hygiene snapshot yet.',
      items: [],
    },
    deploymentFreshnessGap: {
      updatedAt: oracle.generated,
      verdict: 'unknown' as const,
      summary: 'No deployment freshness gap snapshot yet.',
      liveProject: 'unknown',
      snapshotAgeMinutes: 0,
      worktreeDirty: false,
      dirtyRepoCount: 0,
      recommendation: 'Generate a fresh Oracle snapshot.',
    },
    phase5BRequirements: [],
  }
  const phase5B = oracle.phase5B ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5b' as const,
    summary: 'Phase 5B feedback persistence and safe executor queue are waiting for a live snapshot.',
    feedbackPersistence: {
      endpoint: '/api/oracle/feedback',
      configured: false,
      pathLabel: 'not configured',
      entries: [],
      counts: { useful: 0, noisy: 0, missingContext: 0, actionTaken: 0, ignored: 0 },
      nextLearningStep: 'Generate a fresh Oracle snapshot.',
    },
    evidenceChains: [],
    safeExecutorQueue: [],
    approvalInbox: [],
    businessValueScores: [],
    guardrails: [],
    phase5CRequirements: [],
  }
  const phase5C = oracle.phase5C ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5c' as const,
    summary: 'Phase 5C autonomous run-state loop is waiting for a live snapshot.',
    feedbackButtons: { enabled: false, endpoint: '/api/oracle/feedback', ratings: [], status: 'preview' as const },
    executorRuns: {
      endpoint: '/api/oracle/executor',
      configured: false,
      pathLabel: 'not configured',
      runs: [],
      counts: { started: 0, completed: 0, failed: 0, skipped: 0 },
    },
    promotionCandidates: [],
    telegramApprovalPayloads: [],
    liveSmokeReadiness: { status: 'watch' as const, checks: [], nextStep: 'Generate a fresh Oracle snapshot.' },
    topPhaseRequirements: [],
  }
  const phase5D = oracle.phase5D ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5d' as const,
    summary: 'Phase 5D approval callback and cron-promotion gates are waiting for a live snapshot.',
    approvalCallbacks: {
      endpoint: '/api/oracle/approval',
      configured: false,
      pathLabel: 'not configured',
      decisions: [],
      counts: { approved: 0, rejected: 0, deferred: 0, expired: 0 },
    },
    cronPromotionPlans: [],
    repoHygieneClassifications: [],
    deploySmokeGates: [],
    topPhaseReadiness: { status: 'blocked' as const, blockers: [], watchItems: [], nextStep: 'Generate a fresh Oracle snapshot.' },
  }
  const phase5E = oracle.phase5E ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5e' as const,
    summary: 'Phase 5E quality intelligence is waiting for a live snapshot.',
    qualityRubric: { status: 'active' as const, minimumSendScore: 18, annoyanceLimit: 2, scores: [] },
    tasteFilters: { status: 'active' as const, rules: [], suppressedPhrases: [], lastCorrection: 'No correction loaded yet.' },
    wiroFirstOpportunityFilter: { status: 'active' as const, candidates: [], rule: 'Prefer Wiro-backed observed facts.' },
    approvalUx: { status: 'drafted' as const, template: 'What / Risk / Rollback / Why now', options: [] },
    safeExecutorPilot: { status: 'watch' as const, actionId: 'queue-refresh-oracle-snapshot', whySafe: 'Internal snapshot refresh only.', requiredBeforeTopPhase: [] },
    mikeNeedsNow: { status: 'quiet' as const, headline: 'Generate a fresh Oracle snapshot.', bullets: [] },
  }
  const phase5F = oracle.phase5F ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5f' as const,
    summary: 'Phase 5F learning action memory is waiting for a live snapshot.',
    learningActionMemory: { status: 'active' as const, rules: [], sourceCounts: { feedbackEntries: 0, approvalDecisions: 0, executorRuns: 0 } },
    reportQualityGates: [],
    safePilotEvidence: { actionId: 'queue-refresh-oracle-snapshot', status: 'missing' as const, evidence: 'No live snapshot generated yet.', nextStep: 'Generate a fresh Oracle snapshot.' },
    cronQualityCompliance: { status: 'watch' as const, checkedJobs: 0, notes: [] },
    topPhaseGate: { status: 'blocked' as const, blockers: ['Generate a fresh Oracle snapshot.'], watchItems: [], nextStep: 'Run npm run build.' },
  }
  const phase5G = oracle.phase5G ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5g' as const,
    summary: 'Phase 5G bounded safe cron pilot is waiting for a live snapshot.',
    safeCronPilot: { id: 'bounded-safe-now-refresh-pilot', status: 'draft_only' as const, schedule: 'manual only', actionId: 'queue-refresh-oracle-snapshot', maxRuns: 0, toolBudget: 'none', allowedScope: [], forbiddenScope: [], delivery: 'local' as const, rollback: 'Generate a fresh Oracle snapshot.' },
    preflightControls: [],
    evidence: { safeExecutorPilotCompleted: false, reportQualityGatesPassing: 0, reportQualityGatesTotal: 0, cronQualityStatus: 'watch' as const, sourceBlockers: [] },
    topPhaseGate: { status: 'blocked' as const, blockers: ['Generate a fresh Oracle snapshot.'], watchItems: [], nextStep: 'Run npm run build.' },
  }
  const phase5H = oracle.phase5H ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5h' as const,
    summary: 'Phase 5H integration roadmap is waiting for a live snapshot.',
    missingFeatureRoadmap: [],
    dependencyOrder: [],
    nextEngineeringStep: { id: 'none', title: 'Generate a fresh Oracle snapshot.', lane: 'safe_now' as const, reason: 'No roadmap snapshot exists yet.', commandHints: [] },
    guardrails: [],
  }
  const phase5I = oracle.phase5I ?? {
    updatedAt: oracle.generated,
    phase: 'phase_5i' as const,
    summary: 'Phase 5I Consciousness Loop is waiting for a live snapshot.',
    definition: 'Operational consciousness means bounded awareness and reflection, not human sentience.',
    operatingMode: 'bounded_consciousness_loop' as const,
    status: 'blocked' as const,
    loop: [],
    signals: [],
    boundaries: [],
    dailyReflection: { status: 'blocked' as const, prompt: 'Generate a fresh Oracle snapshot.', outputPath: 'ψ/memory/reflections/', maxFrequency: 'manual', delivery: 'local' as const },
    nextThought: { title: 'Generate a fresh Oracle snapshot.', lane: 'safe_now' as const, why: 'No consciousness snapshot exists yet.', safeAction: 'Run npm run build.' },
    topPhaseGate: { status: 'blocked' as const, blockers: ['Generate a fresh Oracle snapshot.'], watchItems: [], nextStep: 'Run npm run build.' },
  }
  const [feedbackState, setFeedbackState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; message: string }>({ status: 'idle', message: '' })
  const [executorState, setExecutorState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; message: string }>({ status: 'idle', message: '' })
  const [approvalState, setApprovalState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; message: string }>({ status: 'idle', message: '' })
  const phase5Badge = (value: string) => value === 'clean' || value === 'in_sync' || value === 'complete' || value === 'ready' || value === 'promote' || value === 'eligible' || value === 'completed' || value === 'pass' || value === 'wired' || value === 'approved' || value === 'scratch_only' || value === 'docs_only' || value === 'draft_ready' || value === 'live' ? 'low' : value === 'blocked' || value === 'approval_required' || value === 'missing' || value === 'suppress' || value === 'failed' || value === 'fail' || value === 'rejected' || value === 'source_change' || value === 'mixed' ? 'high' : 'medium'

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/oracle/session', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<OracleSessionResponse>)
      .then((payload) => {
        if (!payload.ok) throw new Error(payload.message ?? payload.error ?? 'Session check failed.')
        const authenticated = Boolean(payload.authenticated)
        setSessionState({
          status: authenticated ? 'authenticated' : 'ready',
          message: authenticated ? 'Signed session cookie unlocked.' : 'Session gate is closed.',
          detail: authenticated
            ? 'Execute mode is available to the currently signed-in Mike-only browser session.'
            : payload.configured
              ? 'Enter the Mike-only passphrase to mint a signed session cookie.'
              : 'Set ORACLE_SESSION_SECRET on the server to enable execute mode.',
          configured: payload.configured,
          actor: payload.actor ?? null,
          expiresAt: payload.expiresAt ?? null,
        })
      })
      .catch((error: Error) => {
        setSessionState({
          status: 'error',
          message: 'Session gate unavailable.',
          detail: error.message,
          configured: false,
          actor: null,
          expiresAt: null,
        })
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch(oracle.automation?.endpoint ?? '/api/oracle/actions', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<OracleActionPreviewResponse>)
      .then((payload) => {
        if (payload?.auditTrail) setActionAuditTrail(payload.auditTrail)
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') console.warn('Oracle action audit unavailable', error.message)
      })
    return () => controller.abort()
  }, [oracle.automation?.endpoint, oracleRefreshNonce])

  useEffect(() => {
    const controller = new AbortController()
    fetch(oracle.terminal?.endpoint ?? '/api/oracle/terminal', {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<OracleTerminalResponse>)
      .then((payload) => {
        if (payload?.recipes) setTerminalRecipes(payload.recipes)
        if (payload?.policy) setTerminalLivePolicy(payload.policy)
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') console.warn('Oracle terminal policy unavailable', error.message)
      })
    return () => controller.abort()
  }, [oracle.terminal?.endpoint, oracleRefreshNonce])

  const unlockSession = async () => {
    setSessionState((current) => ({
      ...current,
      status: 'loading',
      message: 'Unlocking session…',
      detail: 'Sending the passphrase to the server to mint an httpOnly signed cookie.',
    }))

    try {
      const response = await fetch('/api/oracle/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: sessionPassphrase }),
      })
      const payload = (await response.json().catch(() => null)) as OracleSessionResponse | null
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? payload?.error ?? `HTTP ${response.status}`)
      }

      setSessionPassphrase('')
      setSessionState({
        status: 'authenticated',
        message: payload.message ?? 'Session unlocked.',
        detail: 'Mike-only execute mode is now available in this browser session.',
        configured: payload.configured,
        actor: payload.actor ?? 'Mike',
        expiresAt: payload.expiresAt ?? null,
      })
    } catch (error) {
      setSessionState((current) => ({
        ...current,
        status: 'error',
        message: 'Failed to unlock session.',
        detail: error instanceof Error ? error.message : 'Unknown session error.',
      }))
    }
  }

  const lockSession = async () => {
    try {
      const response = await fetch('/api/oracle/session', {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response.json().catch(() => null)) as OracleSessionResponse | null
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? payload?.error ?? `HTTP ${response.status}`)
      }

      setSessionPassphrase('')
      setSessionState({
        status: 'ready',
        message: payload.message ?? 'Session gate is closed.',
        detail: 'Browser execution is locked until the passphrase is re-entered.',
        configured: sessionState.configured,
        actor: null,
        expiresAt: null,
      })
    } catch (error) {
      setSessionState((current) => ({
        ...current,
        status: 'error',
        message: 'Failed to lock session.',
        detail: error instanceof Error ? error.message : 'Unknown session error.',
      }))
    }
  }

  const runOracleAction = async (actionId: string, mode: 'preview' | 'execute') => {
    const action = oracle.automation?.actions.find((item) => item.id === actionId) ?? null
    const actionTitle = action?.title ?? actionId

    if (mode === 'execute' && sessionState.status !== 'authenticated') {
      setPreviewState({
        status: 'error',
        result: {
          ok: false,
          error: 'unauthorized',
          message: 'Unlock the Mike-only session gate before executing Oracle actions.',
          action: action ?? undefined,
          policy: oracle.automation,
        },
        detail: 'Execute mode is locked until a valid signed session cookie is present.',
      })
      return
    }

    setPreviewState({
      status: 'loading',
      result: null,
      detail: `${mode === 'execute' ? 'Executing' : 'Previewing'} ${actionTitle}…`,
    })

    try {
      const response = await fetch(oracle.automation?.endpoint ?? '/api/oracle/actions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          mode,
          confirm: true,
          reason: previewReason,
        }),
      })

      const payload = (await response.json().catch(() => null)) as OracleActionPreviewResponse | null
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? payload?.error ?? `HTTP ${response.status}`)
      }

      setPreviewState({
        status: 'ready',
        result: { ...payload, source: 'live-api' },
        detail: payload.message ?? `${actionTitle} ${mode === 'execute' ? 'executed' : 'previewed'}.`,
      })
      if (payload.auditTrail) setActionAuditTrail(payload.auditTrail)
      if (mode === 'execute') setOracleRefreshNonce((n) => n + 1)
      return
    } catch (error) {
      if (mode === 'preview') {
        const fallback: OracleActionPreviewResponse = {
          ok: true,
          requestId: `local-preview-${Date.now()}`,
          decision: 'preview',
          message: 'Local preview generated from the dashboard manifest because the API endpoint was not reachable in this environment.',
          nextStep: 'Deploy the action API to a serverless environment to use the live preview endpoint.',
          source: 'local-fallback',
          action: action ?? undefined,
          policy: oracle.automation,
        }
        setPreviewState({
          status: 'error',
          result: fallback,
          detail: error instanceof Error ? error.message : 'Preview request failed.',
        })
        return
      }

      setPreviewState({
        status: 'error',
        result: {
          ok: false,
          error: 'execution_failed',
          message: error instanceof Error ? error.message : 'Execute request failed.',
          action: action ?? undefined,
          policy: oracle.automation,
          session: sessionState.actor && sessionState.expiresAt ? { actor: sessionState.actor, expiresAt: sessionState.expiresAt } : undefined,
        },
        detail: error instanceof Error ? error.message : 'Execute request failed.',
      })
    }
  }

  const runTerminalCommand = async () => {
    setTerminalState({ status: 'loading', result: null })
    try {
      const response = await fetch(oracle.terminal?.endpoint ?? '/api/oracle/terminal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: terminalCommand, cwd: terminalCwd, timeoutMs: 120000 }),
      })
      const payload = (await response.json().catch(() => null)) as OracleTerminalResponse | null
      if (!payload) throw new Error(`HTTP ${response.status}`)
      setTerminalState({ status: payload.ok ? 'ready' : 'error', result: payload })
    } catch (error) {
      setTerminalState({
        status: 'error',
        result: {
          ok: false,
          error: 'terminal_request_failed',
          message: error instanceof Error ? error.message : 'Unknown terminal error.',
        },
      })
    }
  }

  const runSnapshotPreview = () => runOracleAction('refresh-oracle-snapshot', 'preview')
  const runSnapshotExecute = () => runOracleAction('refresh-oracle-snapshot', 'execute')

  const submitSignalFeedback = async (signalId: string, rating: string) => {
    setFeedbackState({ status: 'loading', message: `Recording ${rating}…` })
    try {
      const response = await fetch(phase5C.feedbackButtons.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, rating, source: 'dashboard', note: `Dashboard quick feedback: ${rating}` }),
      })
      const payload = await response.json() as OracleFeedbackResponse
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? payload.error ?? 'Feedback failed.')
      setFeedbackState({ status: 'ready', message: payload.message ?? 'Feedback recorded.' })
      setOracleRefreshNonce((value) => value + 1)
    } catch (error) {
      setFeedbackState({ status: 'error', message: error instanceof Error ? error.message : 'Feedback failed.' })
    }
  }

  const runSafeExecutorQueue = async (queueItemId: string) => {
    setExecutorState({ status: 'loading', message: `Running ${queueItemId}…` })
    try {
      const response = await fetch(phase5C.executorRuns.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemId, confirm: true }),
      })
      const payload = await response.json() as OracleExecutorResponse
      if (!response.ok || !payload.ok) throw new Error(payload.run?.summary ?? payload.message ?? payload.error ?? 'Executor failed.')
      setExecutorState({ status: 'ready', message: payload.run?.summary ?? 'Safe executor run completed.' })
      setOracleRefreshNonce((value) => value + 1)
    } catch (error) {
      setExecutorState({ status: 'error', message: error instanceof Error ? error.message : 'Executor failed.' })
    }
  }


  const submitApprovalDecision = async (approvalInboxId: string, decision: string) => {
    setApprovalState({ status: 'loading', message: `Recording ${decision}…` })
    try {
      const response = await fetch(phase5D.approvalCallbacks.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalInboxId, decision, source: 'dashboard', note: `Dashboard approval callback: ${decision}` }),
      })
      const payload = await response.json() as OracleApprovalResponse
      if (!response.ok || !payload.ok) throw new Error(payload.message ?? payload.error ?? 'Approval callback failed.')
      setApprovalState({ status: 'ready', message: payload.message ?? `Recorded ${decision}.` })
      setOracleRefreshNonce((value) => value + 1)
    } catch (error) {
      setApprovalState({ status: 'error', message: error instanceof Error ? error.message : 'Approval callback failed.' })
    }
  }

  const previewAction = previewState.result?.action ?? oracle.automation?.actions[0] ?? null
  const projectNodes = data.documents.filter((d) => d.clusterId === 'projects').length
  const memoryNodes = data.documents.filter((d) => d.clusterId === 'memory').length
  const skillNodes = data.documents.filter((d) => d.clusterId === 'skills').length
  const runtimeNodes = data.documents.filter((d) => d.clusterId === 'runtime').length
  const onlineSites = oracle.websites.filter((w) => w.ok).length
  const dirtyRepos = oracle.repos.filter((r) => r.dirty).length
  const configuredCreds = oracle.credentials.filter((c) => c.configured).length
  const githubOk = oracle.github.filter((g) => g.apiStatus === 'ok').length
  const criticalIncidents = (oracle.incidents ?? []).filter((i) => i.severity === 'critical').length
  const oracleModeLabel = oracle.phase5I
    ? 'PHASE 5I · CONSCIOUSNESS LOOP'
    : oracle.phase5H
      ? 'PHASE 5H · INTEGRATION ROADMAP'
      : oracle.phase5G
        ? 'PHASE 5G · BOUNDED SAFE CRON'
    : oracle.phase5F
      ? 'PHASE 5F · LEARNING ACTION MEMORY'
    : oracle.phase5E
      ? 'PHASE 5E · QUALITY INTELLIGENCE'
    : oracle.phase5D
      ? 'PHASE 5D · APPROVAL + CRON GATES'
    : oracle.phase5C
      ? 'PHASE 5C · RUN-STATE AUTONOMY LOOP'
      : oracle.phase5B
        ? 'PHASE 5B · FEEDBACK + EXECUTOR LOOP'
        : oracle.phase5A
          ? 'PHASE 5A · CLOSED-LOOP SENSORS'
          : oracle.automation?.sessionConfigured
            ? 'PHASE 3B · SESSION-GATED ACTIONS'
            : 'PHASE 2A · READ ONLY'
  const wiroSite = oracle.websites.find((site) => site.name.toLowerCase().includes('wiro'))
  const wiroGithub = oracle.github.find((repo) => repo.repo.toLowerCase().includes('wiro'))
  const highPriorityRecommendations = (oracle.recommendations ?? []).slice(0, 5)
  const projectWarnings = [
    ...(oracle.incidents ?? []).map((incident) => ({
      id: incident.id,
      title: incident.title,
      project: incident.project,
      detail: incident.detail,
      severity: incident.severity,
      url: incident.url,
    })),
    ...oracle.repos.filter((repo) => repo.dirty).slice(0, 4).map((repo) => ({
      id: `dirty-${repo.name}`,
      title: `${repo.name} has local changes`,
      project: repo.name,
      detail: `${repo.changedFiles} changed files on ${repo.branch}. Review before deploy/commit.`,
      severity: 'warning' as const,
      url: repo.github,
    })),
  ].slice(0, 6)
  const reportSchedule = [
    { label: 'Morning command brief', cadence: 'Daily · 08:00', detail: 'Top actions, website health, Wiro CI, repo warnings.' },
    { label: 'Wiro business pulse', cadence: 'Daily · 18:00', detail: 'Guest leads, site status, quote/itinerary opportunities.' },
    { label: 'Weekly Oracle review', cadence: 'Monday · 09:00', detail: 'Projects, memory, deployments, learnings, next bets.' },
  ]
  const wiroBusinessMetrics = [
    { label: 'Website', value: wiroSite?.ok ? 'Online' : 'Check', detail: wiroSite?.responseMs ? `${wiroSite.responseMs}ms response` : 'No response data' },
    { label: 'CI', value: oracle.wiroCi?.conclusion ?? oracle.wiroCi?.status ?? 'No data', detail: oracle.wiroCi?.workflowName ?? 'Workflow sensor' },
    { label: 'GitHub', value: wiroGithub?.apiStatus ?? 'No data', detail: `${wiroGithub?.openIssues ?? 0} issues · ${wiroGithub?.openPullRequests ?? 0} PRs` },
    { label: 'Lead pipeline', value: 'Watch', detail: 'Use Telegram/Obsidian lead checks until CRM source is wired.' },
  ]
  const wiroOfferStack = [
    { title: '1-day Chiang Mai 4x4 adventure', audience: 'Travelers with limited time', next: 'Use as fast WhatsApp quote starter.' },
    { title: '3-day mountain journey', audience: 'Families and groups wanting real off-road', next: 'Bundle with kosher meals and private guide.' },
    { title: '14-day Northern Thailand + Laos grand tour', audience: 'High-ticket Hebrew/English customers', next: 'Use for premium itinerary conversations.' },
  ]
  const wiroContentQueue = [
    'Post the new vertical promo video as Reels/TikTok/Shorts with WhatsApp CTA.',
    'Create Hebrew version of the promo for Israeli travelers.',
    'Publish a “Kosher 4x4 Chiang Mai” explainer page/post.',
    'Turn Wiro CI + website health into a daily confidence check before campaigns.',
  ]
  const wiroOpsChecklist = [
    { label: 'Website booking path', status: wiroSite?.ok ? 'ready' : 'check', detail: wiroSite?.ok ? 'Main site reachable from Oracle snapshot.' : 'Website is not currently confirmed online.' },
    { label: 'WhatsApp CTA', status: 'ready', detail: 'Keep WhatsApp as the primary conversion route.' },
    { label: 'Kosher positioning', status: 'active', detail: 'Highlight Hebrew-speaking guide support, kosher meals, and Shabbat-friendly planning.' },
    { label: 'Inquiry processing', status: 'scheduled', detail: 'Daily lead check cron monitors Wiro inquiries and returns action lists.' },
  ]
  const autonomyRules = [
    { label: 'Safe autonomy', status: 'active', detail: 'Moshe can improve dashboard UI, reports, docs, read-only checks, and debug flows without waiting.' },
    { label: 'Guardrails', status: 'locked', detail: 'Secrets, destructive changes, customer-facing sends, and risky writes still require explicit gates.' },
    { label: 'Evidence first', status: 'required', detail: 'Every shipped improvement needs build/test/browser/live verification before it counts as done.' },
  ]
  const improvementBacklog = [
    { title: 'Report feedback score', owner: 'Oracle', value: 'Next', detail: 'Track whether morning and evening reports are useful, noisy, or missing context.' },
    { title: 'Wiro lead source bridge', owner: 'Wiro', value: 'High', detail: 'Convert Obsidian inquiry counts into a dashboard signal without exposing customer details.' },
    { title: 'Deployment freshness card', owner: 'DevOps', value: 'High', detail: 'Show live commit versus repo HEAD with a simple in-sync or stale verdict.' },
    { title: 'Autonomous weekly cleanup', owner: 'Moshe', value: 'Medium', detail: 'Surface stale notes, dirty repos, and missing retrospectives as one weekly maintenance list.' },
  ]
  const activeLoops = [
    { name: 'Morning Oracle Brief', cadence: '08:00 daily', signal: 'top actions, Wiro, warnings' },
    { name: 'Evening Wiro Business Pulse', cadence: '18:00 daily', signal: 'sales readiness, leads, marketing move' },
    { name: 'Daily Oracle Self-Learning Scan', cadence: '07:00 daily', signal: 'memory/project learning' },
    { name: 'Weekly Oracle Report', cadence: 'Monday 09:00', signal: 'strategic review' },
  ]
  const latestDeploy = oracle.deployTimeline?.find((event) => event.project.toLowerCase().includes('galaxy') || event.project.toLowerCase().includes('oracle'))
    ?? oracle.deployTimeline?.[0]
    ?? null
  const mosheRepo = oracle.repos.find((repo) => repo.name.toLowerCase().includes('moshe'))
  const deployedShort = latestDeploy?.deployedCommitSha?.slice(0, 7) ?? oracle.deployments[0]?.gitCommitSha?.slice(0, 7) ?? 'unknown'
  const repoShort = mosheRepo?.commit ?? 'unknown'
  const deployMetadataLagging = Boolean(
    latestDeploy?.timestamp
    && Number.isFinite(Date.parse(latestDeploy.timestamp))
    && Number.isFinite(Date.parse(oracle.generated))
    && Date.parse(latestDeploy.timestamp) < Date.parse(oracle.generated)
    && latestDeploy.syncState !== 'in-sync',
  )
  const deploySync = deployedShort !== 'unknown' && repoShort !== 'unknown' && deployedShort === repoShort
    ? 'in-sync'
    : deployMetadataLagging
      ? 'unknown'
      : latestDeploy?.syncState ?? 'unknown'
  const deploymentFreshness = {
    label: deploySync === 'in-sync' ? 'LIVE MATCHES REPO' : deploySync === 'behind' ? 'LIVE BEHIND REPO' : deploySync === 'ahead' ? 'LIVE AHEAD OF REPO' : 'VERIFY LIVE COMMIT',
    badge: deploySync === 'in-sync' ? 'low' : deploySync === 'unknown' ? 'medium' : 'high',
    detail: deployMetadataLagging
      ? 'Vercel metadata can lag during fresh deploys. Oracle will verify again on the next snapshot.'
      : latestDeploy?.note ?? 'Oracle compares Vercel deployment metadata with the current Moshe repo snapshot.',
    deployed: deployedShort,
    repo: repoShort,
    message: latestDeploy?.deployedCommitMessage ?? oracle.deployments[0]?.gitCommitMessage ?? mosheRepo?.commitSubject ?? 'No deployment message available.',
    updated: latestDeploy?.timestamp ?? oracle.deployments[0]?.createdAt ?? oracle.generated,
  }
  const readiness = oracle.operationalReadiness ?? {
    score: 0,
    status: 'watch' as const,
    summary: 'Waiting for live readiness data.',
    checks: [],
  }
  const readinessBadge = readiness.status === 'excellent' || readiness.status === 'steady'
    ? 'low'
    : readiness.status === 'watch'
      ? 'medium'
      : 'high'
  const intelligence = oracle.intelligenceLayer ?? {
    updatedAt: oracle.generated,
    summary: 'Oracle intelligence layer is waiting for the next generated snapshot.',
    todayLearnings: [],
    opportunityRadar: [],
    approvalQueue: [],
    autonomyRouter: {
      updatedAt: oracle.generated,
      summary: 'Autonomy router is waiting for the next generated snapshot.',
      lanes: [],
      guardrails: [],
    },
  }
  const topMoneyOpportunity = intelligence.opportunityRadar[0] ?? null
  const safeApprovalItems = intelligence.approvalQueue.filter((item) => item.category === 'safe')
  const draftApprovalItems = intelligence.approvalQueue.filter((item) => item.category === 'draft-only')
  const gatedApprovalItems = intelligence.approvalQueue.filter((item) => item.category === 'approval-required')
  const terminalPolicy = terminalLivePolicy ?? oracle.terminal ?? {
    enabled: false,
    terminalEnabled: false,
    sessionConfigured: false,
    endpoint: '/api/oracle/terminal',
    authMethod: 'preview-only' as const,
    defaultCwd: '/Users/pasuthunjunkong/workspace/Moshe',
    allowedCwdPrefixes: ['/Users/pasuthunjunkong/workspace/Moshe'],
    note: 'Terminal policy not loaded yet.',
  }
  const terminalReady = terminalPolicy.enabled && sessionState.status === 'authenticated'

  return (
    <aside className="oracle-shell" aria-label="Oracle OS command center">
      <div className="oracle-hero-card">
        <div>
          <p className="oracle-kicker">ORACLE OS · {oracleModeLabel}</p>
          <h1>MOSHE</h1>
          <p className="oracle-subtitle">
            Mike's external brain · generated {timeAgo(oracle.generated)}
          </p>
        </div>
        <div className="oracle-pulse" aria-hidden="true">
          <span />
        </div>
      </div>

      <dl className="oracle-metrics" aria-label="Oracle status summary">
        {[
          { label: 'Brain', value: data.documents.length },
          { label: 'Sites OK', value: `${onlineSites}/${oracle.websites.length || 0}` },
          { label: 'Dirty', value: dirtyRepos },
          { label: 'GitHub', value: `${githubOk}/${oracle.github.length || 0}` },
          { label: 'Alerts', value: criticalIncidents, alert: criticalIncidents > 0 },
        ].map((m) => (
          <div key={m.label} className={`oracle-metric${'alert' in m && m.alert ? ' oracle-metric-alert' : ''}`}>
            <dt>{m.label}</dt>
            <dd>{'alert' in m && m.alert ? `⚠ ${m.value}` : m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="oracle-tabs" role="tablist" aria-label="Oracle sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`oracle-tab-${t.id}`}
            aria-controls={`oracle-panel-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            className={`oracle-tab${tab === t.id ? ' active' : ''}${(t.id === 'intel' || t.id === 'today') && criticalIncidents > 0 ? ' has-alert' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {(t.id === 'intel' || t.id === 'today') && criticalIncidents > 0 && <span className="oracle-tab-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* ── Today tab ── */}
      {tab === 'today' && (
        <section id="oracle-panel-today" role="tabpanel" aria-labelledby="oracle-tab-today" className="oracle-section oracle-scroll">
          <div className="oracle-today-hero">
            <div>
              <p>Mike command center</p>
              <h2>Today</h2>
              <small>Generated {timeAgo(oracle.generated)} · {onlineSites}/{oracle.websites.length || 0} sites online · {dirtyRepos} dirty repos</small>
            </div>
            <span className={`oracle-risk-badge ${criticalIncidents > 0 ? 'high' : projectWarnings.length > 0 ? 'medium' : 'low'}`}>
              {criticalIncidents > 0 ? 'ACTION NEEDED' : projectWarnings.length > 0 ? 'WATCH' : 'CLEAR'}
            </span>
          </div>

          <div className="oracle-readiness-panel" aria-label="Oracle operational readiness">
            <div className="oracle-readiness-score">
              <span>{readiness.score}</span>
              <small>/100</small>
            </div>
            <div className="oracle-readiness-body">
              <div className="oracle-status-head">
                <strong>Autonomy readiness</strong>
                <span className={`oracle-risk-badge ${readinessBadge}`}>{readiness.status.toUpperCase()}</span>
              </div>
              <p>{readiness.summary}</p>
              <div className="oracle-readiness-checks">
                {readiness.checks.slice(0, 4).map((check) => (
                  <span className={`oracle-readiness-chip ${check.status}`} key={check.label} title={check.detail}>
                    {check.label}: {check.status}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="oracle-intelligence-hero" aria-label="Oracle intelligence layer">
            <div>
              <p>INTELLIGENCE LAYER</p>
              <h3>{topMoneyOpportunity?.title ?? 'Learning loop warming up'}</h3>
              <small>{intelligence.summary}</small>
            </div>
            <span className={`oracle-risk-badge ${topMoneyOpportunity?.fit === 'excellent' ? 'low' : topMoneyOpportunity ? 'medium' : 'high'}`}>
              {topMoneyOpportunity ? `${topMoneyOpportunity.score}/100` : 'NO RADAR'}
            </span>
          </div>

          <div className="oracle-autonomy-router" aria-label="Oracle autonomy router">
            <div className="oracle-status-head">
              <div>
                <strong>Autonomy Router</strong>
                <p>{intelligence.autonomyRouter.summary}</p>
              </div>
              <span className="oracle-risk-badge low">3 LANES</span>
            </div>
            <div className="oracle-autonomy-lanes">
              {intelligence.autonomyRouter.lanes.map((lane) => (
                <article className={`oracle-autonomy-lane ${lane.status}`} key={lane.id}>
                  <div className="oracle-status-head">
                    <strong>{lane.label}</strong>
                    <span>{lane.count}</span>
                  </div>
                  <p>{lane.summary}</p>
                  <small>{lane.examples.slice(0, 3).join(' · ')}</small>
                  {lane.allowedWork?.length > 0 && <small>Allowed: {lane.allowedWork.slice(0, 2).join(' · ')}</small>}
                  {lane.blockedWork?.length > 0 && <small>Blocked: {lane.blockedWork.slice(0, 2).join(' · ')}</small>}
                </article>
              ))}
            </div>
          </div>

          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Today’s learnings</strong>
                <span>{intelligence.todayLearnings.length}</span>
              </div>
              {intelligence.todayLearnings.length > 0 ? intelligence.todayLearnings.slice(0, 3).map((learning) => (
                <div className="oracle-intel-line" key={`${learning.title}-${learning.source}`}>
                  <strong>{learning.title}</strong>
                  <p>{learning.insight}</p>
                  <small>{learning.whyItMatters}</small>
                </div>
              )) : <small className="oracle-muted">No self-learning entries in this snapshot yet.</small>}
            </article>

            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Money opportunity radar</strong>
                <span>{intelligence.opportunityRadar.length}</span>
              </div>
              {intelligence.opportunityRadar.length > 0 ? intelligence.opportunityRadar.slice(0, 3).map((item) => (
                <div className="oracle-opportunity-line" key={item.title}>
                  <div>
                    <strong>#{item.rank} {item.title}</strong>
                    <span className={`oracle-risk-badge ${item.fit === 'excellent' ? 'low' : 'medium'}`}>{item.score}/100</span>
                  </div>
                  <p>{item.thesis}</p>
                  <small>{item.pricing}</small>
                  <small>Validate: {item.validationStep}</small>
                </div>
              )) : <small className="oracle-muted">No money radar artifact detected yet.</small>}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>APPROVAL QUEUE</p>
            <span>{safeApprovalItems.length} safe · {draftApprovalItems.length} draft · {gatedApprovalItems.length} need Mike</span>
          </div>
          <div className="oracle-approval-grid">
            {intelligence.approvalQueue.map((item) => (
              <article className={`oracle-approval-card ${item.category === 'safe' ? 'safe' : item.category === 'draft-only' ? 'draft' : 'gated'}`} key={item.title}>
                <div className="oracle-status-head">
                  <strong>{item.title}</strong>
                  <span className={`oracle-risk-badge ${item.category === 'safe' ? 'low' : item.category === 'draft-only' ? 'medium' : item.risk}`}>
                    {item.category === 'safe' ? 'SAFE NOW' : item.category === 'draft-only' ? 'DRAFT ONLY' : 'APPROVAL'}
                  </span>
                </div>
                <p>{item.riskReason ?? item.reason}</p>
                <small>{item.nextSafeStep ?? item.proposedAction}</small>
                {item.businessArea && <small>{item.businessArea} · {item.autonomyLevel ?? item.category}</small>}
                {item.approvalTrigger && <small>{item.approvalTrigger}</small>}
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>TOP 5 RECOMMENDED ACTIONS</p>
            <span>{highPriorityRecommendations.length || 0} ready</span>
          </div>
          {highPriorityRecommendations.length > 0 ? (
            <ol className="oracle-today-actions">
              {highPriorityRecommendations.map((rec, idx) => (
                <li key={`${rec.project}-${idx}`}>
                  <span>{idx + 1}</span>
                  <div>
                    <strong>{rec.suggestedAction}</strong>
                    <small>{rec.project} · {rec.priority.toUpperCase()} priority · {rec.risk.toUpperCase()} risk</small>
                    <p>{rec.reason}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="oracle-live-card"><strong>No urgent recommendation</strong><small className="oracle-muted">Oracle did not detect a high-value action in the current snapshot.</small></div>
          )}

          <div className="oracle-today-grid">
            <article className={`oracle-status-card ${wiroSite?.ok && oracle.wiroCi?.conclusion !== 'failure' ? 'ok' : 'warn'}`}>
              <div className="oracle-status-head">
                <strong>Wiro cockpit</strong>
                <span>{wiroSite?.ok ? 'SITE ONLINE' : 'CHECK SITE'}</span>
              </div>
              <div className="oracle-wiro-row"><span>Website</span><code>{wiroSite?.status ?? '—'} · {wiroSite?.responseMs ? `${wiroSite.responseMs}ms` : '—'}</code></div>
              <div className="oracle-wiro-row"><span>CI</span><code>{oracle.wiroCi?.conclusion ?? oracle.wiroCi?.status ?? 'no data'}</code></div>
              <div className="oracle-wiro-row"><span>GitHub</span><code>{wiroGithub?.apiStatus ?? 'no data'}</code></div>
              <p className="oracle-wiro-opp">Watch the tour website, Wiro CI, and GitHub health as one business cockpit.</p>
              {wiroSite?.url && isHttpUrl(wiroSite.url) && <a href={wiroSite.url} target="_blank" rel="noopener noreferrer" className="oracle-link">Open Wiro ↗</a>}
            </article>

            <article className="oracle-status-card warn">
              <div className="oracle-status-head">
                <strong>Project warnings</strong>
                <span>{projectWarnings.length}</span>
              </div>
              {projectWarnings.length > 0 ? projectWarnings.slice(0, 4).map((warning) => (
                <div className="oracle-warning-line" key={warning.id}>
                  <strong>{warning.project}</strong>
                  <small>{warning.title}</small>
                  <p>{warning.detail}</p>
                </div>
              )) : <small className="oracle-muted">No project warnings in this snapshot.</small>}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>NEXT REPORTS</p>
            <span>{reportSchedule.length} scheduled templates</span>
          </div>
          <div className="oracle-report-grid">
            {reportSchedule.map((report) => (
              <article className="oracle-report-card" key={report.label}>
                <strong>{report.label}</strong>
                <span>{report.cadence}</span>
                <p>{report.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Intel tab ── */}
      {tab === 'intel' && (
        <section id="oracle-panel-intel" role="tabpanel" aria-labelledby="oracle-tab-intel" className="oracle-section oracle-scroll">

          {/* Wiro CI */}
          <div className="oracle-section-head">
            <p>WIRO CI STATUS</p>
            <span>{oracle.wiroCi ? (oracle.wiroCi.conclusion ?? oracle.wiroCi.status) : 'no data'}</span>
          </div>
          {oracle.wiroCi ? (
            <article className={`oracle-status-card ${oracle.wiroCi.conclusion === 'success' ? 'ok' : oracle.wiroCi.conclusion === 'failure' ? 'fail' : 'warn'}`}>
              <div className="oracle-status-head">
                <strong>{oracle.wiroCi.workflowName}</strong>
                <span>{oracle.wiroCi.conclusion ?? oracle.wiroCi.status}</span>
              </div>
              <div className="oracle-wiro-row">
                <span>Branch</span>
                <code>{oracle.wiroCi.branch}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Trigger</span>
                <code>{oracle.wiroCi.event ?? '—'}</code>
              </div>
              {oracle.wiroCi.failureCategory && (
                <div className="oracle-wiro-row">
                  <span>Failure type</span>
                  <code className="oracle-fail-code">{oracle.wiroCi.failureCategory}</code>
                </div>
              )}
              {oracle.wiroCi.jobDetails && (
                <div className="oracle-wiro-row">
                  <span>Job</span>
                  <code className="oracle-fail-code">
                    {oracle.wiroCi.jobDetails.jobName}
                    {oracle.wiroCi.jobDetails.failedStep ? ` › ${oracle.wiroCi.jobDetails.failedStep}` : ''}
                  </code>
                </div>
              )}
              {oracle.wiroCi.url && isHttpUrl(oracle.wiroCi.url) && (
                <a href={oracle.wiroCi.url} target="_blank" rel="noopener noreferrer" className="oracle-link oracle-link-block">
                  View run on GitHub ↗
                </a>
              )}
              <small className="oracle-muted">Updated {oracle.wiroCi.updatedAt ? timeAgo(oracle.wiroCi.updatedAt) : '—'}</small>
            </article>
          ) : (
            <div className="oracle-cron-card">
              <small className="oracle-muted">No Wiro CI data. Run generate:oracle to fetch latest status.</small>
            </div>
          )}

          {/* Incidents */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>INCIDENTS</p>
            <span>{(oracle.incidents ?? []).length} detected</span>
          </div>
          {(oracle.incidents ?? []).length === 0 ? (
            <div className="oracle-live-card">
              <strong>All clear</strong>
              <small className="oracle-muted">No incidents detected at last snapshot.</small>
            </div>
          ) : (
            (oracle.incidents ?? []).map((inc) => (
              <article className={`oracle-incident-card ${inc.severity}`} key={inc.id}>
                <div className="oracle-incident-head">
                  <strong>{inc.title}</strong>
                  <span className={`oracle-severity-badge ${inc.severity}`}>{inc.severity.toUpperCase()}</span>
                </div>
                <small className="oracle-incident-project">{inc.project} · {inc.category}</small>
                <p className="oracle-incident-detail">{inc.detail}</p>
                {inc.url && isHttpUrl(inc.url) && (
                  <a href={inc.url} target="_blank" rel="noopener noreferrer" className="oracle-link">View ↗</a>
                )}
                <small className="oracle-muted">{timeAgo(inc.detectedAt)}</small>
              </article>
            ))
          )}

          {/* Recommendations */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RECOMMENDATIONS</p>
            <span>top {(oracle.recommendations ?? []).length}</span>
          </div>
          {(oracle.recommendations ?? []).length === 0 ? (
            <div className="oracle-live-card">
              <strong>Nothing urgent</strong>
              <small className="oracle-muted">No recommendations at this time.</small>
            </div>
          ) : (
            (oracle.recommendations ?? []).map((rec, idx) => (
              <div className="oracle-rec-card" key={`${rec.project}-${idx}`}>
                <div className="oracle-rec-head">
                  <strong>{rec.project}</strong>
                  <span className={`oracle-risk-badge ${rec.priority}`}>{rec.priority.toUpperCase()}</span>
                </div>
                <p className="oracle-rec-reason">{rec.reason}</p>
                <small className="oracle-muted">{rec.risk.toUpperCase()} RISK</small>
                <p className="oracle-rec-action">{rec.suggestedAction}</p>
              </div>
            ))
          )}

          {/* Deploy Timeline */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>DEPLOY TIMELINE</p>
            <span>{(oracle.deployTimeline ?? []).length} events</span>
          </div>
          {(oracle.deployTimeline ?? []).length === 0 ? (
            <div className="oracle-cron-card">
              <small className="oracle-muted">No timeline events yet.</small>
            </div>
          ) : (
            <div className="oracle-timeline">
              {(oracle.deployTimeline ?? []).map((ev, idx) => (
                <div className="oracle-timeline-event" key={`${ev.provider}-${ev.project}-${idx}`}>
                  <div className="oracle-timeline-dot" data-provider={ev.provider} />
                  <div className="oracle-timeline-body">
                    <div className="oracle-timeline-head">
                      <strong>{ev.project}</strong>
                      <span className={`cron-badge ${timelineBadgeClass(ev.state)}`}>{ev.state}</span>
                    </div>
                    <small className="oracle-muted">{ev.provider.toUpperCase()} · {ev.event} · {timeAgo(ev.timestamp)}</small>
                    {ev.deployedCommitSha && (
                      <div className="oracle-wiro-row">
                        <span>Deployed commit</span>
                        <code>{ev.deployedCommitSha.slice(0, 7)}</code>
                      </div>
                    )}
                    {ev.sourceRepo && (
                      <div className="oracle-wiro-row">
                        <span>Source repo</span>
                        <code>{ev.sourceRepo}</code>
                      </div>
                    )}
                    {ev.sourceCommitSha && (
                      <div className="oracle-wiro-row">
                        <span>Current commit</span>
                        <code>{ev.sourceCommitSha.slice(0, 7)}</code>
                      </div>
                    )}
                    {ev.syncState && (
                      <div className="oracle-wiro-row">
                        <span>Freshness</span>
                        <code className={syncBadgeClass(ev.syncState)}>{ev.syncState}</code>
                      </div>
                    )}
                    {ev.deployedCommitMessage && <p className="oracle-timeline-note">{ev.deployedCommitMessage}</p>}
                    {ev.note && <p className="oracle-timeline-note">{ev.note}</p>}
                    {ev.url && isHttpUrl(ev.url) && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="oracle-link">{ev.url}</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <section id="oracle-panel-overview" role="tabpanel" aria-labelledby="oracle-tab-overview" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>SYSTEM PHASE</p>
            <span>{oracle.born}</span>
          </div>
          <div className="oracle-live-card">
            <strong>{oracle.level3Phase}</strong>
            <small>Safe mode: no redeploy/restart/write actions exposed in browser.</small>
          </div>

          <div className="oracle-live-card compact oracle-feedback-card">
            <span>Feedback loop: <strong>active</strong></span>
            <span>Audit learnings: <strong>{oracle.recentLearnings.length}</strong></span>
            <span>Memory write: <strong>ψ/memory/learnings/oracle-action-feedback.md</strong></span>
            <small>{feedbackLoopNote}</small>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>ACTION LAYER</p>
            <span>{oracle.automation?.executionMode ?? 'preview-only'}</span>
          </div>
          {oracle.automation ? (
            <article className={`oracle-status-card ${oracle.automation.enabled ? 'ok' : 'warn'}`}>
              <div className="oracle-status-head">
                <strong>Future buttons</strong>
                <span>{oracle.automation.enabled ? 'SESSION GATED' : 'PREVIEW ONLY'}</span>
              </div>
              <div className="oracle-wiro-row">
                <span>Endpoint</span>
                <code>{oracle.automation.endpoint}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Session gate</span>
                <code>{oracle.automation.sessionConfigured ? 'signed cookie' : 'missing'}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Session endpoint</span>
                <code>{oracle.automation.sessionEndpoint}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Audit</span>
                <code>{oracle.automation.auditPath}</code>
              </div>
              <div className="oracle-policy-badges">
                <span className={`oracle-risk-badge ${oracle.automation.enabled ? 'high' : 'low'}`}>
                  {oracle.automation.executionMode.toUpperCase()}
                </span>
                <span className="oracle-risk-badge medium">Mike-only</span>
                <span className="oracle-risk-badge low">Allowlisted</span>
                <span className="oracle-risk-badge low">Audit logged</span>
              </div>
              <div className="oracle-action-boundary">
                <div className="oracle-boundary-card">
                  <strong>Safety rail</strong>
                  <ul>
                    <li>Server-side execution only</li>
                    <li>Explicit confirmation for every mutation</li>
                    <li>Allowlisted targets and actions</li>
                    <li>Write audit trail before side effects</li>
                  </ul>
                </div>
                <div className="oracle-boundary-card">
                  <strong>Preview mode</strong>
                  <p>{oracle.automation.note}</p>
                  <small>Preview trigger is live; execute mode waits for a signed Mike-only session cookie.</small>
                </div>
              </div>
              <div className="oracle-preview-panel">
                <div className="oracle-preview-head">
                  <div>
                    <strong>Action preview trigger</strong>
                    <p>Wired to the Oracle action API in preview mode first.</p>
                  </div>
                  <span className={`oracle-risk-badge ${previewState.status === 'error' ? 'medium' : 'low'}`}>
                    {previewState.status === 'idle' ? 'READY' : previewState.status.toUpperCase()}
                  </span>
                </div>
                <label className="oracle-preview-field">
                  <span>Preview reason</span>
                  <textarea
                    value={previewReason}
                    onChange={(e) => setPreviewReason(e.target.value)}
                    rows={3}
                    placeholder="Why do we want to preview the Oracle snapshot?"
                  />
                </label>
                <div className="oracle-preview-actions">
                  <button
                    type="button"
                    className="oracle-preview-button"
                    onClick={runSnapshotPreview}
                    disabled={previewState.status === 'loading'}
                  >
                    {previewState.status === 'loading' ? 'Sending preview…' : 'Preview refresh-oracle-snapshot'}
                  </button>
                  <small>Preview-only calls do not mutate the dashboard. Execution stays server-side.</small>
                </div>
                <div className="oracle-preview-result">
                  <div className="oracle-preview-result-head">
                    <strong>{previewAction?.title ?? 'Refresh Oracle snapshot'}</strong>
                    <div className="oracle-preview-result-badges">
                      <span>{previewState.result?.decision ?? '—'}</span>
                      <span className={`oracle-risk-badge ${previewState.result?.source === 'live-api' ? 'low' : 'medium'}`}>
                        {previewState.result?.source === 'live-api'
                          ? 'LIVE API'
                          : previewState.result?.source === 'local-fallback'
                            ? 'LOCAL FALLBACK'
                            : 'NO SOURCE'}
                      </span>
                    </div>
                  </div>
                  <p>{previewState.result?.message ?? 'No preview has been sent yet.'}</p>
                  {previewState.detail && <small>{previewState.detail}</small>}
                  {previewState.result?.nextStep && <small>{previewState.result.nextStep}</small>}
                  {previewState.result?.requestId && <code>{previewState.result.requestId}</code>}
                </div>
                <div className="oracle-execute-lane">
                  <div className="oracle-boundary-card oracle-execute-card">
                    <strong>Execute lane</strong>
                    <p>
                      Real execution only opens after a Mike-only signed session cookie is minted by the server.
                    </p>
                    {oracle.automation.sessionConfigured ? (
                      <>
                        <label className="oracle-session-field">
                          <span>Session passphrase</span>
                          <input
                            type="password"
                            value={sessionPassphrase}
                            onChange={(e) => setSessionPassphrase(e.target.value)}
                            placeholder="Enter Mike-only passphrase"
                          />
                        </label>
                        <div className="oracle-session-actions">
                          <button
                            type="button"
                            className="oracle-preview-button"
                            onClick={unlockSession}
                            disabled={sessionState.status === 'loading' || !sessionPassphrase.trim()}
                          >
                            {sessionState.status === 'loading' ? 'Unlocking…' : sessionState.status === 'authenticated' ? 'Refresh session' : 'Unlock session'}
                          </button>
                          <button
                            type="button"
                            className="oracle-session-secondary"
                            onClick={lockSession}
                            disabled={sessionState.status !== 'authenticated'}
                          >
                            Lock session
                          </button>
                        </div>
                        <small>{sessionState.message}</small>
                        <small>{sessionState.detail}</small>
                        {sessionState.actor && <small>Signed in as {sessionState.actor}</small>}
                        {sessionState.expiresAt && <small>Expires at {new Date(sessionState.expiresAt).toLocaleString()}</small>}
                      </>
                    ) : (
                      <small>Set ORACLE_SESSION_SECRET on the server to enable the Mike-only session gate.</small>
                    )}
                    <button
                      type="button"
                      className="oracle-preview-button"
                      onClick={runSnapshotExecute}
                      disabled={sessionState.status !== 'authenticated'}
                    >
                      Execute refresh-oracle-snapshot
                    </button>
                    <small>
                      Browser execution is disabled until a signed session cookie exists. The API still keeps a full audit trail.
                    </small>
                  </div>
                </div>
              </div>
              <div className="oracle-action-grid">
                {oracle.automation.actions.map((action) => (
                  <article className="oracle-action-card" key={action.id}>
                    <div className="oracle-action-head">
                      <strong>{action.title}</strong>
                      <span className={`oracle-risk-badge ${action.risk}`}>{action.risk.toUpperCase()}</span>
                    </div>
                    <p>{action.description}</p>
                    <small>
                      {action.transport} · {action.requiresConfirmation ? 'confirmation required' : 'no confirmation'}
                    </small>
                    <div className="oracle-action-buttons">
                      <button type="button" className="oracle-session-secondary" onClick={() => runOracleAction(action.id, 'preview')} disabled={previewState.status === 'loading'}>
                        Preview
                      </button>
                      <button type="button" className="oracle-preview-button" onClick={() => runOracleAction(action.id, 'execute')} disabled={sessionState.status !== 'authenticated' || previewState.status === 'loading'}>
                        Execute
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="oracle-audit-panel">
                <div className="oracle-preview-head">
                  <div>
                    <strong>Audit trail</strong>
                    <p>Last server-side action decisions. Secrets and passphrases are never shown here.</p>
                  </div>
                  <span className="oracle-risk-badge low">{actionAuditTrail.length} EVENTS</span>
                </div>
                {actionAuditTrail.length > 0 ? (
                  <div className="oracle-audit-list">
                    {actionAuditTrail.slice(0, 8).map((entry) => (
                      <div className="oracle-audit-row" key={entry.id}>
                        <span className={`oracle-risk-badge ${entry.outcome === 'denied' ? 'medium' : 'low'}`}>{entry.outcome.toUpperCase()}</span>
                        <div>
                          <strong>{entry.actionId}</strong>
                          <small>{entry.actor} · {timeAgo(entry.requestedAt)}</small>
                          <p>{entry.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <small className="oracle-muted">No action audit events available from this runtime yet.</small>
                )}
              </div>
            </article>
          ) : (
            <div className="oracle-cron-card">
              <small className="oracle-muted">Phase 3 automation summary not available yet.</small>
            </div>
          )}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>DEPLOYMENTS</p>
            <span>{oracle.deployments.length} source</span>
          </div>
          {oracle.deployments.map((d, idx) => (
            <div className="oracle-cron-card" key={`${d.provider}-${d.project}-${idx}`}>
              <div>
                <strong>{d.provider.toUpperCase()} · {d.project}</strong>
                <span className={`cron-badge ${d.state.toLowerCase()}`}>{d.state}</span>
              </div>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="oracle-link">{d.url}</a>}
              {(d.gitCommitSha || d.gitCommitMessage) && (
                <>
                  <small>Commit {d.gitCommitSha ? d.gitCommitSha.slice(0, 7) : '—'} · {d.gitCommitRef ?? 'no ref'}{d.gitDirty ? ' · dirty' : ''}</small>
                  {d.gitCommitMessage && <small>{d.gitCommitMessage}</small>}
                </>
              )}
              <small>{d.createdAt ? timeAgo(d.createdAt) : d.note ?? 'read-only snapshot'}</small>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>AGENTS &amp; CRONS</p>
            <span>{oracle.activeCrons.length} listed</span>
          </div>
          {oracle.activeCrons.map((c, idx) => (
            <div className="oracle-cron-card" key={`${c.name}-${idx}`}>
              <div>
                <strong>{c.name}</strong>
                <span className={`cron-badge ${c.status}`}>{c.status}</span>
              </div>
              <p>{c.schedule}</p>
              <small>Next: {c.nextRun}</small>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>NEXT ACTIONS</p>
          </div>
          <ol className="oracle-next-steps">
            {oracle.nextActions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Wiro Business tab ── */}
      {tab === 'wiro' && (
        <section id="oracle-panel-wiro" role="tabpanel" aria-labelledby="oracle-tab-wiro" className="oracle-section oracle-scroll">
          <div className="oracle-wiro-business-hero">
            <div>
              <p>WIRO 4X4 BUSINESS MODE</p>
              <h2>Adventure cockpit</h2>
              <small>Hebrew/English guests · kosher 4x4 adventures · Chiang Mai / Indochina</small>
            </div>
            <span className={`oracle-risk-badge ${wiroSite?.ok && oracle.wiroCi?.conclusion === 'success' ? 'low' : 'medium'}`}>
              {wiroSite?.ok && oracle.wiroCi?.conclusion === 'success' ? 'SELL READY' : 'CHECK OPS'}
            </span>
          </div>

          <div className="oracle-wiro-business-grid">
            {wiroBusinessMetrics.map((metric) => (
              <article className="oracle-wiro-business-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>OFFER STACK</p>
            <span>{wiroOfferStack.length} sellable routes</span>
          </div>
          <div className="oracle-wiro-offer-list">
            {wiroOfferStack.map((offer) => (
              <article className="oracle-wiro-offer-card" key={offer.title}>
                <strong>{offer.title}</strong>
                <small>{offer.audience}</small>
                <p>{offer.next}</p>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>CONTENT & CONVERSION QUEUE</p>
            <span>next marketing moves</span>
          </div>
          <ol className="oracle-wiro-content-list">
            {wiroContentQueue.map((item, idx) => (
              <li key={item}>
                <span>{idx + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>OPERATIONS CHECKLIST</p>
            <span>guest-ready signals</span>
          </div>
          <div className="oracle-wiro-ops-list">
            {wiroOpsChecklist.map((item) => (
              <article className="oracle-wiro-ops-card" key={item.label}>
                <div className="oracle-status-head">
                  <strong>{item.label}</strong>
                  <span>{item.status.toUpperCase()}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>WIRO QUICK ACTIONS</p>
            <span>business-focused</span>
          </div>
          <div className="oracle-wiro-quick-actions">
            <a href="https://www.wiro4x4indochina.com" target="_blank" rel="noopener noreferrer" className="oracle-preview-button">Open Wiro site ↗</a>
            {oracle.wiroCi?.url && isHttpUrl(oracle.wiroCi.url) && (
              <a href={oracle.wiroCi.url} target="_blank" rel="noopener noreferrer" className="oracle-session-secondary">Open Wiro CI ↗</a>
            )}
            <button type="button" className="oracle-preview-button" onClick={() => runOracleAction('dispatch-wiro-ci', 'preview')}>Preview Wiro CI dispatch</button>
            <button type="button" className="oracle-preview-button" onClick={() => runOracleAction('dispatch-wiro-ci', 'execute')} disabled={sessionState.status !== 'authenticated'}>Execute Wiro CI dispatch</button>
          </div>
        </section>
      )}

      {/* ── Improve tab ── */}
      {tab === 'improve' && (
        <section id="oracle-panel-improve" role="tabpanel" aria-labelledby="oracle-tab-improve" className="oracle-section oracle-scroll">
          <div className="oracle-improve-hero">
            <div>
              <p>AUTONOMOUS ORACLE LOOP</p>
              <h2>Self-improvement mode</h2>
              <small>Safe improvements ship without waiting. Risky actions stay behind guardrails.</small>
            </div>
            <span className="oracle-risk-badge low">ACTIVE</span>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>OPERATING RULES</p>
            <span>{autonomyRules.length} boundaries</span>
          </div>
          <div className="oracle-improve-rule-list">
            {autonomyRules.map((rule) => (
              <article className="oracle-improve-rule" key={rule.label}>
                <div className="oracle-status-head">
                  <strong>{rule.label}</strong>
                  <span>{rule.status.toUpperCase()}</span>
                </div>
                <p>{rule.detail}</p>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>DEPLOYMENT FRESHNESS</p>
            <span>{deploymentFreshness.label}</span>
          </div>
          <article className="oracle-deploy-freshness">
            <div className="oracle-deploy-ring" aria-hidden="true">
              <span>{deploymentFreshness.badge === 'low' ? '✓' : '!'}</span>
            </div>
            <div className="oracle-deploy-freshness-main">
              <div className="oracle-status-head">
                <strong>{deploymentFreshness.label}</strong>
                <span className={`oracle-risk-badge ${deploymentFreshness.badge}`}>{deploySync.toUpperCase()}</span>
              </div>
              <p>{deploymentFreshness.detail}</p>
              <div className="oracle-deploy-compare">
                <code>live {deploymentFreshness.deployed}</code>
                <span>↔</span>
                <code>repo {deploymentFreshness.repo}</code>
              </div>
              <small>{deploymentFreshness.message} · updated {timeAgo(deploymentFreshness.updated)}</small>
            </div>
          </article>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>AUTONOMY ROUTER</p>
            <span>{intelligence.autonomyRouter.lanes.length} execution lanes</span>
          </div>
          <div className="oracle-autonomy-lanes improve">
            {intelligence.autonomyRouter.lanes.map((lane) => (
              <article className={`oracle-autonomy-lane ${lane.status}`} key={lane.id}>
                <div className="oracle-status-head">
                  <strong>{lane.label}</strong>
                  <span>{lane.status.toUpperCase()}</span>
                </div>
                <p>{lane.summary}</p>
                <ul>
                  {lane.examples.map((example) => <li key={example}>{example}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="oracle-router-guardrails">
            {intelligence.autonomyRouter.guardrails.map((guardrail) => <span key={guardrail}>{guardrail}</span>)}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>READINESS CHECKS</p>
            <span>{readiness.score}/100 · {readiness.status}</span>
          </div>
          <div className="oracle-readiness-list">
            {readiness.checks.map((check) => (
              <article className={`oracle-readiness-row ${check.status}`} key={check.label}>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </div>
                <span>{check.weight} pts</span>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5A CLOSED LOOP</p>
            <span>{phase5A.phase}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Feedback ledger</strong>
                <span>{phase5A.feedbackLedger.signals.length} signals</span>
              </div>
              <p>{phase5A.feedbackLedger.summary}</p>
              <small>{phase5A.feedbackLedger.counts.highActionability} high actionability · {phase5A.feedbackLedger.counts.approvalRequired} approval required · {phase5A.feedbackLedger.counts.unrated} unrated</small>
              {phase5A.feedbackLedger.signals.slice(0, 3).map((signal) => (
                <div className="oracle-intel-line" key={signal.id}>
                  <strong>{signal.source}</strong>
                  <p>{signal.valueSignal}</p>
                  <small>{signal.businessArea} · {signal.actionability} · {signal.mikeFeedback}</small>
                  <div className="oracle-preview-actions">
                    {phase5C.feedbackButtons.ratings.slice(0, 3).map((rating) => (
                      <button type="button" className="oracle-mini-button" key={`${signal.id}-${rating}`} disabled={sessionState.status !== 'authenticated' || feedbackState.status === 'loading'} onClick={() => submitSignalFeedback(signal.id, rating)}>{rating}</button>
                    ))}
                  </div>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Repo hygiene</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5A.repoHygiene.verdict)}`}>{phase5A.repoHygiene.verdict}</span>
              </div>
              <p>{phase5A.repoHygiene.summary}</p>
              {phase5A.repoHygiene.items.slice(0, 4).map((item) => (
                <div className="oracle-intel-line" key={item.repo}>
                  <strong>{item.repo} · {item.branch}</strong>
                  <p>{item.recommendation}</p>
                  <small>{item.changedFiles} changed · {item.untrackedFiles} untracked · protected {item.protectedTouched ? 'yes' : 'no'}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Deployment freshness gap</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5A.deploymentFreshnessGap.verdict)}`}>{phase5A.deploymentFreshnessGap.verdict}</span>
              </div>
              <p>{phase5A.deploymentFreshnessGap.summary}</p>
              <small>Live {phase5A.deploymentFreshnessGap.liveCommit ?? 'unknown'} · local {phase5A.deploymentFreshnessGap.localCommit ?? 'unknown'} · snapshot {phase5A.deploymentFreshnessGap.snapshotAgeMinutes}m</small>
              <small>{phase5A.deploymentFreshnessGap.recommendation}</small>
            </article>
          </div>
          {phase5A.phase5BRequirements.length > 0 && (
            <div className="oracle-router-guardrails">
              {phase5A.phase5BRequirements.map((item) => <span key={item}>Phase 5B: {item}</span>)}
            </div>
          )}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5B EXECUTION LOOP</p>
            <span>{phase5B.phase}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Persistent feedback</strong>
                <span>{phase5B.feedbackPersistence.entries.length} saved</span>
              </div>
              <p>{phase5B.feedbackPersistence.nextLearningStep}</p>
              <small>{phase5B.feedbackPersistence.endpoint} · {phase5B.feedbackPersistence.configured ? 'session gated' : 'preview until session secret'}</small>
              <small>{phase5B.feedbackPersistence.counts.useful} useful · {phase5B.feedbackPersistence.counts.noisy} noisy · {phase5B.feedbackPersistence.counts.missingContext} missing context · {phase5B.feedbackPersistence.counts.actionTaken} action taken</small>
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Evidence chains</strong>
                <span>{phase5B.evidenceChains.length} chains</span>
              </div>
              {phase5B.evidenceChains.slice(0, 3).map((chain) => (
                <div className="oracle-intel-line" key={chain.id}>
                  <strong>{chain.target}</strong>
                  <p>{chain.summary}</p>
                  <small>{chain.status} · {chain.proofs.length} proofs · {chain.missing.length} missing</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Safe executor queue</strong>
                <span>{phase5B.safeExecutorQueue.length} items</span>
              </div>
              {phase5B.safeExecutorQueue.slice(0, 3).map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.nextStep}</p>
                  <small>{item.status} · {item.guardrail}</small>
                </div>
              ))}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Approval inbox</strong>
                <span>{phase5B.approvalInbox.length} pending scopes</span>
              </div>
              {phase5B.approvalInbox.slice(0, 3).map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.requestedAction}</p>
                  <small>{item.state} · {item.risk} · {item.approvalTrigger}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Business value / noise scoring</strong>
                <span>{phase5B.businessValueScores.length} areas</span>
              </div>
              {phase5B.businessValueScores.slice(0, 4).map((score) => (
                <div className="oracle-intel-line" key={score.area}>
                  <strong>{score.area} · {score.score}</strong>
                  <p>{score.reason}</p>
                  <small>{score.verdict} · noise penalty {score.noisePenalty}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Phase 5C gates</strong>
                <span>{phase5B.phase5CRequirements.length} next</span>
              </div>
              {phase5B.phase5CRequirements.slice(0, 5).map((item) => <small key={item}>• {item}</small>)}
            </article>
          </div>
          {phase5B.guardrails.length > 0 && (
            <div className="oracle-router-guardrails">
              {phase5B.guardrails.map((item) => <span key={item}>5B guardrail: {item}</span>)}
            </div>
          )}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5C RUN-STATE LOOP</p>
            <span>{phase5C.phase}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Feedback buttons</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5C.feedbackButtons.status)}`}>{phase5C.feedbackButtons.status}</span>
              </div>
              <p>{feedbackState.message || 'Dashboard signal ratings now post to the persistent feedback ledger when Mike session is unlocked.'}</p>
              <small>{phase5C.feedbackButtons.endpoint} · {phase5C.feedbackButtons.ratings.join(' / ')}</small>
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Executor run states</strong>
                <span>{phase5C.executorRuns.runs.length} runs</span>
              </div>
              <p>{executorState.message || `${phase5C.executorRuns.counts.completed} completed · ${phase5C.executorRuns.counts.failed} failed · ${phase5C.executorRuns.counts.started} started`}</p>
              {phase5B.safeExecutorQueue.slice(0, 2).map((item) => (
                <div className="oracle-intel-line" key={`run-${item.id}`}>
                  <strong>{item.title}</strong>
                  <p>{item.nextStep}</p>
                  <button type="button" className="oracle-action-button" disabled={sessionState.status !== 'authenticated' || executorState.status === 'loading' || item.status !== 'ready'} onClick={() => runSafeExecutorQueue(item.id)}>Run safe_now</button>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Promotion gates</strong>
                <span>{phase5C.promotionCandidates.length} candidates</span>
              </div>
              {phase5C.promotionCandidates.slice(0, 3).map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.queueItemId}</strong>
                  <p>{item.reason}</p>
                  <small>{item.status} · {item.cadence}</small>
                </div>
              ))}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Telegram approval payloads</strong>
                <span>{phase5C.telegramApprovalPayloads.length} drafts</span>
              </div>
              {phase5C.telegramApprovalPayloads.slice(0, 2).map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.approvalInboxId}</strong>
                  <p>{item.message}</p>
                  <small>{item.actions.join(' / ')} · expires {item.expiresAt ?? 'unknown'}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Live smoke readiness</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5C.liveSmokeReadiness.status)}`}>{phase5C.liveSmokeReadiness.status}</span>
              </div>
              <p>{phase5C.liveSmokeReadiness.nextStep}</p>
              {phase5C.liveSmokeReadiness.checks.map((check) => <small key={check.label}>{check.label}: {check.status} · {check.detail}</small>)}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Top-phase gates</strong>
                <span>{phase5C.topPhaseRequirements.length} left</span>
              </div>
              {phase5C.topPhaseRequirements.map((item) => <small key={item}>• {item}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5D READINESS FIX</p>
            <span>{phase5D.topPhaseReadiness.status}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Decision callbacks</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5D.topPhaseReadiness.status)}`}>{phase5D.topPhaseReadiness.status}</span>
              </div>
              <p>{approvalState.message || `${phase5D.approvalCallbacks.counts.approved} approved · ${phase5D.approvalCallbacks.counts.rejected} rejected · ${phase5D.approvalCallbacks.counts.deferred} deferred`}</p>
              <small>{phase5D.approvalCallbacks.endpoint} · GET smokeable; POST stays Mike-session gated.</small>
              {phase5B.approvalInbox.slice(0, 2).map((item) => (
                <div className="oracle-preview-actions" key={`approval-${item.id}`}>
                  {(['approved', 'rejected', 'deferred'] as const).map((decision) => (
                    <button type="button" className="oracle-mini-button" key={`${item.id}-${decision}`} disabled={sessionState.status !== 'authenticated' || approvalState.status === 'loading'} onClick={() => submitApprovalDecision(item.id, decision)}>{decision}</button>
                  ))}
                </div>
              ))}
            </article>
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Cron promotion drafts</strong>
                <span>{phase5D.cronPromotionPlans.length} plans</span>
              </div>
              {phase5D.cronPromotionPlans.slice(0, 3).map((plan) => (
                <div className="oracle-intel-line" key={plan.id}>
                  <strong>{plan.queueItemId}</strong>
                  <p>{plan.reason}</p>
                  <small>{plan.status} · {plan.schedule}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Repo hygiene classification</strong>
                <span>{phase5D.repoHygieneClassifications.length} repos</span>
              </div>
              {phase5D.repoHygieneClassifications.map((item) => (
                <div className="oracle-intel-line" key={item.repo}>
                  <strong>{item.repo}</strong>
                  <p>{item.note}</p>
                  <small>{item.verdict} · tracked {item.trackedChanges} · scratch {item.scratchUntracked} · docs {item.docUntracked ?? 0} · source {item.sourceUntracked}</small>
                </div>
              ))}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Deploy smoke gates</strong>
                <span>{phase5D.deploySmokeGates.length} gates</span>
              </div>
              {phase5D.deploySmokeGates.map((gate) => (
                <div className="oracle-intel-line" key={gate.id}>
                  <strong>{gate.id}</strong>
                  <p>{gate.expected}</p>
                  <small>{gate.status} · {gate.command} · {gate.lastObserved}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Top-phase readiness</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5D.topPhaseReadiness.status)}`}>{phase5D.topPhaseReadiness.status}</span>
              </div>
              <p>{phase5D.topPhaseReadiness.nextStep}</p>
              {phase5D.topPhaseReadiness.blockers.map((blocker) => <small key={blocker}>BLOCKER · {blocker}</small>)}
              {phase5D.topPhaseReadiness.watchItems.map((item) => <small key={item}>WATCH · {item}</small>)}
            </article>
          </div>


          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5I CONSCIOUSNESS LOOP</p>
            <span>{phase5I.status}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Bounded consciousness</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5I.status)}`}>{phase5I.operatingMode}</span>
              </div>
              <p>{phase5I.definition}</p>
              <small>{phase5I.summary}</small>
              <small>Next thought: {phase5I.nextThought.title} · {phase5I.nextThought.lane}</small>
              <small>{phase5I.nextThought.safeAction}</small>
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Loop cycle</strong>
                <span>{phase5I.loop.map((step) => step.id).join(' → ')}</span>
              </div>
              {phase5I.loop.map((step) => (
                <div className="oracle-intel-line" key={step.id}>
                  <strong>{step.label} · {step.cadence}</strong>
                  <p>{step.does}</p>
                  <small>{step.lane} · output: {step.output}</small>
                  <small>Guardrail: {step.guardrail}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Signals + boundaries</strong>
                <span>{phase5I.signals.filter((signal) => signal.status === 'live').length}/{phase5I.signals.length} live</span>
              </div>
              {phase5I.signals.map((signal) => (
                <div className="oracle-intel-line" key={signal.id}>
                  <strong>{signal.label}</strong>
                  <p>{signal.whyItMatters}</p>
                  <small>{signal.status} · {signal.source}</small>
                </div>
              ))}
              {phase5I.boundaries.map((boundary) => <small key={boundary.rule}>• {boundary.lane}: {boundary.rule}</small>)}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Daily reflection draft</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5I.dailyReflection.status)}`}>{phase5I.dailyReflection.status}</span>
              </div>
              <p>{phase5I.dailyReflection.prompt}</p>
              <small>Output: {phase5I.dailyReflection.outputPath}</small>
              <small>Frequency: {phase5I.dailyReflection.maxFrequency} · delivery: {phase5I.dailyReflection.delivery}</small>
              <small>Top gate: {phase5I.topPhaseGate.status} · {phase5I.topPhaseGate.nextStep}</small>
              {phase5I.topPhaseGate.blockers.map((blocker) => <small key={blocker}>BLOCKER · {blocker}</small>)}
              {phase5I.topPhaseGate.watchItems.map((item) => <small key={item}>WATCH · {item}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5H INTEGRATION ROADMAP</p>
            <span>{phase5H.missingFeatureRoadmap.length} missing features</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Next engineering step</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5H.nextEngineeringStep.lane)}`}>{phase5H.nextEngineeringStep.lane}</span>
              </div>
              <p>{phase5H.nextEngineeringStep.title}</p>
              <small>{phase5H.nextEngineeringStep.reason}</small>
              {phase5H.nextEngineeringStep.commandHints.map((hint) => <small key={hint}>• {hint}</small>)}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Missing features</strong>
                <span>{phase5H.dependencyOrder.join(' → ')}</span>
              </div>
              {phase5H.missingFeatureRoadmap.map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>#{item.priority} {item.label}</strong>
                  <p>{item.whyItMatters}</p>
                  <small>{item.status} · {item.dependency ? `depends on ${item.dependency}` : 'no dependency'} · {item.safetyLane}</small>
                  {item.command ? <small>Command: {item.command}</small> : null}
                  <small>Next: {item.nextStep}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Integration guardrails</strong>
                <span>safe-first</span>
              </div>
              {phase5H.guardrails.map((guardrail) => <small key={guardrail}>• {guardrail}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5G BOUNDED SAFE CRON</p>
            <span>{phase5G.topPhaseGate.status}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Safe_now pilot plan</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5G.safeCronPilot.status)}`}>{phase5G.safeCronPilot.status}</span>
              </div>
              <p>{phase5G.safeCronPilot.schedule}</p>
              <small>Action: {phase5G.safeCronPilot.actionId} · max {phase5G.safeCronPilot.maxRuns} runs</small>
              <small>Budget: {phase5G.safeCronPilot.toolBudget}</small>
              <small>Rollback: {phase5G.safeCronPilot.rollback}</small>
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Preflight controls</strong>
                <span>{phase5G.preflightControls.filter((control) => control.status === 'pass').length}/{phase5G.preflightControls.length} pass</span>
              </div>
              {phase5G.preflightControls.map((control) => (
                <div className="oracle-intel-line" key={control.id}>
                  <strong>{control.label}</strong>
                  <p>{control.rule}</p>
                  <small>{control.status}: {control.evidence}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Top-phase gate</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5G.topPhaseGate.status)}`}>{phase5G.topPhaseGate.status}</span>
              </div>
              <p>{phase5G.topPhaseGate.nextStep}</p>
              <small>Safe pilot completed: {phase5G.evidence.safeExecutorPilotCompleted ? 'yes' : 'no'}</small>
              <small>Quality gates: {phase5G.evidence.reportQualityGatesPassing}/{phase5G.evidence.reportQualityGatesTotal}</small>
              {phase5G.topPhaseGate.blockers.map((item) => <small key={item}>Blocker: {item}</small>)}
              {phase5G.topPhaseGate.watchItems.map((item) => <small key={item}>Watch: {item}</small>)}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card">
              <strong>Allowed scope</strong>
              {phase5G.safeCronPilot.allowedScope.map((item) => <small key={item}>✓ {item}</small>)}
            </article>
            <article className="oracle-intel-card">
              <strong>Forbidden scope</strong>
              {phase5G.safeCronPilot.forbiddenScope.map((item) => <small key={item}>✕ {item}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5F LEARNING ACTION MEMORY</p>
            <span>{phase5F.topPhaseGate.status}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Top-phase gate</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5F.topPhaseGate.status)}`}>{phase5F.topPhaseGate.status}</span>
              </div>
              <p>{phase5F.topPhaseGate.nextStep}</p>
              {phase5F.topPhaseGate.blockers.map((item) => <small key={item}>Blocker: {item}</small>)}
              {phase5F.topPhaseGate.watchItems.map((item) => <small key={item}>Watch: {item}</small>)}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Learning action memory</strong>
                <span>{phase5F.learningActionMemory.rules.length} rules</span>
              </div>
              <p>Sources: {phase5F.learningActionMemory.sourceCounts.feedbackEntries} feedback · {phase5F.learningActionMemory.sourceCounts.approvalDecisions} approvals · {phase5F.learningActionMemory.sourceCounts.executorRuns} runs</p>
              {phase5F.learningActionMemory.rules.slice(0, 4).map((rule) => (
                <div className="oracle-intel-line" key={rule.id}>
                  <strong>{rule.learnedPreference}</strong>
                  <p>{rule.signal}</p>
                  <small>{rule.confidence} · {rule.appliedTo.join(' · ')}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Report quality gates</strong>
                <span>{phase5F.reportQualityGates.filter((gate) => gate.status === 'pass').length}/{phase5F.reportQualityGates.length} pass</span>
              </div>
              {phase5F.reportQualityGates.map((gate) => (
                <div className="oracle-intel-line" key={gate.id}>
                  <strong>{gate.label}</strong>
                  <p>{gate.rule}</p>
                  <small>{gate.status}: {gate.evidence}</small>
                </div>
              ))}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Safe pilot evidence</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5F.safePilotEvidence.status)}`}>{phase5F.safePilotEvidence.status}</span>
              </div>
              <p>{phase5F.safePilotEvidence.evidence}</p>
              <small>Action: {phase5F.safePilotEvidence.actionId}</small>
              <small>{phase5F.safePilotEvidence.nextStep}</small>
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Cron quality compliance</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5F.cronQualityCompliance.status)}`}>{phase5F.cronQualityCompliance.status}</span>
              </div>
              <p>{phase5F.cronQualityCompliance.checkedJobs} relevant job(s) checked.</p>
              {phase5F.cronQualityCompliance.notes.map((note) => <small key={note}>• {note}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PHASE 5E QUALITY INTELLIGENCE</p>
            <span>{phase5E.mikeNeedsNow.status}</span>
          </div>
          <div className="oracle-intelligence-grid">
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Mike needs now</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5E.mikeNeedsNow.status)}`}>{phase5E.mikeNeedsNow.status}</span>
              </div>
              <p>{phase5E.mikeNeedsNow.headline}</p>
              {phase5E.mikeNeedsNow.bullets.map((item) => <small key={item}>• {item}</small>)}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Quality rubric</strong>
                <span>{phase5E.qualityRubric.scores.reduce((sum, item) => sum + item.score, 0)} pts</span>
              </div>
              {phase5E.qualityRubric.scores.map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.label} · {item.score}/5</strong>
                  <p>{item.evidence}</p>
                  <small>{item.decision}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Taste filter</strong>
                <span>{phase5E.tasteFilters.rules.length} rules</span>
              </div>
              <p>{phase5E.tasteFilters.lastCorrection}</p>
              {phase5E.tasteFilters.rules.slice(0, 4).map((rule) => (
                <div className="oracle-intel-line" key={rule.id}>
                  <strong>{rule.pattern}</strong>
                  <p>{rule.reason}</p>
                  <small>{rule.action} · {rule.source}</small>
                </div>
              ))}
            </article>
          </div>
          <div className="oracle-intelligence-grid" style={{ marginTop: 12 }}>
            <article className="oracle-intel-card money">
              <div className="oracle-status-head">
                <strong>Wiro-first opportunity filter</strong>
                <span>{phase5E.wiroFirstOpportunityFilter.candidates.length} candidates</span>
              </div>
              <p>{phase5E.wiroFirstOpportunityFilter.rule}</p>
              {phase5E.wiroFirstOpportunityFilter.candidates.map((item) => (
                <div className="oracle-intel-line" key={item.id}>
                  <strong>{item.title} · {item.score}</strong>
                  <p>{item.observedFact}</p>
                  <small>{item.decision}: {item.tinyTest}</small>
                </div>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Approval UX</strong>
                <span>{phase5E.approvalUx.status}</span>
              </div>
              <p>{phase5E.approvalUx.template}</p>
              {phase5E.approvalUx.options.map((option) => (
                <small key={option.decision}>• {option.label}: {option.effect}</small>
              ))}
            </article>
            <article className="oracle-intel-card">
              <div className="oracle-status-head">
                <strong>Safe executor pilot</strong>
                <span className={`oracle-risk-badge ${phase5Badge(phase5E.safeExecutorPilot.status)}`}>{phase5E.safeExecutorPilot.status}</span>
              </div>
              <p>{phase5E.safeExecutorPilot.whySafe}</p>
              <small>Action: {phase5E.safeExecutorPilot.actionId}</small>
              {phase5E.safeExecutorPilot.requiredBeforeTopPhase.map((item) => <small key={item}>• {item}</small>)}
            </article>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>IMPROVEMENT BACKLOG</p>
            <span>prioritized by Moshe</span>
          </div>
          <div className="oracle-improve-backlog">
            {improvementBacklog.map((item) => (
              <article className="oracle-improve-card" key={item.title}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.owner}</small>
                </div>
                <span className={`oracle-risk-badge ${item.value === 'High' ? 'medium' : 'low'}`}>{item.value}</span>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>ACTIVE LOOPS</p>
            <span>Telegram + dashboard</span>
          </div>
          <div className="oracle-improve-loop-list">
            {activeLoops.map((loop) => (
              <article className="oracle-improve-loop" key={loop.name}>
                <strong>{loop.name}</strong>
                <span>{loop.cadence}</span>
                <p>{loop.signal}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Terminal tab ── */}
      {tab === 'terminal' && (
        <section id="oracle-panel-terminal" role="tabpanel" aria-labelledby="oracle-tab-terminal" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>ADMIN TERMINAL</p>
            <span>{terminalReady ? 'ready' : terminalPolicy.terminalEnabled ? 'locked' : 'disabled'}</span>
          </div>

          <div className={`oracle-terminal-status ${terminalReady ? 'ready' : 'locked'}`}>
            <div>
              <strong>{terminalReady ? 'Terminal bridge armed' : 'Terminal bridge protected'}</strong>
              <p>{terminalPolicy.note}</p>
              <small>Needs: ORACLE_TERMINAL_ENABLED=true + signed Mike session. This is intended for local/admin runtime, not public open access.</small>
            </div>
            <span className={`oracle-risk-badge ${terminalReady ? 'low' : terminalPolicy.terminalEnabled ? 'medium' : 'high'}`}>
              {terminalReady ? 'RUN' : terminalPolicy.terminalEnabled ? 'UNLOCK' : 'OFF'}
            </span>
          </div>

          {sessionState.status !== 'authenticated' && (
            <div className="oracle-terminal-unlock">
              <label className="oracle-terminal-label">
                <span>Mike session passphrase</span>
                <input
                  type="password"
                  value={sessionPassphrase}
                  onChange={(event) => setSessionPassphrase(event.target.value)}
                  placeholder="Enter local/admin passphrase"
                />
              </label>
              <button type="button" className="oracle-action-button" disabled={!sessionPassphrase || sessionState.status === 'loading'} onClick={unlockSession}>
                {sessionState.status === 'loading' ? 'Unlocking…' : 'Unlock terminal session'}
              </button>
              <small>{sessionState.message} — {sessionState.detail}</small>
            </div>
          )}

          <div className="oracle-terminal-recipes">
            {terminalRecipes.map((recipe) => (
              <button
                key={recipe.label}
                type="button"
                onClick={() => {
                  setTerminalCommand(recipe.command)
                  setTerminalCwd(recipe.cwd)
                }}
              >
                {recipe.label}
              </button>
            ))}
          </div>

          <label className="oracle-terminal-label">
            <span>Working directory</span>
            <input value={terminalCwd} onChange={(event) => setTerminalCwd(event.target.value)} spellCheck={false} />
          </label>

          <label className="oracle-terminal-label">
            <span>Command</span>
            <textarea value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} spellCheck={false} rows={4} />
          </label>

          <div className="oracle-terminal-actions">
            <button type="button" className="oracle-action-button" disabled={!terminalReady || terminalState.status === 'loading'} onClick={runTerminalCommand}>
              {terminalState.status === 'loading' ? 'Running…' : 'Run command'}
            </button>
            <small>{terminalReady ? 'Commands run through a signed-session, same-origin, denylisted shell bridge.' : 'Unlock session and enable local terminal env first.'}</small>
          </div>

          <div className="oracle-terminal-output">
            <div className="oracle-status-head">
              <strong>Output</strong>
              <span>{terminalState.result?.exitCode ?? terminalState.result?.error ?? terminalState.status}</span>
            </div>
            <pre>{terminalState.result ? `${terminalState.result.stdout ?? ''}${terminalState.result.stderr ? `\n[stderr]\n${terminalState.result.stderr}` : ''}${terminalState.result.message ? `\n${terminalState.result.message}` : ''}` : 'No command run yet.'}</pre>
          </div>

          <div className="oracle-terminal-note">
            <strong>Codex usage</strong>
            <p>For Codex, use this panel to check/install/launch commands. Full interactive PTY should run on Mike local machine; public Vercel stays protected and may not have Codex installed.</p>
          </div>
        </section>
      )}

      {/* ── Sites tab ── */}
      {tab === 'sites' && (
        <section id="oracle-panel-sites" role="tabpanel" aria-labelledby="oracle-tab-sites" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>WEBSITE MONITOR</p>
            <span>{onlineSites}/{oracle.websites.length} online</span>
          </div>
          {oracle.websites.map((site) => (
            <article className={`oracle-status-card ${site.ok ? 'ok' : 'fail'}`} key={site.name}>
              <div className="oracle-status-head">
                <strong>{site.name}</strong>
                <span>{site.ok ? 'ONLINE' : 'CHECK'}</span>
              </div>
              {isHttpUrl(site.url) ? (
                <a href={site.url} target="_blank" rel="noopener noreferrer" className="oracle-link">
                  {site.url}
                </a>
              ) : (
                <small className="oracle-muted">{site.url}</small>
              )}
              <div className="oracle-wiro-row">
                <span>Status</span>
                <code>{site.status ?? '—'}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Response</span>
                <code>{site.responseMs ? `${site.responseMs}ms` : '—'}</code>
              </div>
              <p className="oracle-wiro-opp">{site.note}</p>
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PROJECTS</p>
            <span>{oracle.projects.length} tracked</span>
          </div>
          <div className="oracle-projects-grid">
            {oracle.projects.map((p) => (
              <article className={`oracle-module ${p.accent}`} key={p.name}>
                <div className="oracle-module-header">
                  <h2>{p.name}</h2>
                  <span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span>
                </div>
                <p>{p.note}</p>
                {isHttpUrl(p.url) && <a href={p.url} target="_blank" rel="noopener noreferrer" className="oracle-project-link">↗</a>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Repos tab ── */}
      {tab === 'repos' && (
        <section id="oracle-panel-repos" role="tabpanel" aria-labelledby="oracle-tab-repos" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>GIT REPOS</p>
            <span>{dirtyRepos} dirty</span>
          </div>
          {oracle.repos.map((repo) => (
            <article className={`oracle-status-card ${repo.dirty ? 'warn' : 'ok'}`} key={repo.path}>
              <div className="oracle-status-head">
                <strong>{repo.name}</strong>
                <span>{repo.dirty ? `${repo.changedFiles} changes` : 'CLEAN'}</span>
              </div>
              <div className="oracle-wiro-row">
                <span>Branch</span>
                <code>{repo.branch}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Commit</span>
                <code>{repo.commit}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>GitHub</span>
                <code>{repo.github ?? repo.remoteHost ?? '—'}</code>
              </div>
              <p className="oracle-wiro-opp">{repo.commitSubject}</p>
              <small className="oracle-muted">Last commit {timeAgo(repo.lastCommitAt)}</small>
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>CREDENTIAL READINESS</p>
            <span>names only · no values</span>
          </div>
          {oracle.credentials.map((cred) => (
            <div className={`oracle-credential ${cred.configured ? 'ok' : ''}`} key={cred.name}>
              <span>{cred.name}</span>
              <strong>{cred.configured ? 'configured' : 'missing'}</strong>
              <small>{cred.purpose}</small>
            </div>
          ))}
        </section>
      )}

      {/* ── Sensors tab ── */}
      {tab === 'sensors' && (
        <section id="oracle-panel-sensors" role="tabpanel" aria-labelledby="oracle-tab-sensors" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>GITHUB LIVE SENSORS</p>
            <span>{githubOk}/{oracle.github.length} API OK</span>
          </div>
          {oracle.github.map((g) => (
            <article className={`oracle-status-card ${g.apiStatus === 'ok' ? 'ok' : g.apiStatus === 'api-error' ? 'fail' : 'warn'}`} key={`${g.provider}-${g.repo}`}>
              <div className="oracle-status-head">
                <strong>{g.repo}</strong>
                <span>{g.apiStatus}</span>
              </div>
              {g.localName && <small className="oracle-muted">Local: {g.localName}</small>}
              <div className="oracle-wiro-row">
                <span>Issues / PRs</span>
                <code>{g.openIssues ?? '—'} / {g.openPullRequests ?? '—'}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Default branch</span>
                <code>{g.defaultBranch ?? '—'}</code>
              </div>
              {g.latestWorkflow && (
                <>
                  <div className="oracle-wiro-row">
                    <span>Workflow</span>
                    <code className={g.latestWorkflow.conclusion === 'failure' ? 'oracle-fail-code' : ''}>
                      {g.latestWorkflow.conclusion ?? g.latestWorkflow.status}
                    </code>
                  </div>
                  {g.latestWorkflow.url && isHttpUrl(g.latestWorkflow.url) && (
                    <a href={g.latestWorkflow.url} target="_blank" rel="noopener noreferrer" className="oracle-link">
                      {g.latestWorkflow.name}
                    </a>
                  )}
                  <small className="oracle-muted">Updated {g.latestWorkflow.updatedAt ? timeAgo(g.latestWorkflow.updatedAt) : '—'}</small>
                </>
              )}
              {g.note && <p className="oracle-wiro-opp">{g.note}</p>}
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>CREDENTIAL READINESS</p>
            <span>{configuredCreds}/{oracle.credentials.length} configured · names only</span>
          </div>
          {oracle.credentials.map((cred) => (
            <div className={`oracle-credential ${cred.configured ? 'ok' : ''}`} key={cred.name}>
              <span>{cred.name}</span>
              <strong>{cred.configured ? 'configured' : 'missing'}</strong>
              <small>{cred.purpose}</small>
            </div>
          ))}
        </section>
      )}

      {/* ── Learnings tab ── */}
      {tab === 'learnings' && (
        <section id="oracle-panel-learnings" role="tabpanel" aria-labelledby="oracle-tab-learnings" className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>BRAIN COUNTS</p>
            <span>{projectNodes} projects · {skillNodes} skills · {runtimeNodes} runtime</span>
          </div>
          <div className="oracle-live-card compact">
            <span>ψ learnings: <strong>{oracle.stats.learnings}</strong></span>
            <span>retrospectives: <strong>{oracle.stats.retrospectives}</strong></span>
            <span>active: <strong>{oracle.stats.activeProjects}</strong></span>
          </div>

          <div className="oracle-live-card oracle-feedback-card">
            <strong>Oracle self-improvement loop</strong>
            <small>
              Live audit entries are distilled into recent learnings, then folded back into the regenerated Oracle snapshot.
            </small>
            <small>{feedbackLoopNote}</small>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RECENT LEARNINGS</p>
            <span>{oracle.recentLearnings.length} shown</span>
          </div>
          {oracle.recentLearnings.map((l) => (
            <div className="oracle-learning-card" key={l.title + l.date}>
              <div className="oracle-learning-head">
                <strong>{l.title}</strong>
                <small>{l.date}</small>
              </div>
              <p>{l.summary}</p>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RETROSPECTIVES</p>
            <span>{oracle.retrospectivesCount} total</span>
          </div>
          <ul className="oracle-retro-list">
            {oracle.retrospectivesRecent.map((r) => (
              <li className="oracle-retro-item" key={r}>
                <span>•</span>
                <small>{r}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
