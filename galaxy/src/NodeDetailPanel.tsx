import type { MapDocument } from './types'
import { CLUSTER_COLORS } from './clusters'
import './NodeDetailPanel.css'

const CLUSTER_LABELS: Record<string, string> = {
  soul: 'SOUL', memory: 'MEMORY', skills: 'SKILLS',
  projects: 'PROJECTS', runtime: 'RUNTIME',
}

const BORDER_GLOW: Record<string, string> = {
  soul:     'rgba(244, 114, 182, 0.55)',
  memory:   'rgba(167, 139, 250, 0.55)',
  skills:   'rgba(61, 214, 140, 0.55)',
  projects: 'rgba(245, 158, 11, 0.55)',
  runtime:  'rgba(34, 211, 238, 0.55)',
}

const NODE_GLOW: Record<string, string> = {
  soul:     '0 0 16px rgba(244, 114, 182, 0.45)',
  memory:   '0 0 16px rgba(167, 139, 250, 0.45)',
  skills:   '0 0 16px rgba(61, 214, 140, 0.45)',
  projects: '0 0 16px rgba(245, 158, 11, 0.45)',
  runtime:  '0 0 16px rgba(34, 211, 238, 0.45)',
}

interface Props {
  node: MapDocument
  onClose: () => void
}

export default function NodeDetailPanel({ node, onClose }: Props) {
  const color = CLUSTER_COLORS[node.clusterId] ?? '#888'
  const label = CLUSTER_LABELS[node.clusterId] ?? node.clusterId.toUpperCase()
  const borderGlow = BORDER_GLOW[node.clusterId] ?? 'rgba(255,255,255,0.12)'
  const nodeGlow = NODE_GLOW[node.clusterId] ?? ''

  const obsidianPath = node.filePath
    ? node.filePath.includes('/Documents/MyVault/')
      ? node.filePath.split('/Documents/MyVault/')[1]
      : null
    : null

  const handleCopyPath = () => {
    if (node.filePath) navigator.clipboard.writeText(node.filePath)
  }

  return (
    <div
      className="ndp"
      style={{
        borderColor: borderGlow,
        boxShadow: `0 0 40px rgba(0,0,0,0.80), 0 0 24px ${borderGlow.replace('0.55', '0.18')}`,
      }}
    >
      <button className="ndp-close" onClick={onClose} aria-label="Close">✕</button>

      <div className="ndp-cluster" style={{ color }}>
        <span className="ndp-dot" style={{
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }} />
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
            className="ndp-btn"
            href={`obsidian://open?vault=MyVault&file=${encodeURIComponent(obsidianPath)}`}
            style={{
              borderColor: borderGlow,
              color,
              boxShadow: nodeGlow.replace('0.45', '0.25'),
            }}
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
