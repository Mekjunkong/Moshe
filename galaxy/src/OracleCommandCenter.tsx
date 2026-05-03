import { useEffect, useState } from 'react'
import type { OracleData } from './oracleData'
import { ORACLE_FALLBACK_DATA } from './oracleData'
import './OracleCommandCenter.css'

interface Props {
  data: import('./types').GalaxyData
}

function useOracleLiveData(): OracleData {
  const [d, setD] = useState<OracleData>(ORACLE_FALLBACK_DATA)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/oracleLive.json?ts=${Date.now()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<OracleData>
      })
      .then(setD)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          console.warn('Oracle live data unavailable; using fallback', err.message)
        }
      })
    return () => controller.abort()
  }, [])

  return d
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso || '—'
  const diff = Date.now() - then
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function isHttpUrl(url?: string) {
  return Boolean(url && /^https?:\/\//.test(url))
}

function timelineBadgeClass(state: string) {
  const s = state.toLowerCase()
  if (s === 'ready' || s === 'clean') return 'active'
  if (s === 'uncommitted-changes' || s === 'building') return 'scheduled'
  if (s === 'error' || s === 'failed') return 'failed'
  return 'env-missing'
}

export default function OracleCommandCenter({ data }: Props) {
  const oracle = useOracleLiveData()
  const [tab, setTab] = useState<'intel' | 'overview' | 'sites' | 'repos' | 'sensors' | 'learnings'>('intel')

  const projectNodes = data.documents.filter((d) => d.clusterId === 'projects').length
  const memoryNodes = data.documents.filter((d) => d.clusterId === 'memory').length
  const skillNodes = data.documents.filter((d) => d.clusterId === 'skills').length
  const runtimeNodes = data.documents.filter((d) => d.clusterId === 'runtime').length
  const onlineSites = oracle.websites.filter((w) => w.ok).length
  const dirtyRepos = oracle.repos.filter((r) => r.dirty).length
  const configuredCreds = oracle.credentials.filter((c) => c.configured).length
  const githubOk = oracle.github.filter((g) => g.apiStatus === 'ok').length
  const criticalIncidents = (oracle.incidents ?? []).filter((i) => i.severity === 'critical').length

  return (
    <aside className="oracle-shell" aria-label="Oracle OS command center">
      <div className="oracle-hero-card">
        <div>
          <p className="oracle-kicker">ORACLE OS · PHASE 2A · READ ONLY</p>
          <h1>MOSHE</h1>
          <p className="oracle-subtitle">
            Mike's external brain · generated {timeAgo(oracle.generated)}
          </p>
        </div>
        <div className="oracle-pulse" aria-hidden="true">
          <span />
        </div>
      </div>

      <div className="oracle-metrics">
        {[
          { label: 'Brain', value: data.documents.length },
          { label: 'Sites OK', value: `${onlineSites}/${oracle.websites.length || 0}` },
          { label: 'Dirty', value: dirtyRepos },
          { label: 'GitHub', value: `${githubOk}/${oracle.github.length || 0}` },
          { label: 'Alerts', value: criticalIncidents, alert: criticalIncidents > 0 },
        ].map((m) => (
          <div key={m.label} className={'alert' in m && m.alert ? 'oracle-metric-alert' : ''}>
            <strong>{'alert' in m && m.alert ? `⚠ ${m.value}` : m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      <div className="oracle-tabs" role="tablist">
        {(['intel', 'overview', 'sites', 'repos', 'sensors', 'learnings'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`oracle-tab${tab === t ? ' active' : ''}${t === 'intel' && criticalIncidents > 0 ? ' has-alert' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'intel' ? 'Intel' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'intel' && criticalIncidents > 0 && <span className="oracle-tab-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* ── Intel tab ── */}
      {tab === 'intel' && (
        <div className="oracle-section oracle-scroll">

          {/* Wiro CI */}
          <div className="oracle-section-head">
            <p>WIRO CI STATUS</p>
            <span>{oracle.wiroCi ? (oracle.wiroCi.conclusion ?? oracle.wiroCi.status) : 'no data'}</span>
          </div>
          {oracle.wiroCi ? (
            <article className={`oracle-status-card ${oracle.wiroCi.conclusion === 'success' ? 'ok' : oracle.wiroCi.conclusion === 'failure' ? 'fail' : 'warn'}`}>
              <div className="oracle-status-head">
                <strong>{oracle.wiroCi.workflowName}</strong>
                <span>{oracle.wiroCi.conclusion ?? oracle.wiroCi.status}</span>
              </div>
              <div className="oracle-wiro-row">
                <span>Branch</span>
                <code>{oracle.wiroCi.branch}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Trigger</span>
                <code>{oracle.wiroCi.event ?? '—'}</code>
              </div>
              {oracle.wiroCi.failureCategory && (
                <div className="oracle-wiro-row">
                  <span>Failure type</span>
                  <code className="oracle-fail-code">{oracle.wiroCi.failureCategory}</code>
                </div>
              )}
              {oracle.wiroCi.jobDetails && (
                <div className="oracle-wiro-row">
                  <span>Job</span>
                  <code className="oracle-fail-code">
                    {oracle.wiroCi.jobDetails.jobName}
                    {oracle.wiroCi.jobDetails.failedStep ? ` › ${oracle.wiroCi.jobDetails.failedStep}` : ''}
                  </code>
                </div>
              )}
              {oracle.wiroCi.url && isHttpUrl(oracle.wiroCi.url) && (
                <a href={oracle.wiroCi.url} target="_blank" rel="noopener noreferrer" className="oracle-link oracle-link-block">
                  View run on GitHub ↗
                </a>
              )}
              <small className="oracle-muted">Updated {oracle.wiroCi.updatedAt ? timeAgo(oracle.wiroCi.updatedAt) : '—'}</small>
            </article>
          ) : (
            <div className="oracle-cron-card">
              <small className="oracle-muted">No Wiro CI data. Run generate:oracle to fetch latest status.</small>
            </div>
          )}

          {/* Incidents */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>INCIDENTS</p>
            <span>{(oracle.incidents ?? []).length} detected</span>
          </div>
          {(oracle.incidents ?? []).length === 0 ? (
            <div className="oracle-live-card">
              <strong>All clear</strong>
              <small className="oracle-muted">No incidents detected at last snapshot.</small>
            </div>
          ) : (
            (oracle.incidents ?? []).map((inc) => (
              <article className={`oracle-incident-card ${inc.severity}`} key={inc.id}>
                <div className="oracle-incident-head">
                  <strong>{inc.title}</strong>
                  <span className={`oracle-severity-badge ${inc.severity}`}>{inc.severity.toUpperCase()}</span>
                </div>
                <small className="oracle-incident-project">{inc.project} · {inc.category}</small>
                <p className="oracle-incident-detail">{inc.detail}</p>
                {inc.url && isHttpUrl(inc.url) && (
                  <a href={inc.url} target="_blank" rel="noopener noreferrer" className="oracle-link">View ↗</a>
                )}
                <small className="oracle-muted">{timeAgo(inc.detectedAt)}</small>
              </article>
            ))
          )}

          {/* Recommendations */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RECOMMENDATIONS</p>
            <span>top {(oracle.recommendations ?? []).length}</span>
          </div>
          {(oracle.recommendations ?? []).length === 0 ? (
            <div className="oracle-live-card">
              <strong>Nothing urgent</strong>
              <small className="oracle-muted">No recommendations at this time.</small>
            </div>
          ) : (
            (oracle.recommendations ?? []).map((rec, idx) => (
              <div className="oracle-rec-card" key={`${rec.project}-${idx}`}>
                <div className="oracle-rec-head">
                  <strong>{rec.project}</strong>
                  <span className={`oracle-risk-badge ${rec.priority}`}>{rec.priority.toUpperCase()}</span>
                </div>
                <p className="oracle-rec-reason">{rec.reason}</p>
                <small className="oracle-muted">{rec.risk.toUpperCase()} RISK</small>
                <p className="oracle-rec-action">{rec.suggestedAction}</p>
              </div>
            ))
          )}

          {/* Deploy Timeline */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>DEPLOY TIMELINE</p>
            <span>{(oracle.deployTimeline ?? []).length} events</span>
          </div>
          {(oracle.deployTimeline ?? []).length === 0 ? (
            <div className="oracle-cron-card">
              <small className="oracle-muted">No timeline events yet.</small>
            </div>
          ) : (
            <div className="oracle-timeline">
              {(oracle.deployTimeline ?? []).map((ev, idx) => (
                <div className="oracle-timeline-event" key={`${ev.provider}-${ev.project}-${idx}`}>
                  <div className="oracle-timeline-dot" data-provider={ev.provider} />
                  <div className="oracle-timeline-body">
                    <div className="oracle-timeline-head">
                      <strong>{ev.project}</strong>
                      <span className={`cron-badge ${timelineBadgeClass(ev.state)}`}>{ev.state}</span>
                    </div>
                    <small className="oracle-muted">{ev.provider.toUpperCase()} · {ev.event} · {timeAgo(ev.timestamp)}</small>
                    {ev.note && <p className="oracle-timeline-note">{ev.note}</p>}
                    {ev.url && isHttpUrl(ev.url) && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="oracle-link">{ev.url}</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>SYSTEM PHASE</p>
            <span>{oracle.born}</span>
          </div>
          <div className="oracle-live-card">
            <strong>{oracle.level3Phase}</strong>
            <small>Safe mode: no redeploy/restart/write actions exposed in browser.</small>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>DEPLOYMENTS</p>
            <span>{oracle.deployments.length} source</span>
          </div>
          {oracle.deployments.map((d, idx) => (
            <div className="oracle-cron-card" key={`${d.provider}-${d.project}-${idx}`}>
              <div>
                <strong>{d.provider.toUpperCase()} · {d.project}</strong>
                <span className={`cron-badge ${d.state.toLowerCase()}`}>{d.state}</span>
              </div>
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="oracle-link">{d.url}</a>}
              <small>{d.createdAt ? timeAgo(d.createdAt) : d.note ?? 'read-only snapshot'}</small>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>AGENTS &amp; CRONS</p>
            <span>{oracle.activeCrons.length} listed</span>
          </div>
          {oracle.activeCrons.map((c, idx) => (
            <div className="oracle-cron-card" key={`${c.name}-${idx}`}>
              <div>
                <strong>{c.name}</strong>
                <span className={`cron-badge ${c.status}`}>{c.status}</span>
              </div>
              <p>{c.schedule}</p>
              <small>Next: {c.nextRun}</small>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>NEXT ACTIONS</p>
          </div>
          <ol className="oracle-next-steps">
            {oracle.nextActions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Sites tab ── */}
      {tab === 'sites' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>WEBSITE MONITOR</p>
            <span>{onlineSites}/{oracle.websites.length} online</span>
          </div>
          {oracle.websites.map((site) => (
            <article className={`oracle-status-card ${site.ok ? 'ok' : 'fail'}`} key={site.name}>
              <div className="oracle-status-head">
                <strong>{site.name}</strong>
                <span>{site.ok ? 'ONLINE' : 'CHECK'}</span>
              </div>
              {isHttpUrl(site.url) ? (
                <a href={site.url} target="_blank" rel="noopener noreferrer" className="oracle-link">
                  {site.url}
                </a>
              ) : (
                <small className="oracle-muted">{site.url}</small>
              )}
              <div className="oracle-wiro-row">
                <span>Status</span>
                <code>{site.status ?? '—'}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Response</span>
                <code>{site.responseMs ? `${site.responseMs}ms` : '—'}</code>
              </div>
              <p className="oracle-wiro-opp">{site.note}</p>
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>PROJECTS</p>
            <span>{oracle.projects.length} tracked</span>
          </div>
          <div className="oracle-projects-grid">
            {oracle.projects.map((p) => (
              <article className={`oracle-module ${p.accent}`} key={p.name}>
                <div className="oracle-module-header">
                  <h2>{p.name}</h2>
                  <span className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</span>
                </div>
                <p>{p.note}</p>
                {isHttpUrl(p.url) && <a href={p.url} target="_blank" rel="noopener noreferrer" className="oracle-project-link">↗</a>}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ── Repos tab ── */}
      {tab === 'repos' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>GIT REPOS</p>
            <span>{dirtyRepos} dirty</span>
          </div>
          {oracle.repos.map((repo) => (
            <article className={`oracle-status-card ${repo.dirty ? 'warn' : 'ok'}`} key={repo.path}>
              <div className="oracle-status-head">
                <strong>{repo.name}</strong>
                <span>{repo.dirty ? `${repo.changedFiles} changes` : 'CLEAN'}</span>
              </div>
              <div className="oracle-wiro-row">
                <span>Branch</span>
                <code>{repo.branch}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Commit</span>
                <code>{repo.commit}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>GitHub</span>
                <code>{repo.github ?? repo.remoteHost ?? '—'}</code>
              </div>
              <p className="oracle-wiro-opp">{repo.commitSubject}</p>
              <small className="oracle-muted">Last commit {timeAgo(repo.lastCommitAt)}</small>
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>CREDENTIAL READINESS</p>
            <span>names only · no values</span>
          </div>
          {oracle.credentials.map((cred) => (
            <div className={`oracle-credential ${cred.configured ? 'ok' : ''}`} key={cred.name}>
              <span>{cred.name}</span>
              <strong>{cred.configured ? 'configured' : 'missing'}</strong>
              <small>{cred.purpose}</small>
            </div>
          ))}
        </div>
      )}

      {/* ── Sensors tab ── */}
      {tab === 'sensors' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>GITHUB LIVE SENSORS</p>
            <span>{githubOk}/{oracle.github.length} API OK</span>
          </div>
          {oracle.github.map((g) => (
            <article className={`oracle-status-card ${g.apiStatus === 'ok' ? 'ok' : g.apiStatus === 'api-error' ? 'fail' : 'warn'}`} key={`${g.provider}-${g.repo}`}>
              <div className="oracle-status-head">
                <strong>{g.repo}</strong>
                <span>{g.apiStatus}</span>
              </div>
              {g.localName && <small className="oracle-muted">Local: {g.localName}</small>}
              <div className="oracle-wiro-row">
                <span>Issues / PRs</span>
                <code>{g.openIssues ?? '—'} / {g.openPullRequests ?? '—'}</code>
              </div>
              <div className="oracle-wiro-row">
                <span>Default branch</span>
                <code>{g.defaultBranch ?? '—'}</code>
              </div>
              {g.latestWorkflow && (
                <>
                  <div className="oracle-wiro-row">
                    <span>Workflow</span>
                    <code className={g.latestWorkflow.conclusion === 'failure' ? 'oracle-fail-code' : ''}>
                      {g.latestWorkflow.conclusion ?? g.latestWorkflow.status}
                    </code>
                  </div>
                  {g.latestWorkflow.url && isHttpUrl(g.latestWorkflow.url) && (
                    <a href={g.latestWorkflow.url} target="_blank" rel="noopener noreferrer" className="oracle-link">
                      {g.latestWorkflow.name}
                    </a>
                  )}
                  <small className="oracle-muted">Updated {g.latestWorkflow.updatedAt ? timeAgo(g.latestWorkflow.updatedAt) : '—'}</small>
                </>
              )}
              {g.note && <p className="oracle-wiro-opp">{g.note}</p>}
            </article>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>CREDENTIAL READINESS</p>
            <span>{configuredCreds}/{oracle.credentials.length} configured · names only</span>
          </div>
          {oracle.credentials.map((cred) => (
            <div className={`oracle-credential ${cred.configured ? 'ok' : ''}`} key={cred.name}>
              <span>{cred.name}</span>
              <strong>{cred.configured ? 'configured' : 'missing'}</strong>
              <small>{cred.purpose}</small>
            </div>
          ))}
        </div>
      )}

      {/* ── Learnings tab ── */}
      {tab === 'learnings' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
            <p>BRAIN COUNTS</p>
            <span>{projectNodes} projects · {skillNodes} skills · {runtimeNodes} runtime</span>
          </div>
          <div className="oracle-live-card compact">
            <span>ψ learnings: <strong>{oracle.stats.learnings}</strong></span>
            <span>retrospectives: <strong>{oracle.stats.retrospectives}</strong></span>
            <span>active: <strong>{oracle.stats.activeProjects}</strong></span>
          </div>

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RECENT LEARNINGS</p>
            <span>{oracle.recentLearnings.length} shown</span>
          </div>
          {oracle.recentLearnings.map((l) => (
            <div className="oracle-learning-card" key={l.title + l.date}>
              <div className="oracle-learning-head">
                <strong>{l.title}</strong>
                <small>{l.date}</small>
              </div>
              <p>{l.summary}</p>
            </div>
          ))}

          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>RETROSPECTIVES</p>
            <span>{oracle.retrospectivesCount} total</span>
          </div>
          {oracle.retrospectivesRecent.map((r) => (
            <div className="oracle-retro-item" key={r}>
              <span>•</span>
              <small>{r}</small>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
