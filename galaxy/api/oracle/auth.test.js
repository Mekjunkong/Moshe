import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import oracleActionsHandler from './actions.js'
import oracleSessionHandler from './session.js'
import oracleTerminalHandler from './terminal.js'
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from './auth.js'

function createReq({ method = 'POST', headers = {}, body = {} } = {}) {
  return {
    method,
    headers: {
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
      ...headers,
    },
    body,
  }
}

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value
    },
    end(value) {
      this.body = value
    },
  }
}

function readJson(res) {
  return JSON.parse(res.body)
}

const ORIGINAL_ENV = {
  ORACLE_SESSION_SECRET: process.env.ORACLE_SESSION_SECRET,
  ORACLE_ACTION_AUDIT_PATH: process.env.ORACLE_ACTION_AUDIT_PATH,
  ORACLE_WIRO_CI_DISPATCHER: process.env.ORACLE_WIRO_CI_DISPATCHER,
  ORACLE_TERMINAL_ENABLED: process.env.ORACLE_TERMINAL_ENABLED,
}

beforeEach(() => {
  process.env.ORACLE_SESSION_SECRET = 'test-session-secret'
  process.env.ORACLE_ACTION_AUDIT_PATH = '/tmp/oracle-action-audit-test.jsonl'
  process.env.ORACLE_WIRO_CI_DISPATCHER = 'true'
  process.env.ORACLE_TERMINAL_ENABLED = 'true'
})

afterEach(() => {
  process.env.ORACLE_SESSION_SECRET = ORIGINAL_ENV.ORACLE_SESSION_SECRET
  process.env.ORACLE_ACTION_AUDIT_PATH = ORIGINAL_ENV.ORACLE_ACTION_AUDIT_PATH
  process.env.ORACLE_WIRO_CI_DISPATCHER = ORIGINAL_ENV.ORACLE_WIRO_CI_DISPATCHER
  process.env.ORACLE_TERMINAL_ENABLED = ORIGINAL_ENV.ORACLE_TERMINAL_ENABLED
})

describe('oracle session crypto', () => {
  test('createSessionToken round-trips through verifySessionToken', () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const session = verifySessionToken(token, 'test-session-secret')
    assert.notEqual(session, null)
    assert.equal(session.actor, 'Mike')
    assert.ok(session.id)
  })

  test('verifySessionToken rejects tampered tokens', () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const tampered = token.replace(/.$/, token.endsWith('a') ? 'b' : 'a')
    assert.equal(verifySessionToken(tampered, 'test-session-secret'), null)
  })
})

describe('oracle session handler', () => {
  test('GET reports whether the session is authenticated', async () => {
    const res = createRes()
    await oracleSessionHandler(createReq({ method: 'GET' }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.configured, true)
    assert.equal(payload.authenticated, false)
  })

  test('POST issues a signed httpOnly cookie and GET accepts it', async () => {
    const loginRes = createRes()
    await oracleSessionHandler(
      createReq({
        method: 'POST',
        body: { passphrase: 'test-session-secret' },
      }),
      loginRes,
    )

    const loginPayload = readJson(loginRes)
    assert.equal(loginRes.statusCode, 200)
    assert.equal(loginPayload.authenticated, true)
    const cookie = loginRes.headers['set-cookie']
    assert.ok(String(cookie).includes(SESSION_COOKIE_NAME))
    assert.ok(String(cookie).includes('HttpOnly'))

    const token = String(cookie).match(/oracle_session=([^;]+)/)?.[1]
    assert.ok(token)

    const statusRes = createRes()
    await oracleSessionHandler(
      createReq({
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      }),
      statusRes,
    )

    const statusPayload = readJson(statusRes)
    assert.equal(statusRes.statusCode, 200)
    assert.equal(statusPayload.authenticated, true)
    assert.equal(statusPayload.actor, 'Mike')
  })
})

describe('oracle action gate', () => {
  test('GET returns action policy and bounded audit trail', async () => {
    const previewRes = createRes()
    await oracleActionsHandler(
      createReq({
        body: {
          actionId: 'refresh-oracle-snapshot',
          mode: 'preview',
          confirm: true,
          reason: 'audit seed',
        },
      }),
      previewRes,
    )

    const res = createRes()
    await oracleActionsHandler(createReq({ method: 'GET' }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.ok, true)
    assert.ok(Array.isArray(payload.actions))
    assert.ok(Array.isArray(payload.auditTrail))
    assert.equal(payload.policy.executionMode, 'server-enabled')
  })

  test('execute mode is rejected without a session', async () => {
    const res = createRes()
    await oracleActionsHandler(
      createReq({
        body: {
          actionId: 'dispatch-wiro-ci',
          mode: 'execute',
          confirm: true,
          reason: 'gate check',
        },
      }),
      res,
    )

    const payload = readJson(res)
    assert.equal(res.statusCode, 401)
    assert.equal(payload.error, 'unauthorized')
  })

  test('execute mode reaches the allowlist when a valid session cookie is present', async () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const res = createRes()
    await oracleActionsHandler(
      createReq({
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
        body: {
          actionId: 'dispatch-wiro-ci',
          mode: 'execute',
          confirm: true,
          reason: 'gate check',
        },
      }),
      res,
    )

    const payload = readJson(res)
    assert.equal(res.statusCode, 202)
    assert.equal(payload.decision, 'queued')
    assert.equal(payload.repo, 'Mekjunkong/Wiro4x4')
  })
})


describe('oracle terminal gate', () => {
  test('GET returns terminal policy and recipes', async () => {
    const res = createRes()
    await oracleTerminalHandler(createReq({ method: 'GET' }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.policy.terminalEnabled, true)
    assert.ok(Array.isArray(payload.recipes))
  })

  test('terminal execute rejects without a signed session', async () => {
    const res = createRes()
    await oracleTerminalHandler(createReq({ method: 'POST', body: { command: 'pwd' } }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 401)
    assert.equal(payload.error, 'unauthorized')
  })

  test('terminal execute runs safe commands with a valid session cookie', async () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const res = createRes()
    await oracleTerminalHandler(
      createReq({
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        body: { command: 'printf oracle-terminal-ok', cwd: '/Users/pasuthunjunkong/workspace/Moshe' },
      }),
      res,
    )
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.stdout, 'oracle-terminal-ok')
  })

  test('terminal blocks dangerous command patterns', async () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const res = createRes()
    await oracleTerminalHandler(
      createReq({
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        body: { command: 'rm -rf /tmp/whatever' },
      }),
      res,
    )
    const payload = readJson(res)
    assert.equal(res.statusCode, 400)
    assert.equal(payload.error, 'blocked_command')
  })
})
