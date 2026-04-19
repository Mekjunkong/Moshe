export interface MapDocument {
  id: string
  title: string
  x: number
  y: number
  z: number
  clusterId: string
  orbitRadius: number
  orbitSpeed: number
  orbitPhase: number
  orbitTilt: number
  parentId?: string
  type?: string
}

export interface ClusterMeta {
  id: string
  label: string
  cx: number
  cy: number
  cz: number
  radius: number
}

export interface NebulaMeta {
  clusterA: string
  clusterB: string
  strength: number
  color: string
}

export interface GalaxyData {
  clusters: ClusterMeta[]
  documents: MapDocument[]
  nebulae: NebulaMeta[]
}
