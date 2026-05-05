import { existsSync, readFileSync } from 'node:fs'

function normalizeDate(value) {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date : new Date(0)
}

function toLearningTitle(entry) {
  if (entry?.actionId === 'oracle-session' && entry?.outcome === 'session-created') {
    return 'Learning: session gate unlocks execution'
  }

  if (entry?.actionId === 'dispatch-wiro-ci' && entry?.outcome === 'allowed') {
    return 'Learning: Wiro CI dispatch works'
  }

  if (entry?.actionId === 'refresh-oracle-snapshot' && entry?.outcome === 'allowed') {
    return 'Learning: snapshot refresh works'
  }

  if (entry?.outcome === 'denied' && /confirmation/i.test(String(entry?.detail ?? ''))) {
    return 'Learning: confirmation is mandatory'
  }

  if (entry?.outcome === 'denied' && /origin/i.test(String(entry?.detail ?? ''))) {
    return 'Learning: execute requests must stay same-origin'
  }

  if (entry?.outcome === 'denied' && /session/i.test(String(entry?.detail ?? ''))) {
    return 'Learning: execution stays locked without session'
  }

  return ''
}

function toLearningSummary(entry) {
  const detail = String(entry?.detail ?? '').trim()

  if (entry?.actionId === 'oracle-session' && entry?.outcome === 'session-created') {
    return detail || 'Mike-only signed session cookie was issued and the gate opened.'
  }

  if (entry?.actionId === 'dispatch-wiro-ci' && entry?.outcome === 'allowed') {
    return detail || 'The allowlisted Wiro4x4 CI workflow was queued successfully.'
  }

  if (entry?.actionId === 'refresh-oracle-snapshot' && entry?.outcome === 'allowed') {
    return detail || 'The Oracle snapshot regenerated successfully.'
  }

  return detail || 'Oracle recorded a learning event.'
}

export function readOracleAuditEntries(auditPath, limit = 100) {
  try {
    if (!auditPath || !existsSync(auditPath)) return []
    const lines = readFileSync(auditPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)

    const entries = []
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed && typeof parsed === 'object') entries.push(parsed)
      } catch {
        // Ignore malformed audit rows.
      }
    }

    return entries
      .map((entry) => ({ ...entry, at: String(entry.at ?? entry.requestedAt ?? '') }))
      .sort((left, right) => normalizeDate(right.at) - normalizeDate(left.at))
      .slice(0, limit)
  } catch {
    return []
  }
}

export function deriveOracleLearnings(auditEntries = [], existingLearnings = [], limit = 5) {
  const existingTitles = new Set(
    (existingLearnings ?? [])
      .map((item) => String(item?.title ?? '').trim())
      .filter(Boolean),
  )

  const derived = []
  const seenTitles = new Set(existingTitles)

  for (const entry of auditEntries ?? []) {
    const title = toLearningTitle(entry)
    if (!title || seenTitles.has(title)) continue

    const date = normalizeDate(entry?.at ?? entry?.requestedAt ?? new Date(0)).toISOString().split('T')[0]
    const summary = toLearningSummary(entry)
    const card = { title, date, summary }

    derived.push(card)
    seenTitles.add(title)
    if (derived.length >= limit) break
  }

  return derived
}
