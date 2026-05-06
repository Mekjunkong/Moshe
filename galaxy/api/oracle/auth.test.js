import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import oracleActionsHandler from './actions.js'
import oracleSessionHandler from './session.js'
import oracleTerminalHandler from './terminal.js'
import oracleFeedbackHandler from './feedback.js'
import oracleExecutorHandler from './executor.js'
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
  ORACLE_FEEDBACK_LEDGER_PATH: process.env.ORACLE_FEEDBACK_LEDGER_PATH,
  ORACLE_EXECUTOR_LEDGER_PATH: process.env.ORACLE_EXECUTOR_LEDGER_PATH,
  ORACLE_WIRO_CI_DISPATCHER: process.env.ORACLE_WIRO_CI_DISPATCHER,
  ORACLE_TERMINAL_ENABLED: process.env.ORACLE_TERMINAL_ENABLED,
}

beforeEach(() => {
  process.env.ORACLE_SESSION_SECRET = 'test-session-secret'
  process.env.ORACLE_ACTION_AUDIT_PATH = '/tmp/oracle-action-audit-test.jsonl'
  process.env.ORACLE_FEEDBACK_LEDGER_PATH = `/tmp/oracle-feedback-ledger-test-${process.pid}.jsonl`
  process.env.ORACLE_EXECUTOR_LEDGER_PATH = `/tmp/oracle-executor-runs-test-${process.pid}.jsonl`
  process.env.ORACLE_WIRO_CI_DISPATCHER = 'true'
  process.env.ORACLE_TERMINAL_ENABLED = 'true'
})

afterEach(() => {
  process.env.ORACLE_SESSION_SECRET = ORIGINAL_ENV.ORACLE_SESSION_SECRET
  process.env.ORACLE_ACTION_AUDIT_PATH = ORIGINAL_ENV.ORACLE_ACTION_AUDIT_PATH
  process.env.ORACLE_FEEDBACK_LEDGER_PATH = ORIGINAL_ENV.ORACLE_FEEDBACK_LEDGER_PATH
  process.env.ORACLE_EXECUTOR_LEDGER_PATH = ORIGINAL_ENV.ORACLE_EXECUTOR_LEDGER_PATH
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
    assert.equal(payload.policy.autonomyRouter.phase, 'phase_4')
    assert.equal(payload.actions.find((action) => action.id === 'dispatch-wiro-ci').autonomyLevel, 'approval_required')
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

  test('approval-required execute mode is blocked without explicit Mike approval', async () => {
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
          reason: 'router check',
        },
      }),
      res,
    )

    const payload = readJson(res)
    assert.equal(res.statusCode, 428)
    assert.equal(payload.error, 'approval_required')
  })

  test('execute mode reaches the allowlist when a valid session cookie and Mike approval are present', async () => {
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
          approvedByMike: true,
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


describe('oracle feedback ledger gate', () => {
  test('GET returns feedback policy and entries without writing', async () => {
    const res = createRes()
    await oracleFeedbackHandler(createReq({ method: 'GET' }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.policy.endpoint, '/api/oracle/feedback')
    assert.ok(Array.isArray(payload.entries))
  })

  test('POST rejects feedback writes without a signed session', async () => {
    const res = createRes()
    await oracleFeedbackHandler(
      createReq({ body: { signalId: 'rec-oracle-1', rating: 'useful', note: 'good' } }),
      res,
    )
    const payload = readJson(res)
    assert.equal(res.statusCode, 401)
    assert.equal(payload.error, 'unauthorized')
  })

  test('POST persists feedback with same-origin signed Mike session', async () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const res = createRes()
    await oracleFeedbackHandler(
      createReq({
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        body: { signalId: 'rec-oracle-1', rating: 'useful', note: 'keep this signal', source: 'dashboard' },
      }),
      res,
    )
    const payload = readJson(res)
    assert.equal(res.statusCode, 201)
    assert.equal(payload.ok, true)
    assert.equal(payload.entry.signalId, 'rec-oracle-1')
    assert.equal(payload.entry.rating, 'useful')

    const listRes = createRes()
    await oracleFeedbackHandler(createReq({ method: 'GET' }), listRes)
    const listPayload = readJson(listRes)
    assert.equal(listPayload.entries[0].signalId, 'rec-oracle-1')
    assert.equal(listPayload.counts.useful, 1)
  })
})


describe('oracle safe executor gate', () => {
  test('GET returns executor policy and persisted runs', async () => {
    const res = createRes()
    await oracleExecutorHandler(createReq({ method: 'GET' }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.ok, true)
    assert.equal(payload.policy.endpoint, '/api/oracle/executor')
    assert.ok(Array.isArray(payload.policy.queue))
    assert.ok(Array.isArray(payload.runs))
  })

  test('executor rejects without a signed session', async () => {
    const res = createRes()
    await oracleExecutorHandler(createReq({ body: { queueItemId: 'queue-refresh-oracle-snapshot', confirm: true } }), res)
    const payload = readJson(res)
    assert.equal(res.statusCode, 401)
    assert.equal(payload.error, 'unauthorized')
  })

  test('executor requires explicit confirmation for safe_now queue items', async () => {
    const token = createSessionToken('test-session-secret', 'Mike', 60_000)
    const res = createRes()
    await oracleExecutorHandler(
      createReq({
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
        body: { queueItemId: 'queue-refresh-oracle-snapshot' },
      }),
      res,
    )
    const payload = readJson(res)
    assert.equal(res.statusCode, 428)
    assert.equal(payload.error, 'confirmation_required')
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
