import type { ClusterMeta, MapDocument } from './types'
import { CLUSTER_COLORS } from './clusters'
import './GalaxyChrome.css'

const BORDER_GLOW: Record<string, string> = {
  soul:     'rgba(244, 114, 182, 0.55)',
  memory:   'rgba(167, 139, 250, 0.55)',
  skills:   'rgba(61, 214, 140, 0.55)',
  projects: 'rgba(245, 158, 11, 0.55)',
  runtime:  'rgba(34, 211, 238, 0.55)',
}

interface Props {
  clusters: ClusterMeta[]
  documents: MapDocument[]
  search: string
  onSearch: (s: string) => void
  activeCluster: string | null
  onClusterToggle: (id: string) => void
}

export default function GalaxyChrome({
  clusters, documents, search, onSearch, activeCluster, onClusterToggle,
}: Props) {
  const countByCluster = clusters.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = documents.filter(d => d.clusterId === c.id).length
    return acc
  }, {})

  return (
    <div className="chrome">
      <div className="chrome-brand">
        <span className="chrome-title">MOSHE</span>
        <span className="chrome-sub">{documents.length} nodes · {clusters.length} nebulae</span>
      </div>

      <nav className="chrome-legend">
        {clusters.map(c => {
          const color = CLUSTER_COLORS[c.id]
          const glow = BORDER_GLOW[c.id]
          const isActive = activeCluster === c.id
          return (
            <button
              key={c.id}
              className={`legend-btn${isActive ? ' active' : ''}`}
              onClick={() => onClusterToggle(c.id)}
              style={isActive ? {
                borderColor: glow,
                boxShadow: `0 0 14px ${glow}`,
                background: 'rgba(255,255,255,0.09)',
              } : undefined}
            >
              <span className="dot" style={{
                background: color,
                boxShadow: `0 0 8px ${color}`,
              }} />
              <span className="lbl">{c.label}</span>
              <span className="cnt">{countByCluster[c.id]}</span>
            </button>
          )
        })}
      </nav>

      <input
        className="chrome-search"
        placeholder="search nodes…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
    </div>
  )
}
