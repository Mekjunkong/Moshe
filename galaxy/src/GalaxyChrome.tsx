import type { ClusterMeta, MapDocument } from './types'
import { CLUSTER_COLORS } from './clusters'
import './GalaxyChrome.css'

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
        {clusters.map(c => (
          <button
            key={c.id}
            className={`legend-btn${activeCluster === c.id ? ' active' : ''}`}
            onClick={() => onClusterToggle(c.id)}
          >
            <span className="dot" style={{ background: CLUSTER_COLORS[c.id] }} />
            <span className="lbl">{c.label}</span>
            <span className="cnt">{countByCluster[c.id]}</span>
          </button>
        ))}
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
