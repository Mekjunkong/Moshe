import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import {
  appendAuditEntry,
  auditContext,
  getRequestBody,
  readSession,
  responseJson,
  sameOriginPolicy,
  sessionPolicy,
} from './auth.js'

const DECISIONS = new Set(['approved', 'rejected', 'deferred', 'expired'])
const SOURCES = new Set(['dashboard', 'telegram', 'api'])

export function approvalLedgerPath() {
  return process.env.ORACLE_APPROVAL_LEDGER_PATH || '/tmp/oracle-approval-decisions.jsonl'
}

export function readApprovalDecisions(path = approvalLedgerPath(), limit = 50) {
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
            id: String(parsed.id || `approval-${index}`),
            approvalInboxId: String(parsed.approvalInboxId || 'unknown'),
            decision: DECISIONS.has(parsed.decision) ? parsed.decision : 'deferred',
            actor: String(parsed.actor || 'Mike'),
            source: SOURCES.has(parsed.source) ? parsed.source : 'api',
            note: String(parsed.note || '').slice(0, 500),
            createdAt: String(parsed.createdAt || parsed.at || new Date(0).toISOString()),
          }
        } catch {
          return {
            id: `approval-${index}`,
            approvalInboxId: 'parse-error',
            decision: 'deferred',
            actor: 'unknown',
            source: 'api',
            note: 'An approval ledger line could not be parsed.',
            createdAt: new Date(0).toISOString(),
          }
        }
      })
  } catch {
    return []
  }
}

function approvalCounts(decisions) {
  return {
    approved: decisions.filter((entry) => entry.decision === 'approved').length,
    rejected: decisions.filter((entry) => entry.decision === 'rejected').length,
    deferred: decisions.filter((entry) => entry.decision === 'deferred').length,
    expired: decisions.filter((entry) => entry.decision === 'expired').length,
  }
}

function approvalPolicy() {
  const session = sessionPolicy()
  return {
    enabled: session.configured,
    endpoint: '/api/oracle/approval',
    authMethod: session.authMethod,
    sessionConfigured: session.configured,
    pathLabel: approvalLedgerPath().replace(/^.*\//, ''),
    allowedDecisions: Array.from(DECISIONS),
    allowedSources: Array.from(SOURCES),
    note: 'Approval callbacks require same-origin POST plus a valid Mike signed session cookie. Telegram payloads are drafts until routed through this endpoint.',
  }
}

export default async function oracleApprovalHandler(req, res) {
  const requestId = randomUUID()
  const method = String(req.method || 'GET').toUpperCase()
  const path = approvalLedgerPath()

  if (method === 'GET') {
    const decisions = readApprovalDecisions(path, 25)
    return responseJson(res, 200, {
      ok: true,
      requestId,
      policy: approvalPolicy(),
      decisions,
      counts: approvalCounts(decisions),
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
    return responseJson(res, 401, { ok: false, requestId, error: 'unauthorized', message: 'Mike signed session required before recording an approval decision.' })
  }

  const body = getRequestBody(req)
  const approvalInboxId = String(body.approvalInboxId || '').trim().slice(0, 160)
  const decision = String(body.decision || '').trim()
  const source = String(body.source || 'dashboard').trim()
  const note = String(body.note || '').trim().slice(0, 500)

  if (!approvalInboxId) {
    return responseJson(res, 400, { ok: false, requestId, error: 'missing_approval_id', message: 'approvalInboxId is required.' })
  }
  if (!DECISIONS.has(decision)) {
    return responseJson(res, 400, { ok: false, requestId, error: 'invalid_decision', allowedDecisions: Array.from(DECISIONS) })
  }

  const entry = {
    id: requestId,
    approvalInboxId,
    decision,
    actor: session.actor || 'Mike',
    source: SOURCES.has(source) ? source : 'api',
    note,
    createdAt: new Date().toISOString(),
    ...auditContext(req, {}),
  }
  appendAuditEntry(path, entry)

  return responseJson(res, 201, {
    ok: true,
    requestId,
    message: `Approval decision recorded: ${decision}.`,
    decision: {
      id: entry.id,
      approvalInboxId: entry.approvalInboxId,
      decision: entry.decision,
      actor: entry.actor,
      source: entry.source,
      note: entry.note,
      createdAt: entry.createdAt,
    },
    counts: approvalCounts(readApprovalDecisions(path, 50)),
  })
}
