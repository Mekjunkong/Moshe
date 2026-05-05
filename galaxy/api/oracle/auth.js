import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'oracle_session'
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000
export const SESSION_TTL_MINUTES = SESSION_TTL_MS / 60000
export const ORACLE_SESSION_ENDPOINT = '/api/oracle/session'

function firstHeader(req, name) {
  const value = req?.headers?.[name] ?? req?.headers?.[name.toLowerCase()] ?? ''
  return Array.isArray(value) ? value[0] : String(value)
}

export function getSessionSecret() {
  return String(process.env.ORACLE_SESSION_SECRET ?? '').trim()
}

export function isSessionConfigured() {
  return getSessionSecret().length > 0
}

export function sameOriginPolicy(req) {
  const headerOrigin = firstHeader(req, 'origin')
  const headerReferer = firstHeader(req, 'referer')
  const rawOrigin = headerOrigin || headerReferer
  if (!rawOrigin) {
    return { ok: false, expected: expectedOrigin(req), actual: '', reason: 'missing_origin' }
  }

  let actual = ''
  try {
    actual = new URL(rawOrigin).origin
  } catch {
    return { ok: false, expected: expectedOrigin(req), actual: rawOrigin, reason: 'invalid_origin' }
  }

  const expected = expectedOrigin(req)
  if (!expected || actual !== expected) {
    return { ok: false, expected, actual, reason: 'origin_mismatch' }
  }

  return { ok: true, expected, actual, reason: 'ok' }
}

export function expectedOrigin(req) {
  const protoHeader = firstHeader(req, 'x-forwarded-proto')
  const hostHeader = firstHeader(req, 'x-forwarded-host') || firstHeader(req, 'host')
  if (!hostHeader) return ''

  const proto = protoHeader.split(',')[0].trim() || (req?.socket?.encrypted ? 'https' : 'http') || 'http'
  const host = hostHeader.split(',')[0].trim()
  return `${proto}://${host}`
}

export function constantTimeEqual(left, right) {
  const a = createHash('sha256').update(String(left)).digest()
  const b = createHash('sha256').update(String(right)).digest()
  return timingSafeEqual(a, b)
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(secret, actor = 'Mike', ttlMs = SESSION_TTL_MS) {
  const now = Date.now()
  const payload = {
    id: randomUUID(),
    actor,
    iat: now,
    exp: now + ttlMs,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function verifySessionToken(token, secret) {
  if (!token || !secret) return null
  const [encodedPayload, signature] = String(token).split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = signPayload(encodedPayload, secret)
  if (!constantTimeEqual(signature, expectedSignature)) return null

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload))
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.exp !== 'number' || typeof parsed.iat !== 'number') return null
    if (parsed.exp <= Date.now()) return null
    return {
      id: String(parsed.id ?? ''),
      actor: String(parsed.actor ?? 'Mike'),
      iat: parsed.iat,
      exp: parsed.exp,
    }
  } catch {
    return null
  }
}

export function readCookies(req) {
  const cookieHeader = firstHeader(req, 'cookie')
  if (!cookieHeader) return {}

  return cookieHeader.split(/;\s*/).reduce((acc, pair) => {
    const index = pair.indexOf('=')
    if (index < 0) return acc
    const key = decodeURIComponent(pair.slice(0, index).trim())
    const value = decodeURIComponent(pair.slice(index + 1).trim())
    acc[key] = value
    return acc
  }, {})
}

export function readSession(req) {
  const secret = getSessionSecret()
  if (!secret) return null
  const cookies = readCookies(req)
  return verifySessionToken(cookies[SESSION_COOKIE_NAME], secret)
}

export function buildSessionCookie(token, req, ttlMs = SESSION_TTL_MS) {
  const secure = firstHeader(req, 'x-forwarded-proto').split(',')[0].trim() === 'https' || Boolean(req?.socket?.encrypted)
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(ttlMs / 1000)}`,
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(req) {
  const secure = firstHeader(req, 'x-forwarded-proto').split(',')[0].trim() === 'https' || Boolean(req?.socket?.encrypted)
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Strict',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function sessionPolicy() {
  const configured = isSessionConfigured()
  return {
    configured,
    enabled: configured,
    authConfigured: configured,
    sessionConfigured: configured,
    endpoint: ORACLE_SESSION_ENDPOINT,
    cookieName: SESSION_COOKIE_NAME,
    authHeader: 'HttpOnly signed session cookie',
    authMethod: configured ? 'signed-session-cookie' : 'preview-only',
    sessionTtlMinutes: SESSION_TTL_MINUTES,
  }
}

export function responseJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value)
  }
  res.end(JSON.stringify(payload))
}

export function appendAuditEntry(auditPath, entry) {
  try {
    mkdirSync(dirname(auditPath), { recursive: true })
    appendFileSync(auditPath, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`)
  } catch {
    // Audit logging must never break the response path.
  }
}

export function getRequestBody(req) {
  const raw = req?.body
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') return JSON.parse(raw)
  return {}
}

export function auditContext(req, base = {}) {
  return {
    ...base,
    origin: firstHeader(req, 'origin') || firstHeader(req, 'referer') || undefined,
    expectedOrigin: expectedOrigin(req) || undefined,
  }
}
