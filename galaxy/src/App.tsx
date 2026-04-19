import { useEffect, useRef, useState } from 'react'
import { KnowledgeMap } from 'knowledge-map-3d'
import type {
  MapDocument as KmMapDocument,
  ClusterMeta as KmClusterMeta,
  NebulaMeta as KmNebulaMeta,
} from 'knowledge-map-3d'
import type { GalaxyData, MapDocument } from './types'
import { CLUSTER_COLORS } from './clusters'
import GalaxyChrome from './GalaxyChrome'
import NodeDetailPanel from './NodeDetailPanel'

// ---------------------------------------------------------------------------
// Adapters — bridge our galaxy-data.json schema to knowledge-map-3d types
// ---------------------------------------------------------------------------

function adaptDocuments(
  docs: GalaxyData['documents'],
): KmMapDocument[] {
  return docs.map((d) => ({
    id: d.id,
    type: d.type ?? 'unknown',
    sourceFile: d.title,
    concepts: [],
    project: null,
    x: d.x,
    y: d.y,
    z: d.z,
    clusterId: d.clusterId,
    orbitRadius: d.orbitRadius,
    orbitSpeed: d.orbitSpeed,
    orbitPhase: d.orbitPhase,
    orbitTilt: d.orbitTilt,
    parentId: d.parentId ?? null,
    moonCount: 0,
    createdAt: null,
    contentLength: 0,
  }))
}

function adaptClusters(
  clusters: GalaxyData['clusters'],
  docs: GalaxyData['documents'],
): KmClusterMeta[] {
  return clusters.map((c) => ({
    id: c.id,
    label: c.label,
    docCount: docs.filter((d) => d.clusterId === c.id).length,
    cx: c.cx,
    cy: c.cy,
    cz: c.cz,
    radius: c.radius,
    concepts: [],
    starDocId: null,
  }))
}

function adaptNebulae(
  nebulae: GalaxyData['nebulae'],
  clusters: GalaxyData['clusters'],
): KmNebulaMeta[] {
  return nebulae.map((n, i) => {
    const a = clusters.find((c) => c.id === n.clusterA)
    const b = clusters.find((c) => c.id === n.clusterB)
    const cx = a && b ? (a.cx + b.cx) / 2 : 0
    const cy = a && b ? (a.cy + b.cy) / 2 : 0
    const cz = a && b ? (a.cz + b.cz) / 2 : 0
    return {
      id: `${n.clusterA}-${n.clusterB}`,
      clusterA: n.clusterA,
      clusterB: n.clusterB,
      cx,
      cy,
      cz,
      strength: n.strength,
      color: n.color,
    }
  })
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [data, setData]            = useState<GalaxyData | null>(null)
  const [error, setError]          = useState<string | null>(null)
  const [search, setSearch]        = useState('')
  const [activeCluster, setActive] = useState<string | null>(null)
  const [selectedNode, setSelected] = useState<MapDocument | null>(null)
  const [loading, setLoading]      = useState(true)
  const loaderRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/galaxy-data.json', { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<GalaxyData> })
      .then((d) => { setData(d); setTimeout(() => setLoading(false), 600) })
      .catch((err: Error) => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false) } })
    return () => controller.abort()
  }, [])

  if (error) {
    return (
      <div style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace", padding: 32, background: '#000', height: '100vh' }}>
        Failed to load galaxy: {error}
      </div>
    )
  }

  const rawDocs = data
    ? activeCluster
      ? data.documents.filter((d) => d.clusterId === activeCluster)
      : data.documents
    : []

  const kmDocs      = data ? adaptDocuments(rawDocs) : []
  const kmClusters  = data ? adaptClusters(data.clusters, data.documents) : []
  const kmNebulae   = data ? adaptNebulae(data.nebulae, data.clusters) : []

  const highlightIds = data && search.trim()
    ? new Set(
        data.documents
          .filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))
          .map((d) => d.id),
      )
    : undefined

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      {/* Loader overlay — stays mounted for fade-out */}
      <div
        ref={loaderRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          transition: 'opacity 600ms ease-out',
          opacity: loading ? 1 : 0,
          pointerEvents: loading ? 'auto' : 'none',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.6), transparent 50%),
            radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.4), transparent 50%),
            radial-gradient(1px 1px at 50% 70%, rgba(255,255,255,0.5), transparent 50%),
            radial-gradient(1px 1px at 80% 80%, rgba(255,255,255,0.3), transparent 50%),
            radial-gradient(1px 1px at 30% 90%, rgba(255,255,255,0.4), transparent 50%),
            radial-gradient(2px 2px at 60% 50%, rgba(167,139,250,0.25), transparent 50%),
            radial-gradient(1.5px 1.5px at 15% 65%, rgba(244,114,182,0.2), transparent 50%),
            radial-gradient(1.5px 1.5px at 85% 40%, rgba(34,211,238,0.2), transparent 50%)
          `,
          animation: 'moshe-shimmer 8s ease-in-out infinite alternate',
        }} />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 8,
            color: '#fff',
            paddingLeft: 8,
            animation: 'moshe-breathe 3.2s ease-in-out infinite',
          }}>
            MOSHE
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: 2,
            color: '#444',
            marginTop: 14,
            textTransform: 'lowercase',
          }}>
            initializing galaxy…
          </div>
        </div>
      </div>

      {data && (
        <>
          <KnowledgeMap
            documents={kmDocs}
            clusters={kmClusters}
            nebulae={kmNebulae}
            typeColors={CLUSTER_COLORS}
            embedded
            onDocumentClick={(kmDoc) => {
              const local = data.documents.find(d => d.id === kmDoc.id) ?? null
              setSelected(local)
            }}
            onClusterClick={(cluster) =>
              setActive((prev) => (prev === cluster.id ? null : cluster.id))
            }
            highlightIds={highlightIds}
          />
          {selectedNode && (
            <NodeDetailPanel node={selectedNode} onClose={() => setSelected(null)} />
          )}
          <GalaxyChrome
            clusters={data.clusters}
            documents={data.documents}
            search={search}
            onSearch={setSearch}
            activeCluster={activeCluster}
            onClusterToggle={(id: string) => setActive((prev) => (prev === id ? null : id))}
          />
        </>
      )}
    </div>
  )
}
