import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  appendAuditEntry,
  auditContext,
  getRequestBody,
  readSession,
  responseJson,
  sameOriginPolicy,
  sessionPolicy,
} from './auth.js'

const DEFAULT_CWD = '/Users/pasuthunjunkong/workspace/Moshe'
const ROOT = resolve(import.meta.dirname, '..', '..')
const MAX_COMMAND_LENGTH = 2000
const MAX_OUTPUT_BYTES = 40_000
const DEFAULT_TIMEOUT_MS = 45_000
const MAX_TIMEOUT_MS = 180_000

const ALLOWED_CWD_PREFIXES = [
  '/Users/pasuthunjunkong/workspace/Moshe',
  '/Users/pasuthunjunkong/workspace',
  ROOT,
]

const DENY_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\blaunchctl\b/i,
  /\bkillall\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\b(vercel|railway|flyctl)\s+env\s+(pull|ls|list)\b/i,
  /\b(printenv|env)\b/i,
  /\bcat\s+[^\n]*(\.env|id_rsa|credentials|secrets?)\b/i,
]

function terminalEnabled() {
  return String(process.env.ORACLE_TERMINAL_ENABLED ?? '').toLowerCase() === 'true'
}

function getPolicy() {
  const session = sessionPolicy()
  return {
    enabled: terminalEnabled() && session.configured,
    terminalEnabled: terminalEnabled(),
    sessionConfigured: session.configured,
    sessionEndpoint: session.endpoint,
    endpoint: '/api/oracle/terminal',
    authMethod: session.authMethod,
    defaultCwd: DEFAULT_CWD,
    allowedCwdPrefixes: ALLOWED_CWD_PREFIXES,
    maxCommandLength: MAX_COMMAND_LENGTH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    note: terminalEnabled()
      ? 'Terminal execution is armed only for a signed Mike session and same-origin requests.'
      : 'Terminal execution is disabled. Set ORACLE_TERMINAL_ENABLED=true only on Mike local/admin runtime.',
  }
}

function auditPath() {
  return process.env.ORACLE_TERMINAL_AUDIT_PATH || '/tmp/oracle-terminal-audit.jsonl'
}

function writeAudit(entry) {
  appendAuditEntry(auditPath(), entry)
}

function safeCwd(rawCwd) {
  const cwd = resolve(String(rawCwd || DEFAULT_CWD))
  const allowed = ALLOWED_CWD_PREFIXES.some((prefix) => cwd === prefix || cwd.startsWith(`${prefix}/`))
  if (!allowed || !existsSync(cwd)) return DEFAULT_CWD
  return cwd
}

function validateCommand(command) {
  const value = String(command || '').trim()
  if (!value) return { ok: false, error: 'empty_command', message: 'Command is required.' }
  if (value.length > MAX_COMMAND_LENGTH) return { ok: false, error: 'command_too_long', message: 'Command is too long.' }
  const deny = DENY_PATTERNS.find((pattern) => pattern.test(value))
  if (deny) {
    return {
      ok: false,
      error: 'blocked_command',
      message: 'Command was blocked by Oracle terminal safety policy.',
      pattern: String(deny),
    }
  }
  return { ok: true, command: value }
}

function redactOutput(text) {
  return String(text || '')
    .replace(/(ORACLE_SESSION_SECRET|GITHUB_TOKEN|VERCEL_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)=\S+/gi, '$1=[REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, 'sk-[REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, 'ghp_[REDACTED]')
    .slice(0, MAX_OUTPUT_BYTES)
}

function runShell(command, cwd, timeoutMs) {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const child = spawn('/bin/bash', ['-lc', command], {
      cwd,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        SHELL: '/bin/bash',
        TERM: 'xterm-256color',
        // Intentionally do not forward app/API secrets into browser-triggered commands.
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 1500).unref?.()
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
      if (stdout.length > MAX_OUTPUT_BYTES) stdout = stdout.slice(-MAX_OUTPUT_BYTES)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > MAX_OUTPUT_BYTES) stderr = stderr.slice(-MAX_OUTPUT_BYTES)
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      resolveRun({
        exitCode: 127,
        timedOut: false,
        durationMs: Date.now() - started,
        stdout: '',
        stderr: String(error?.message ?? error),
      })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolveRun({
        exitCode: timedOut ? 124 : (code ?? 0),
        signal: signal || null,
        timedOut,
        durationMs: Date.now() - started,
        stdout: redactOutput(stdout),
        stderr: redactOutput(stderr),
      })
    })
  })
}

export default async function handler(req, res) {
  const requestId = randomUUID()
  const policy = getPolicy()

  if (req.method === 'GET') {
    return responseJson(res, 200, {
      ok: true,
      requestId,
      policy,
      recipes: [
        { label: 'Check Codex', command: 'command -v codex && codex --version', cwd: DEFAULT_CWD },
        { label: 'Open Moshe repo status', command: 'git status --short && git branch --show-current', cwd: DEFAULT_CWD },
        { label: 'Run Galaxy tests', command: 'npm test', cwd: `${DEFAULT_CWD}/galaxy` },
        { label: 'Generate Oracle snapshot', command: 'npm run generate:oracle', cwd: `${DEFAULT_CWD}/galaxy` },
      ],
    })
  }

  if (req.method !== 'POST') {
    return responseJson(res, 405, { ok: false, requestId, error: 'method_not_allowed', allowedMethods: ['GET', 'POST'] })
  }

  if (!policy.enabled) {
    writeAudit({ requestId, outcome: 'denied', actor: 'Mike', actionId: 'terminal', detail: 'Terminal is not enabled/configured.', ...auditContext(req) })
    return responseJson(res, 503, {
      ok: false,
      requestId,
      error: 'terminal_disabled',
      message: policy.note,
      policy,
    })
  }

  const origin = sameOriginPolicy(req)
  if (!origin.ok) {
    writeAudit({ requestId, outcome: 'denied', actor: 'unknown', actionId: 'terminal', detail: `Origin check failed: ${origin.reason}`, ...auditContext(req) })
    return responseJson(res, 403, { ok: false, requestId, error: 'origin_denied', message: 'Same-origin terminal requests only.', origin })
  }

  const session = readSession(req)
  if (!session) {
    writeAudit({ requestId, outcome: 'denied', actor: 'unknown', actionId: 'terminal', detail: 'No valid signed session cookie.', ...auditContext(req) })
    return responseJson(res, 401, { ok: false, requestId, error: 'unauthorized', message: 'Unlock the Mike-only session gate before using terminal.', policy })
  }

  let body
  try {
    body = getRequestBody(req)
  } catch (error) {
    return responseJson(res, 400, { ok: false, requestId, error: 'invalid_json', message: String(error?.message ?? error) })
  }

  const validation = validateCommand(body?.command)
  if (!validation.ok) {
    writeAudit({ requestId, outcome: 'denied', actor: session.actor, actionId: 'terminal', detail: validation.message, command: String(body?.command || '').slice(0, 160), ...auditContext(req) })
    return responseJson(res, 400, { ok: false, requestId, ...validation, policy })
  }

  const cwd = safeCwd(body?.cwd)
  const timeoutMs = Math.min(Math.max(Number(body?.timeoutMs || DEFAULT_TIMEOUT_MS), 1000), MAX_TIMEOUT_MS)
  const result = await runShell(validation.command, cwd, timeoutMs)
  writeAudit({
    requestId,
    outcome: result.exitCode === 0 ? 'allowed' : 'denied',
    actor: session.actor,
    actionId: 'terminal',
    detail: `exit=${result.exitCode} cwd=${cwd} duration=${result.durationMs}ms`,
    command: validation.command.slice(0, 160),
    ...auditContext(req),
  })

  return responseJson(res, 200, {
    ok: result.exitCode === 0,
    requestId,
    command: validation.command,
    cwd,
    ...result,
  })
}
