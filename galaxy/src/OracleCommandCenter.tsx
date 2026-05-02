import { useEffect, useRef, useState } from 'react'
import type { OracleData } from './oracleData'
import './OracleCommandCenter.css'

interface Props {
  data: import('./types').GalaxyData
}

// Lazy-load Oracle data once the component mounts
function useOracleData(): OracleData | null {
  const [d, setD] = useState<OracleData | null>(null)
  useEffect(() => {
    import('./oracleData').then((m) => setD(m.ORACLE_DATA))
  }, [])
  return d
}

const NEXT_STEPS = [
  'Connect dashboard to live ψ/ + Obsidian via API or file read',
  'Add Wiro4x4 live status panel from git + cron QA data',
  'Build Weekly Report archive viewer inside Oracle OS',
]

export default function OracleCommandCenter({ data }: Props) {
  const oracle = useOracleData()
  const [tab, setTab] = useState<'overview' | 'projects' | 'learnings'>('overview')

  const projectNodes = data.documents.filter((d) => d.clusterId === 'projects').length
  const memoryNodes = data.documents.filter((d) => d.clusterId === 'memory').length
  const skillNodes = data.documents.filter((d) => d.clusterId === 'skills').length
  const runtimeNodes = data.documents.filter((d) => d.clusterId === 'runtime').length

  return (
    <aside className="oracle-shell" aria-label="Oracle OS command center">
      {/* ── Header ── */}
      <div className="oracle-hero-card">
        <div>
          <p className="oracle-kicker">ORACLE OS · LEVEL 3</p>
          <h1>MOSHE</h1>
          <p className="oracle-subtitle">
            Mike's external brain · born {oracle?.born ?? '—'}
          </p>
        </div>
        <div className="oracle-pulse" aria-hidden="true">
          <span />
        </div>
      </div>

      {/* ── Memory metrics ── */}
      <div className="oracle-metrics">
        {[
          { label: 'Brain Nodes', value: data.documents.length },
          { label: 'Projects', value: projectNodes },
          { label: 'Memories', value: memoryNodes },
          { label: 'Skills', value: skillNodes },
          { label: 'Runtime', value: runtimeNodes },
        ].map((m) => (
          <div key={m.label}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>

      {/* ── Tab navigation ── */}
      {oracle && (
        <div className="oracle-tabs" role="tablist">
          {(['overview', 'projects', 'learnings'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`oracle-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* ── Overview tab ── */}
      {oracle && tab === 'overview' && (
        <div className="oracle-section oracle-scroll">
          {/* Cron agents */}
          <div className="oracle-section-head">
            <p>AGENTS &amp; CRONS</p>
            <span>{oracle.activeCrons.length} active</span>
          </div>
          {oracle.activeCrons.map((c) => (
            <div className="oracle-cron-card" key={c.name}>
              <div>
                <strong>{c.name}</strong>
                <span className={`cron-badge ${c.status}`}>{c.status}</span>
              </div>
              <p>{c.schedule}</p>
              <small>Next: {c.nextRun}</small>
            </div>
          ))}

          {/* Wiro4x4 status */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>WIRO4X4</p>
            <a
              href={oracle.wiro.website}
              target="_blank"
              rel="noopener noreferrer"
              className="oracle-link"
            >
              {oracle.wiro.website}
            </a>
          </div>
          <div className="oracle-wiro-card">
            <div className="oracle-wiro-row">
              <span>Last push</span>
              <code>{oracle.wiro.lastPush}</code>
            </div>
            <div className="oracle-wiro-row">
              <span>Commit</span>
              <code>{oracle.wiro.commit}</code>
            </div>
            <div className="oracle-wiro-row">
              <span>Next opportunity</span>
            </div>
            <p className="oracle-wiro-opp">{oracle.wiro.opportunity}</p>
          </div>

          {/* Next steps */}
          <div className="oracle-section-head" style={{ marginTop: 16 }}>
            <p>NEXT LEVEL 3 STEPS</p>
          </div>
          <ol className="oracle-next-steps">
            {NEXT_STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Projects tab ── */}
      {oracle && tab === 'projects' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
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
                {p.url && p.url !== '—' && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="oracle-project-link"
                  >
                    ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* ── Learnings tab ── */}
      {oracle && tab === 'learnings' && (
        <div className="oracle-section oracle-scroll">
          <div className="oracle-section-head">
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
