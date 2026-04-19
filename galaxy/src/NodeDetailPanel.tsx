import type { MapDocument } from './types'
import { CLUSTER_COLORS } from './clusters'
import './NodeDetailPanel.css'

interface Props {
  node: MapDocument
  onClose: () => void
}

const CLUSTER_LABELS: Record<string, string> = {
  soul: 'SOUL', memory: 'MEMORY', skills: 'SKILLS',
  projects: 'PROJECTS', runtime: 'RUNTIME',
}

export default function NodeDetailPanel({ node, onClose }: Props) {
  const color = CLUSTER_COLORS[node.clusterId] ?? '#888'
  const label = CLUSTER_LABELS[node.clusterId] ?? node.clusterId.toUpperCase()

  const obsidianPath = node.filePath
    ? node.filePath.includes('/Documents/MyVault/')
      ? node.filePath.split('/Documents/MyVault/')[1]
      : null
    : null

  const handleCopyPath = () => {
    if (node.filePath) navigator.clipboard.writeText(node.filePath)
  }

  return (
    <div className="ndp">
      <button className="ndp-close" onClick={onClose}>✕</button>

      <div className="ndp-cluster" style={{ color }}>
        <span className="ndp-dot" style={{ background: color }} />
        {label}
      </div>

      <h2 className="ndp-title">{node.title}</h2>

      {node.type && (
        <span className="ndp-type">{node.type}</span>
      )}

      {node.excerpt ? (
        <p className="ndp-excerpt">{node.excerpt}</p>
      ) : (
        <p className="ndp-excerpt ndp-empty">No content preview available.</p>
      )}

      <div className="ndp-actions">
        {obsidianPath && (
          <a
            className="ndp-btn ndp-btn-primary"
            href={`obsidian://open?vault=MyVault&file=${encodeURIComponent(obsidianPath)}`}
          >
            Open in Obsidian
          </a>
        )}
        {node.filePath && (
          <button className="ndp-btn" onClick={handleCopyPath}>
            Copy path
          </button>
        )}
      </div>
    </div>
  )
}
