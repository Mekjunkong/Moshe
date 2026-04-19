import type { ClusterMeta, NebulaMeta } from './types'

export const CLUSTERS: ClusterMeta[] = [
  { id: 'soul',     label: 'SOUL',     cx: -120, cy:  20, cz:  -60, radius: 80 },
  { id: 'memory',   label: 'MEMORY',   cx:   80, cy: -10, cz: -100, radius: 70 },
  { id: 'skills',   label: 'SKILLS',   cx:  140, cy:  30, cz:   40, radius: 90 },
  { id: 'projects', label: 'PROJECTS', cx:  -60, cy: -20, cz:   80, radius: 85 },
  { id: 'runtime',  label: 'RUNTIME',  cx: -140, cy:  10, cz:   30, radius: 65 },
]

export const NEBULAE: NebulaMeta[] = [
  { clusterA: 'soul',     clusterB: 'memory',   strength: 0.8, color: '#c084fc' },
  { clusterA: 'memory',   clusterB: 'skills',   strength: 0.6, color: '#818cf8' },
  { clusterA: 'skills',   clusterB: 'projects', strength: 0.8, color: '#34d399' },
  { clusterA: 'projects', clusterB: 'runtime',  strength: 0.7, color: '#38bdf8' },
  { clusterA: 'runtime',  clusterB: 'soul',     strength: 0.5, color: '#e879f9' },
]

export const CLUSTER_COLORS: Record<string, string> = {
  soul:     '#f472b6',
  memory:   '#a78bfa',
  skills:   '#3dd68c',
  projects: '#f59e0b',
  runtime:  '#22d3ee',
}
