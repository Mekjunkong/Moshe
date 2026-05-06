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

const RATINGS = new Set(['useful', 'noisy', 'missing-context', 'action-taken', 'ignored'])
const SOURCES = new Set(['dashboard', 'telegram', 'api', 'imported'])

export function feedbackLedgerPath() {
  return process.env.ORACLE_FEEDBACK_LEDGER_PATH || '/tmp/oracle-feedback-ledger.jsonl'
}

export function readFeedbackEntries(path = feedbackLedgerPath(), limit = 50) {
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
            id: String(parsed.id || `feedback-${index}`),
            signalId: String(parsed.signalId || 'unknown'),
            rating: RATINGS.has(parsed.rating) ? parsed.rating : 'missing-context',
            note: String(parsed.note || '').slice(0, 500),
            source: SOURCES.has(parsed.source) ? parsed.source : 'api',
            actor: String(parsed.actor || 'Mike'),
            createdAt: String(parsed.createdAt || parsed.at || new Date(0).toISOString()),
          }
        } catch {
          return {
            id: `feedback-${index}`,
            signalId: 'parse-error',
            rating: 'missing-context',
            note: 'A feedback ledger line could not be parsed.',
            source: 'imported',
            actor: 'unknown',
            createdAt: new Date(0).toISOString(),
          }
        }
      })
  } catch {
    return []
  }
}

function feedbackPolicy() {
  const session = sessionPolicy()
  return {
    enabled: session.configured,
    endpoint: '/api/oracle/feedback',
    authMethod: session.authMethod,
    sessionConfigured: session.configured,
    pathLabel: feedbackLedgerPath().replace(/^.*\//, ''),
    allowedRatings: Array.from(RATINGS),
    note: 'Feedback writes require same-origin POST plus a valid Mike signed session cookie.',
  }
}

function feedbackCounts(entries) {
  return {
    useful: entries.filter((entry) => entry.rating === 'useful').length,
    noisy: entries.filter((entry) => entry.rating === 'noisy').length,
    missingContext: entries.filter((entry) => entry.rating === 'missing-context').length,
    actionTaken: entries.filter((entry) => entry.rating === 'action-taken').length,
    ignored: entries.filter((entry) => entry.rating === 'ignored').length,
  }
}

export default async function oracleFeedbackHandler(req, res) {
  const requestId = randomUUID()
  const method = String(req.method || 'GET').toUpperCase()
  const path = feedbackLedgerPath()

  if (method === 'GET') {
    const entries = readFeedbackEntries(path, 25)
    return responseJson(res, 200, {
      ok: true,
      requestId,
      policy: feedbackPolicy(),
      entries,
      counts: feedbackCounts(entries),
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
    return responseJson(res, 401, { ok: false, requestId, error: 'unauthorized', message: 'Mike signed session required before writing feedback.' })
  }

  const body = getRequestBody(req)
  const signalId = String(body.signalId || '').trim().slice(0, 120)
  const rating = String(body.rating || '').trim()
  const source = String(body.source || 'dashboard').trim()
  const note = String(body.note || '').trim().slice(0, 500)

  if (!signalId) {
    return responseJson(res, 400, { ok: false, requestId, error: 'missing_signal_id', message: 'signalId is required.' })
  }
  if (!RATINGS.has(rating)) {
    return responseJson(res, 400, { ok: false, requestId, error: 'invalid_rating', allowedRatings: Array.from(RATINGS) })
  }

  const entry = {
    id: requestId,
    signalId,
    rating,
    note,
    source: SOURCES.has(source) ? source : 'api',
    actor: session.actor || 'Mike',
    createdAt: new Date().toISOString(),
    ...auditContext(req, {}),
  }
  appendAuditEntry(path, entry)

  return responseJson(res, 201, {
    ok: true,
    requestId,
    message: 'Feedback recorded into the persistent Oracle ledger.',
    entry: {
      id: entry.id,
      signalId: entry.signalId,
      rating: entry.rating,
      note: entry.note,
      source: entry.source,
      actor: entry.actor,
      createdAt: entry.createdAt,
    },
    counts: feedbackCounts(readFeedbackEntries(path, 50)),
  })
}
