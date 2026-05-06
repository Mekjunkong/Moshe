import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appendAuditEntry,
  auditContext,
  getRequestBody,
  readSession,
  responseJson,
  sameOriginPolicy,
  sessionPolicy,
} from './auth.js'

const ROOT = join(import.meta.dirname, '..', '..')

const SAFE_QUEUE = [
  {
    id: 'queue-refresh-oracle-snapshot',
    title: 'Refresh Oracle snapshot',
    actionId: 'refresh-oracle-snapshot',
    autonomyLevel: 'safe_now',
    command: ['node', ['scripts/generateOracleData.mjs']],
    cwd: ROOT,
    guardrail: 'local read-only snapshot regeneration only; no push, deploy, delete, spend, or customer contact',
    rollbackNote: 'Discard generated oracleLive.json diff or restore the previous committed snapshot if output looks wrong.',
  },
]

export function executorLedgerPath() {
  return process.env.ORACLE_EXECUTOR_LEDGER_PATH || '/tmp/oracle-executor-runs.jsonl'
}

export function readExecutorRuns(path = executorLedgerPath(), limit = 50) {
  if (!existsSync(path)) return []
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line)
          return {
            id: String(parsed.id || `executor-${index}`),
            queueItemId: String(parsed.queueItemId || 'unknown'),
            actionId: String(parsed.actionId || 'unknown'),
            state: ['started', 'completed', 'failed', 'skipped'].includes(parsed.state) ? parsed.state : 'failed',
            actor: String(parsed.actor || 'Mike'),
            startedAt: String(parsed.startedAt || parsed.at || new Date(0).toISOString()),
            completedAt: parsed.completedAt ? String(parsed.completedAt) : undefined,
            durationMs: Number.isFinite(parsed.durationMs) ? parsed.durationMs : undefined,
            exitCode: Number.isFinite(parsed.exitCode) ? parsed.exitCode : undefined,
            summary: String(parsed.summary || '').slice(0, 500),
            rollbackNote: String(parsed.rollbackNote || '').slice(0, 500),
          }
        } catch {
          return {
            id: `executor-${index}`,
            queueItemId: 'parse-error',
            actionId: 'parse-error',
            state: 'failed',
            actor: 'unknown',
            startedAt: new Date(0).toISOString(),
            summary: 'An executor ledger line could not be parsed.',
            rollbackNote: 'Ignore malformed run record and inspect raw ledger.',
          }
        }
      })
  } catch {
    return []
  }
}

function executorPolicy() {
  const session = sessionPolicy()
  return {
    enabled: session.configured,
    endpoint: '/api/oracle/executor',
    authMethod: session.authMethod,
    sessionConfigured: session.configured,
    pathLabel: executorLedgerPath().replace(/^.*\//, ''),
    queue: SAFE_QUEUE.map(({ command, cwd, ...item }) => item),
    note: 'Executor accepts safe_now queue items only, requires same-origin signed Mike session, and writes started/completed/failed run states.',
  }
}

function writeRun(path, entry) {
  appendAuditEntry(path, entry)
}

export default async function oracleExecutorHandler(req, res) {
  const requestId = randomUUID()
  const method = String(req.method || 'GET').toUpperCase()
  const path = executorLedgerPath()

  if (method === 'GET') {
    return responseJson(res, 200, {
      ok: true,
      requestId,
      policy: executorPolicy(),
      runs: readExecutorRuns(path, 25),
    })
  }

  if (method !== 'POST') {
    return responseJson(res, 405, { ok: false, requestId, error: 'method_not_allowed', message: 'Use GET or POST.' })
  }

  const sameOrigin = sameOriginPolicy(req)
  if (!sameOrigin.ok) {
    return responseJson(res, 403, { ok: false, requestId, error: 'forbidden_origin', sameOrigin })
  }

  const session = readSession(req)
  if (!session) {
    return responseJson(res, 401, { ok: false, requestId, error: 'unauthorized', message: 'Mike signed session required before running safe executor queue.' })
  }

  const body = getRequestBody(req)
  const queueItemId = String(body.queueItemId || '').trim()
  const confirm = body.confirm === true
  const item = SAFE_QUEUE.find((entry) => entry.id === queueItemId)

  if (!item) {
    return responseJson(res, 404, { ok: false, requestId, error: 'unknown_queue_item', message: 'Only allowlisted safe_now queue items can run.' })
  }
  if (item.autonomyLevel !== 'safe_now') {
    return responseJson(res, 428, { ok: false, requestId, error: 'not_safe_now', message: 'Executor only accepts safe_now items.' })
  }
  if (!confirm) {
    return responseJson(res, 428, { ok: false, requestId, error: 'confirmation_required', message: 'confirm=true is required before safe executor run.' })
  }

  const startedAt = new Date().toISOString()
  writeRun(path, {
    id: requestId,
    queueItemId: item.id,
    actionId: item.actionId,
    state: 'started',
    actor: session.actor || 'Mike',
    startedAt,
    summary: `Started ${item.title}`,
    rollbackNote: item.rollbackNote,
    ...auditContext(req, {}),
  })

  const started = Date.now()
  try {
    const [cmd, args] = item.command
    const output = execFileSync(cmd, args, {
      cwd: item.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      env: { ...process.env },
    })
    const durationMs = Date.now() - started
    const completedAt = new Date().toISOString()
    const completed = {
      id: requestId,
      queueItemId: item.id,
      actionId: item.actionId,
      state: 'completed',
      actor: session.actor || 'Mike',
      startedAt,
      completedAt,
      durationMs,
      exitCode: 0,
      summary: String(output || 'Safe executor command completed.').split('\n').slice(0, 3).join(' · ').slice(0, 500),
      rollbackNote: item.rollbackNote,
      ...auditContext(req, {}),
    }
    writeRun(path, completed)
    return responseJson(res, 202, {
      ok: true,
      requestId,
      decision: 'completed',
      run: completed,
      policy: executorPolicy(),
    })
  } catch (error) {
    const durationMs = Date.now() - started
    const completedAt = new Date().toISOString()
    const failed = {
      id: requestId,
      queueItemId: item.id,
      actionId: item.actionId,
      state: 'failed',
      actor: session.actor || 'Mike',
      startedAt,
      completedAt,
      durationMs,
      exitCode: Number.isFinite(error?.status) ? error.status : 1,
      summary: String(error?.stderr || error?.message || error).slice(0, 500),
      rollbackNote: item.rollbackNote,
      ...auditContext(req, {}),
    }
    writeRun(path, failed)
    return responseJson(res, 500, { ok: false, requestId, error: 'executor_failed', run: failed })
  }
}
