import { randomUUID } from 'node:crypto'
import {
  appendAuditEntry,
  auditContext,
  buildSessionCookie,
  clearSessionCookie,
  constantTimeEqual,
  createSessionToken,
  getRequestBody,
  getSessionSecret,
  isSessionConfigured,
  readSession,
  responseJson,
  sameOriginPolicy,
  sessionPolicy,
  SESSION_TTL_MS,
} from './auth.js'

const AUDIT_PATH = process.env.ORACLE_ACTION_AUDIT_PATH || '/tmp/oracle-action-audit.jsonl'

function denyLogin(res, requestId, status, error, message, extra = {}) {
  return responseJson(res, status, {
    ok: false,
    requestId,
    error,
    message,
    ...extra,
  })
}

export default async function handler(req, res) {
  const requestId = randomUUID()
  const policy = sessionPolicy()

  if (req.method === 'GET') {
    const session = readSession(req)
    return responseJson(res, 200, {
      ok: true,
      requestId,
      configured: policy.configured,
      authenticated: Boolean(session),
      actor: session?.actor ?? null,
      expiresAt: session ? new Date(session.exp).toISOString() : null,
      policy,
    })
  }

  if (req.method === 'DELETE') {
    appendAuditEntry(AUDIT_PATH, {
      requestId,
      outcome: 'session-cleared',
      actor: 'Mike',
      actionId: 'oracle-session',
      detail: 'Session cookie cleared by the browser.',
      ...auditContext(req),
    })

    return responseJson(
      res,
      200,
      {
        ok: true,
        requestId,
        authenticated: false,
        message: 'Oracle session cleared.',
        policy,
      },
      {
        'Set-Cookie': clearSessionCookie(req),
      },
    )
  }

  if (req.method !== 'POST') {
    return responseJson(res, 405, {
      ok: false,
      requestId,
      error: 'method_not_allowed',
      allowedMethods: ['GET', 'POST', 'DELETE'],
    })
  }

  if (!policy.configured || !isSessionConfigured()) {
    appendAuditEntry(AUDIT_PATH, {
      requestId,
      outcome: 'denied',
      actor: 'unknown',
      actionId: 'oracle-session',
      detail: 'Session auth is not configured.',
      ...auditContext(req),
    })
    return denyLogin(res, requestId, 503, 'session_unavailable', 'Set ORACLE_SESSION_SECRET to enable the Mike-only session gate.', { policy })
  }

  const originCheck = sameOriginPolicy(req)
  if (!originCheck.ok) {
    appendAuditEntry(AUDIT_PATH, {
      requestId,
      outcome: 'denied',
      actor: 'unknown',
      actionId: 'oracle-session',
      detail: `Rejected login attempt: ${originCheck.reason}.`,
      ...auditContext(req),
    })
    return denyLogin(res, requestId, 403, 'forbidden_origin', 'Login requests must originate from the Oracle dashboard.', {
      policy,
      expectedOrigin: originCheck.expected,
    })
  }

  let body
  try {
    body = getRequestBody(req)
  } catch {
    appendAuditEntry(AUDIT_PATH, {
      requestId,
      outcome: 'denied',
      actor: 'unknown',
      actionId: 'oracle-session',
      detail: 'Login body could not be parsed as JSON.',
      ...auditContext(req),
    })
    return denyLogin(res, requestId, 400, 'invalid_json', 'Request body must be valid JSON.', { policy })
  }

  const passphrase = String(body?.passphrase ?? '').trim()
  if (!passphrase) {
    return denyLogin(res, requestId, 400, 'missing_passphrase', 'Enter the Mike-only passphrase to unlock the session.', { policy })
  }

  const secret = getSessionSecret()
  if (!constantTimeEqual(passphrase, secret)) {
    appendAuditEntry(AUDIT_PATH, {
      requestId,
      outcome: 'denied',
      actor: 'unknown',
      actionId: 'oracle-session',
      detail: 'Passphrase did not match the configured session secret.',
      ...auditContext(req),
    })
    return denyLogin(res, requestId, 401, 'unauthorized', 'Incorrect passphrase.', { policy })
  }

  const token = createSessionToken(secret, 'Mike', SESSION_TTL_MS)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  appendAuditEntry(AUDIT_PATH, {
    requestId,
    outcome: 'session-created',
    actor: 'Mike',
    actionId: 'oracle-session',
    detail: 'Mike-only signed session cookie issued.',
    ...auditContext(req),
  })

  return responseJson(
    res,
    200,
    {
      ok: true,
      requestId,
      authenticated: true,
      actor: 'Mike',
      expiresAt,
      message: 'Oracle session unlocked.',
      policy,
    },
    {
      'Set-Cookie': buildSessionCookie(token, req, SESSION_TTL_MS),
    },
  )
}
