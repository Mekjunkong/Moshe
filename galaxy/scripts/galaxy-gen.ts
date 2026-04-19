import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { MapDocument, GalaxyData } from '../src/types'
import { CLUSTERS, NEBULAE } from '../src/clusters'

const PSI        = join(import.meta.dir, '../../ψ')
const SKILLS_DIR = join(import.meta.dir, '../../.opencode/skills')
const OUTPUT     = join(import.meta.dir, '../public/galaxy-data.json')

// Pure function: assign file path to a cluster id
export function assignCluster(filePath: string): string {
  if (
    filePath.includes('/resonance/') ||
    filePath.includes('/writing/')   ||
    filePath.includes('/lab/')
  ) return 'soul'

  if (filePath.includes('/memory/')) return 'memory'

  if (
    filePath.includes('/active/')  ||
    filePath.includes('/inbox/')   ||
    filePath.includes('/outbox/')  ||
    filePath.includes('/archive/')
  ) return 'projects'

  return 'soul'
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function readDirSafe(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

function orbitParams(clusterId: string, index: number, total: number) {
  const isActive = clusterId === 'projects'
  return {
    orbitRadius: isActive ? rand(8, 18)  : rand(10, 25),
    orbitSpeed:  isActive ? rand(0.3, 0.8): rand(0.05, 0.3),
    orbitPhase:  (index / Math.max(total, 1)) * Math.PI * 2,
    orbitTilt:   rand(-0.3, 0.3),
  }
}

function clusterCenter(clusterId: string) {
  const c = CLUSTERS.find(c => c.id === clusterId)!
  return { x: c.cx + rand(-5, 5), y: c.cy + rand(-3, 3), z: c.cz + rand(-5, 5) }
}

export function generate(): GalaxyData {
  const documents: MapDocument[] = []
  let id = 0

  const psiFolders = [
    'memory/learnings',
    'memory/retrospectives',
    'memory/resonance',
    'active',
    'inbox',
    'outbox',
    'archive',
    'writing',
    'lab',
  ]

  for (const folder of psiFolders) {
    const fullPath = join(PSI, folder)
    const files    = readDirSafe(fullPath).filter(f => !f.startsWith('.'))
    const clusterId = assignCluster(join(PSI, folder))

    files.forEach((file, i) => {
      documents.push({
        id: `psi-${id++}`,
        title: basename(file, '.md'),
        ...clusterCenter(clusterId),
        clusterId,
        type: folder.split('/')[0],
        ...orbitParams(clusterId, i, files.length),
      })
    })
  }

  const skills = readDirSafe(SKILLS_DIR).filter(f => !f.startsWith('.') && f !== 'VERSION.md')
  skills.forEach((skill, i) => {
    documents.push({
      id: `skill-${id++}`,
      title: skill,
      ...clusterCenter('skills'),
      clusterId: 'skills',
      type: 'skill',
      ...orbitParams('skills', i, skills.length),
    })
  })

  const RUNTIME_NODES = [
    { title: 'Claude Code',       type: 'runtime' },
    { title: 'Hermes / Telegram', type: 'runtime' },
    { title: 'Obsidian Vault',    type: 'runtime' },
    { title: 'Wiro4x4',           type: 'runtime' },
  ]
  RUNTIME_NODES.forEach((node, i) => {
    documents.push({
      id: `runtime-${i}`,
      ...node,
      ...clusterCenter('runtime'),
      clusterId: 'runtime',
      ...orbitParams('runtime', i, RUNTIME_NODES.length),
    })
  })

  return { clusters: CLUSTERS, documents, nebulae: NEBULAE }
}

if (import.meta.main) {
  mkdirSync(join(import.meta.dir, '../public'), { recursive: true })
  const data = generate()
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2))
  console.log(`✓ galaxy-data.json — ${data.documents.length} nodes across ${CLUSTERS.length} clusters`)
}
