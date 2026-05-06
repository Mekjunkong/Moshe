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

const ACTIONS = [
  {
    id: 'refresh-oracle-snapshot',
    title: 'Refresh Oracle snapshot',
    description: 'Regenerate the read-only Oracle data bundle and re-evaluate sensors.',
    transport: 'local-script',
    autonomyLevel: 'safe_now',
    businessArea: 'oracle_os',
    risk: 'low',
    riskReason: 'Local read-only snapshot regeneration; no deploy, no push, no external contact.',
    nextSafeStep: 'Run the generator and inspect the JSON diff before any commit/deploy.',
    requiresConfirmation: true,
  },
  {
    id: 'dispatch-wiro-ci',
    title: 'Dispatch Wiro CI',
    description: 'Trigger the allowlisted GitHub workflow that verifies Wiro4x4 health.',
    transport: 'github-api',
    autonomyLevel: 'approval_required',
    businessArea: 'deploy_reliability',
    risk: 'medium',
    riskReason: 'Creates an external GitHub event and consumes CI minutes.',
    nextSafeStep: 'Preview the workflow request, then wait for Mike approval before dispatch.',
    requiresConfirmation: true,
  },
  {
    id: 'vercel-redeploy',
    title: 'Request Vercel redeploy',
    description: 'Ask Vercel to redeploy the Oracle dashboard after a confirmed change.',
    transport: 'vercel-api',
    autonomyLevel: 'approval_required',
    businessArea: 'deploy_reliability',
    risk: 'medium',
    riskReason: 'Changes live production surface and must be tied to verified commits/artifacts.',
    nextSafeStep: 'Prepare deployment evidence and wait for Mike approval.',
    requiresConfirmation: true,
  },
]

function getAutonomyRouter() {
  const count = (level) => ACTIONS.filter((action) => action.autonomyLevel === level).length
  return {
    phase: 'phase_4',
    summary: 'Every API action is classified before execution; approval_required actions stay blocked unless Mike explicitly approves and a signed session is present.',
    lanes: [
      { id: 'safe_now', count: count('safe_now'), canExecute: true },
      { id: 'draft_only', count: count('draft_only'), canExecute: false },
      { id: 'approval_required', count: count('approval_required'), canExecute: false },
    ],
    guardrails: [
      'signed-session-cookie required for execute mode',
      'same-origin POST required',
      'explicit confirm=true required',
      'approval_required means Mike must approve the specific scope before execution',
    ],
  }
}

function getPolicy() {
  const session = sessionPolicy()
  return {
    enabled: session.configured,
    authConfigured: session.configured,
    sessionConfigured: session.configured,
    endpoint: '/api/oracle/actions',
    sessionEndpoint: session.endpoint,
    authHeader: session.authHeader,
    auditPath: process.env.ORACLE_ACTION_AUDIT_PATH || '/tmp/oracle-action-audit.jsonl',
    executionMode: session.configured ? 'server-enabled' : 'preview-only',
    autonomyRouter: getAutonomyRouter(),
    note: session.configured
      ? 'Oracle execute mode is gated by a Mike-only signed session cookie with audit logging and Phase 4 autonomy classification.'
      : 'Preview trigger is wired to the action API path. Set ORACLE_SESSION_SECRET to arm Mike-only session-gated execution.',
    actions: ACTIONS,
  }
}

function writeAudit(auditPath, entry) {
  appendAuditEntry(auditPath, entry)
}

function readAuditEntries(auditPath, limit = 12) {
  if (!existsSync(auditPath)) return []
  try {
    return readFileSync(auditPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line)
          return {
            id: parsed.requestId || `audit-${index}`,
            requestedAt: parsed.at || parsed.requestedAt || new Date(0).toISOString(),
            actor: parsed.actor || 'unknown',
            actionId: parsed.actionId || 'unknown',
            outcome: parsed.outcome || 'unknown',
            detail: parsed.detail || parsed.error || 'No detail recorded.',
          }
        } catch {
          return {
            id: `audit-${index}`,
            requestedAt: new Date(0).toISOString(),
            actor: 'unknown',
            actionId: 'parse-error',
            outcome: 'denied',
            detail: 'Audit entry could not be parsed.',
          }
        }
      })
  } catch {
    return []
  }
}

function readBody(req) {
  return getRequestBody(req)
}

function getAction(actionId) {
  return ACTIONS.find((action) => action.id === actionId) ?? null
}

function executeLowRiskAction(actionId, requestId, reason) {
  if (actionId === 'refresh-oracle-snapshot') {
    const output = execFileSync('node', ['scripts/generateOracleData.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    }).trim()

    return {
      ok: true,
      decision: 'executed',
      message: 'Oracle snapshot regenerated successfully.',
      output,
    }
  }

  if (actionId === 'dispatch-wiro-ci') {
    const repo = process.env.ORACLE_WIRO_CI_REPO || 'Mekjunkong/Wiro4x4'
    const workflow = process.env.ORACLE_WIRO_CI_WORKFLOW || 'ci.yml'
    const ref = process.env.ORACLE_WIRO_CI_REF || 'main'
    const dispatcher = process.env.ORACLE_WIRO_CI_DISPATCHER || 'gh'

    const args = dispatcher === 'gh'
      ? ['api', '-X', 'POST', `repos/${repo}/dispatches`, '-f', 'event_type=wiro-ci', '-f', `client_payload[requestId]=${requestId}`, '-f', `client_payload[reason]=${reason || 'oracle-session'}`]
      : ['workflow', 'run', workflow, '--repo', repo, '--ref', ref]

    execFileSync(dispatcher, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    })

    return {
      ok: true,
      decision: 'queued',
      message: `Wiro CI dispatch queued for ${repo}.`,
      repo,
      workflow,
      ref,
    }
  }

  return {
    ok: false,
    error: 'execution_adapter_pending',
    message: 'Execution adapter is only implemented for refresh-oracle-snapshot and dispatch-wiro-ci right now.',
  }
}

export default async function handler(req, res) {
  const policy = getPolicy()
  const requestId = randomUUID()

  if (req.method === 'GET') {
    return responseJson(res, 200, {
      ok: true,
      requestId,
      message: 'Oracle action policy and bounded audit trail loaded.',
      policy,
      actions: policy.actions,
      auditTrail: readAuditEntries(policy.auditPath),
    })
  }

  if (req.method !== 'POST') {
    return responseJson(res, 405, {
      ok: false,
      requestId,
      error: 'method_not_allowed',
      allowedMethods: ['GET', 'POST'],
    })
  }

  let body
  try {
    body = readBody(req)
  } catch (error) {
    writeAudit(policy.auditPath, {
      requestId,
      outcome: 'denied',
      actor: 'unknown',
      actionId: 'invalid-json',
      detail: 'Request body could not be parsed as JSON.',
      error: String(error?.message ?? error),
      ...auditContext(req),
    })
    return responseJson(res, 400, {
      ok: false,
      requestId,
      error: 'invalid_json',
      message: 'Request body must be valid JSON.',
    })
  }

  const actionId = String(body?.actionId ?? '').trim()
  const mode = body?.mode === 'execute' ? 'execute' : 'preview'
  const confirm = body?.confirm === true
  const approvedByMike = body?.approvedByMike === true
  const reason = String(body?.reason ?? '').trim()
  const action = getAction(actionId)

  if (!action) {
    writeAudit(policy.auditPath, {
      requestId,
      outcome: 'denied',
      actor: 'Mike',
      actionId: actionId || 'unknown',
      detail: 'Requested action is not allowlisted.',
      ...auditContext(req),
    })
    return responseJson(res, 400, {
      ok: false,
      requestId,
      error: 'unknown_action',
      message: 'Requested Oracle action is not allowlisted.',
      allowedActions: ACTIONS.map((item) => item.id),
    })
  }

  if (!confirm) {
    writeAudit(policy.auditPath, {
      requestId,
      outcome: 'denied',
      actor: 'Mike',
      actionId,
      detail: 'Explicit confirmation is required for every Oracle mutation.',
      reason,
      ...auditContext(req),
    })
    return responseJson(res, 412, {
      ok: false,
      requestId,
      error: 'confirmation_required',
      message: 'Explicit confirmation is required before any Oracle action.',
      action,
    })
  }

  if (mode === 'execute') {
    if (!policy.enabled) {
      writeAudit(policy.auditPath, {
        requestId,
        outcome: 'denied',
        actor: 'Mike',
        actionId,
        detail: 'Execution is not armed. Set ORACLE_SESSION_SECRET to enable signed session gating.',
        reason,
        ...auditContext(req),
      })
      return responseJson(res, 503, {
        ok: false,
        requestId,
        error: 'preview_only',
        message: 'Oracle action execution is not armed yet.',
        policy,
      })
    }

    const originCheck = sameOriginPolicy(req)
    if (!originCheck.ok) {
      writeAudit(policy.auditPath, {
        requestId,
        outcome: 'denied',
        actor: 'Mike',
        actionId,
        detail: `Rejected execute request: ${originCheck.reason}.`,
        reason,
        ...auditContext(req),
      })
      return responseJson(res, 403, {
        ok: false,
        requestId,
        error: 'forbidden_origin',
        message: 'Execute requests must originate from the Oracle dashboard.',
        policy,
      })
    }

    const session = readSession(req)
    if (!session) {
      writeAudit(policy.auditPath, {
        requestId,
        outcome: 'denied',
        actor: 'unknown',
        actionId,
        detail: 'No valid Mike-only session cookie was presented.',
        reason,
        ...auditContext(req),
      })
      return responseJson(res, 401, {
        ok: false,
        requestId,
        error: 'unauthorized',
        message: 'Mike-only session cookie required for execution.',
        policy,
      })
    }

    if (action.autonomyLevel === 'approval_required' && !approvedByMike) {
      writeAudit(policy.auditPath, {
        requestId,
        outcome: 'denied',
        actor: session.actor || 'Mike',
        sessionId: session.id,
        actionId,
        detail: 'Phase 4 Autonomy Router blocked approval_required execution without approvedByMike=true.',
        reason,
        ...auditContext(req),
      })
      return responseJson(res, 428, {
        ok: false,
        requestId,
        error: 'approval_required',
        message: 'Phase 4 Autonomy Router requires explicit Mike approval for this action before execution.',
        policy,
        action,
        nextSafeStep: action.nextSafeStep,
      })
    }

    if (action.id === 'refresh-oracle-snapshot') {
      try {
        const execution = executeLowRiskAction(action.id, requestId, reason)
        writeAudit(policy.auditPath, {
          requestId,
          outcome: 'allowed',
          actor: session.actor || 'Mike',
          sessionId: session.id,
          actionId,
          detail: execution.message,
          reason,
          ...auditContext(req),
        })
        return responseJson(res, 200, {
          ok: true,
          requestId,
          decision: execution.decision,
          message: execution.message,
          policy,
          action,
          reason: reason || undefined,
          auditTrail: readAuditEntries(policy.auditPath),
          output: execution.output,
          session: {
            actor: session.actor || 'Mike',
            expiresAt: new Date(session.exp).toISOString(),
          },
          nextStep: 'Keep execution limited to low-risk allowlisted actions and add a UI trigger only after careful review.',
        })
      } catch (error) {
        const message = error?.stderr ? String(error.stderr).slice(0, 500) : error?.message ? String(error.message).slice(0, 200) : 'Action execution failed.'
        writeAudit(policy.auditPath, {
          requestId,
          outcome: 'denied',
          actor: session.actor || 'Mike',
          sessionId: session.id,
          actionId,
          detail: message,
          reason,
          ...auditContext(req),
        })
        return responseJson(res, 500, {
          ok: false,
          requestId,
          error: 'execution_failed',
          message,
          policy,
          action,
          requestedMode: mode,
        })
      }
    }

    if (action.id === 'dispatch-wiro-ci') {
      try {
        const execution = executeLowRiskAction(action.id, requestId, reason)
        writeAudit(policy.auditPath, {
          requestId,
          outcome: 'allowed',
          actor: session.actor || 'Mike',
          sessionId: session.id,
          actionId,
          detail: execution.message,
          reason,
          ...auditContext(req),
        })
        return responseJson(res, 202, {
          ok: true,
          requestId,
          decision: execution.decision,
          message: execution.message,
          policy,
          action,
          reason: reason || undefined,
          auditTrail: readAuditEntries(policy.auditPath),
          repo: execution.repo,
          workflow: execution.workflow,
          ref: execution.ref,
          session: {
            actor: session.actor || 'Mike',
            expiresAt: new Date(session.exp).toISOString(),
          },
          nextStep: 'Watch the GitHub Actions run and keep the Wiro allowlist constrained to the approved workflow.',
        })
      } catch (error) {
        const message = error?.stderr ? String(error.stderr).slice(0, 500) : error?.message ? String(error.message).slice(0, 200) : 'Action execution failed.'
        writeAudit(policy.auditPath, {
          requestId,
          outcome: 'denied',
          actor: session.actor || 'Mike',
          sessionId: session.id,
          actionId,
          detail: message,
          reason,
          ...auditContext(req),
        })
        return responseJson(res, 500, {
          ok: false,
          requestId,
          error: 'execution_failed',
          message,
          policy,
          action,
          requestedMode: mode,
        })
      }
    }
  }

  writeAudit(policy.auditPath, {
    requestId,
    outcome: 'preview',
    actor: 'Mike',
    actionId,
    detail: 'Preview request accepted by the Oracle action API foundation.',
    reason,
    ...auditContext(req),
  })

  return responseJson(res, 200, {
    ok: true,
    requestId,
    decision: 'preview',
    message: 'Preview accepted. The action API foundation is live, but execution remains blocked until the session gate is added.',
    policy,
    action,
    reason: reason || undefined,
    auditTrail: readAuditEntries(policy.auditPath),
    nextStep: 'Add a Mike-only signed session cookie before enabling browser execution.',
  })
}
