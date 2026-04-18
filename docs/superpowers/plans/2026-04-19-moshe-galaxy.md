# Moshe Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3D galaxy visualization of Moshe's mind and deploy it at mikewebstudio.com.

**Architecture:** A Bun script reads `ψ/` and `.opencode/skills/` to generate `public/galaxy-data.json`. A Vite + React app renders it using the `knowledge-map-3d` library (Three.js + UnrealBloom). Every `git push` triggers a Vercel auto-deploy.

**Tech Stack:** Vite 5, React 18, TypeScript, `knowledge-map-3d`, Three.js, Bun (generator + tests), Vercel

---

## File Map

```
Moshe/galaxy/
├── package.json                  # deps + npm scripts
├── tsconfig.json                 # strict TS, JSX react-jsx
├── vite.config.ts                # base:'/', optimizeDeps three
├── vercel.json                   # buildCommand + outputDirectory
├── index.html                    # black bg, #root fullscreen
├── .gitignore                    # node_modules, dist (NOT galaxy-data.json)
├── src/
│   ├── main.tsx                  # ReactDOM.createRoot entry
│   ├── types.ts                  # MapDocument, ClusterMeta, NebulaMeta, GalaxyData
│   ├── clusters.ts               # CLUSTERS[], NEBULAE[], CLUSTER_COLORS
│   ├── App.tsx                   # fetches JSON → KnowledgeMap + GalaxyChrome
│   ├── GalaxyChrome.tsx          # header, legend, search bar
│   └── GalaxyChrome.css          # dark space chrome styles
├── scripts/
│   ├── galaxy-gen.ts             # reads ψ/ → writes public/galaxy-data.json
│   └── galaxy-gen.test.ts        # bun test — tests assignCluster + schema
└── public/
    └── galaxy-data.json          # committed, regenerated locally
```

---

## Task 1: Scaffold galaxy/ Vite app

**Files:**
- Create: `galaxy/package.json`
- Create: `galaxy/tsconfig.json`
- Create: `galaxy/vite.config.ts`
- Create: `galaxy/index.html`
- Create: `galaxy/.gitignore`
- Create: `galaxy/src/main.tsx`
- Create: `galaxy/src/App.tsx` (placeholder)

- [ ] **Step 1: Create `galaxy/package.json`**

```json
{
  "name": "moshe-galaxy",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "generate": "bun scripts/galaxy-gen.ts",
    "dev:full": "concurrently \"bun scripts/galaxy-gen.ts\" \"vite\""
  },
  "dependencies": {
    "knowledge-map-3d": "latest",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.168.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.168.0",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
```

- [ ] **Step 2: Create `galaxy/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `galaxy/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  optimizeDeps: {
    include: ['three'],
  },
})
```

- [ ] **Step 4: Create `galaxy/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Moshe</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #000; overflow: hidden; }
      #root { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `galaxy/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Create `galaxy/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 7: Create `galaxy/src/App.tsx` (placeholder)**

```tsx
export default function App() {
  return (
    <div style={{ color: '#3dd68c', fontFamily: 'monospace', padding: 32 }}>
      Moshe Galaxy — scaffolding OK
    </div>
  )
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd galaxy && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: `Local: http://localhost:5173/` — browser shows green text "Moshe Galaxy — scaffolding OK".

- [ ] **Step 10: Commit**

```bash
cd ..
git add galaxy/
git commit -m "feat: scaffold galaxy/ Vite + React app"
```

---

## Task 2: Define types and cluster config

**Files:**
- Create: `galaxy/src/types.ts`
- Create: `galaxy/src/clusters.ts`
- Create: `galaxy/scripts/galaxy-gen.test.ts` (cluster schema tests only)

- [ ] **Step 1: Create `galaxy/src/types.ts`**

```ts
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
```

- [ ] **Step 2: Create `galaxy/src/clusters.ts`**

```ts
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
```

- [ ] **Step 3: Write cluster schema tests in `galaxy/scripts/galaxy-gen.test.ts`**

```ts
import { describe, test, expect } from 'bun:test'
import { CLUSTERS, NEBULAE } from '../src/clusters'

describe('CLUSTERS', () => {
  test('has exactly 5 clusters', () => {
    expect(CLUSTERS).toHaveLength(5)
  })

  test('all clusters have required fields', () => {
    for (const c of CLUSTERS) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(typeof c.cx).toBe('number')
      expect(typeof c.cy).toBe('number')
      expect(typeof c.cz).toBe('number')
      expect(c.radius).toBeGreaterThan(0)
    }
  })

  test('cluster ids are unique', () => {
    const ids = CLUSTERS.map(c => c.id)
    expect(new Set(ids).size).toBe(CLUSTERS.length)
  })

  test('contains expected ids', () => {
    const ids = new Set(CLUSTERS.map(c => c.id))
    expect(ids.has('soul')).toBe(true)
    expect(ids.has('memory')).toBe(true)
    expect(ids.has('skills')).toBe(true)
    expect(ids.has('projects')).toBe(true)
    expect(ids.has('runtime')).toBe(true)
  })
})

describe('NEBULAE', () => {
  test('has exactly 5 connections', () => {
    expect(NEBULAE).toHaveLength(5)
  })

  test('all nebulae reference valid cluster ids', () => {
    const ids = new Set(CLUSTERS.map(c => c.id))
    for (const n of NEBULAE) {
      expect(ids.has(n.clusterA)).toBe(true)
      expect(ids.has(n.clusterB)).toBe(true)
    }
  })

  test('strength is between 0 and 1', () => {
    for (const n of NEBULAE) {
      expect(n.strength).toBeGreaterThan(0)
      expect(n.strength).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd galaxy && bun test scripts/galaxy-gen.test.ts
```

Expected output:
```
✓ CLUSTERS > has exactly 5 clusters
✓ CLUSTERS > all clusters have required fields
✓ CLUSTERS > cluster ids are unique
✓ CLUSTERS > contains expected ids
✓ NEBULAE > has exactly 5 connections
✓ NEBULAE > all nebulae reference valid cluster ids
✓ NEBULAE > strength is between 0 and 1
7 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add galaxy/src/types.ts galaxy/src/clusters.ts galaxy/scripts/galaxy-gen.test.ts
git commit -m "feat: define types, cluster config, and schema tests"
```

---

## Task 3: Build the data generator

**Files:**
- Create: `galaxy/scripts/galaxy-gen.ts`
- Modify: `galaxy/scripts/galaxy-gen.test.ts` (add assignCluster tests)
- Create: `galaxy/public/galaxy-data.json` (generated output, committed)

- [ ] **Step 1: Add `assignCluster` tests to `galaxy/scripts/galaxy-gen.test.ts`**

Append these tests to the existing file (keep the CLUSTERS/NEBULAE describe blocks above):

```ts
// Add this import at the top of galaxy-gen.test.ts:
// import { assignCluster } from './galaxy-gen'
// (add after the existing CLUSTERS/NEBULAE imports)

describe('assignCluster', () => {
  test('resonance → soul', () => {
    expect(assignCluster('/workspace/Moshe/ψ/memory/resonance/oracle.md')).toBe('soul')
  })
  test('writing → soul', () => {
    expect(assignCluster('/workspace/Moshe/ψ/writing/draft.md')).toBe('soul')
  })
  test('lab → soul', () => {
    expect(assignCluster('/workspace/Moshe/ψ/lab/experiment.md')).toBe('soul')
  })
  test('memory/learnings → memory', () => {
    expect(assignCluster('/workspace/Moshe/ψ/memory/learnings/lesson.md')).toBe('memory')
  })
  test('memory/retrospectives → memory', () => {
    expect(assignCluster('/workspace/Moshe/ψ/memory/retrospectives/session.md')).toBe('memory')
  })
  test('active → projects', () => {
    expect(assignCluster('/workspace/Moshe/ψ/active/project.md')).toBe('projects')
  })
  test('inbox → projects', () => {
    expect(assignCluster('/workspace/Moshe/ψ/inbox/idea.md')).toBe('projects')
  })
  test('archive → projects', () => {
    expect(assignCluster('/workspace/Moshe/ψ/archive/done.md')).toBe('projects')
  })
  test('outbox → projects', () => {
    expect(assignCluster('/workspace/Moshe/ψ/outbox/ready.md')).toBe('projects')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (assignCluster not defined yet)**

```bash
cd galaxy && bun test scripts/galaxy-gen.test.ts
```

Expected: `Cannot find module './galaxy-gen'` or `assignCluster is not exported`

- [ ] **Step 3: Create `galaxy/scripts/galaxy-gen.ts`**

```ts
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { MapDocument, GalaxyData } from '../src/types'
import { CLUSTERS, NEBULAE } from '../src/clusters'

const PSI        = join(import.meta.dir, '../../ψ')
const SKILLS_DIR = join(import.meta.dir, '../../.opencode/skills')
const OUTPUT     = join(import.meta.dir, '../public/galaxy-data.json')

// ── Pure function: assign file path to a cluster id ──────────────────────────
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

  return 'soul'  // fallback: SOUL
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function readDirSafe(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

function orbitParams(clusterId: string, index: number, total: number) {
  const isActive = clusterId === 'projects'
  return {
    orbitRadius: isActive ? rand(30, 60)  : rand(40, 90),
    orbitSpeed:  isActive ? rand(0.3, 0.8): rand(0.05, 0.3),
    orbitPhase:  (index / Math.max(total, 1)) * Math.PI * 2,
    orbitTilt:   rand(-0.3, 0.3),
  }
}

function clusterCenter(clusterId: string) {
  const c = CLUSTERS.find(c => c.id === clusterId)!
  return { x: c.cx + rand(-20, 20), y: c.cy + rand(-10, 10), z: c.cz + rand(-20, 20) }
}

// ── Generator ─────────────────────────────────────────────────────────────────
export function generate(): GalaxyData {
  const documents: MapDocument[] = []
  let id = 0

  // ψ/ folder nodes
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

  // Skills nodes
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

  // Runtime nodes (hardcoded)
  const RUNTIME_NODES = [
    { title: 'Claude Code',      type: 'runtime' },
    { title: 'Hermes / Telegram', type: 'runtime' },
    { title: 'Obsidian Vault',   type: 'runtime' },
    { title: 'Wiro4x4',          type: 'runtime' },
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

// ── Entry point ───────────────────────────────────────────────────────────────
if (import.meta.main) {
  mkdirSync(join(import.meta.dir, '../public'), { recursive: true })
  const data = generate()
  writeFileSync(OUTPUT, JSON.stringify(data, null, 2))
  console.log(`✓ galaxy-data.json — ${data.documents.length} nodes across ${CLUSTERS.length} clusters`)
}
```

- [ ] **Step 4: Update test import — add to top of `galaxy/scripts/galaxy-gen.test.ts`**

Replace the comment placeholder with the real import:

```ts
import { assignCluster } from './galaxy-gen'
```

Full updated top of file:

```ts
import { describe, test, expect } from 'bun:test'
import { CLUSTERS, NEBULAE } from '../src/clusters'
import { assignCluster } from './galaxy-gen'
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd galaxy && bun test scripts/galaxy-gen.test.ts
```

Expected: all 16 tests pass (7 schema + 9 assignCluster).

- [ ] **Step 6: Run the generator**

```bash
bun scripts/galaxy-gen.ts
```

Expected:
```
✓ galaxy-data.json — XX nodes across 5 clusters
```

- [ ] **Step 7: Verify JSON shape**

```bash
node -e "const d = require('./public/galaxy-data.json'); console.log('clusters:', d.clusters.length, 'docs:', d.documents.length, 'nebulae:', d.nebulae.length)"
```

Expected: `clusters: 5 docs: [30+] nebulae: 5`

- [ ] **Step 8: Commit**

```bash
cd ..
git add galaxy/scripts/galaxy-gen.ts galaxy/scripts/galaxy-gen.test.ts galaxy/public/galaxy-data.json
git commit -m "feat: galaxy data generator reads ψ/ and .opencode/skills/"
```

---

## Task 4: Render the KnowledgeMap

**Files:**
- Modify: `galaxy/src/App.tsx` (full implementation)

- [ ] **Step 1: Check if knowledge-map-3d is on npm**

```bash
cd galaxy && npm info knowledge-map-3d 2>/dev/null | head -5
```

If that returns package info → use `npm install knowledge-map-3d`.
If it errors → install from GitHub:

```bash
npm install github:Bombbaza/Multi-Planet-System-Knowledge-Map-3D
```

- [ ] **Step 2: Replace `galaxy/src/App.tsx` with full implementation**

```tsx
import { useEffect, useState } from 'react'
import { KnowledgeMap } from 'knowledge-map-3d'
import type { GalaxyData } from './types'
import { CLUSTER_COLORS } from './clusters'
import GalaxyChrome from './GalaxyChrome'

export default function App() {
  const [data, setData]           = useState<GalaxyData | null>(null)
  const [search, setSearch]       = useState('')
  const [activeCluster, setActive] = useState<string | null>(null)

  useEffect(() => {
    fetch('/galaxy-data.json')
      .then(r => r.json())
      .then(setData)
  }, [])

  if (!data) {
    return (
      <div style={{ color: '#3dd68c', fontFamily: 'monospace', padding: 32, background: '#000', height: '100vh' }}>
        Loading Moshe's universe…
      </div>
    )
  }

  const visibleDocs = activeCluster
    ? data.documents.filter(d => d.clusterId === activeCluster)
    : data.documents

  const highlightIds = search.trim()
    ? new Set(
        data.documents
          .filter(d => d.title.toLowerCase().includes(search.toLowerCase()))
          .map(d => d.id)
      )
    : undefined

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
      <KnowledgeMap
        documents={visibleDocs}
        clusters={data.clusters}
        nebulae={data.nebulae}
        typeColors={CLUSTER_COLORS}
        onDocumentClick={(doc) => console.log('node:', doc.title)}
        onClusterClick={(cluster) =>
          setActive(prev => prev === cluster.id ? null : cluster.id)
        }
        highlightIds={highlightIds}
      />
      <GalaxyChrome
        clusters={data.clusters}
        documents={data.documents}
        search={search}
        onSearch={setSearch}
        activeCluster={activeCluster}
        onClusterToggle={(id) => setActive(prev => prev === id ? null : id)}
      />
    </div>
  )
}
```

Note: GalaxyChrome doesn't exist yet — TypeScript will error. Create a stub first:

- [ ] **Step 3: Create stub `galaxy/src/GalaxyChrome.tsx` to unblock TypeScript**

```tsx
export default function GalaxyChrome(_props: Record<string, unknown>) {
  return null
}
```

- [ ] **Step 4: Verify build compiles**

```bash
cd galaxy && npm run build
```

Expected: `dist/` created, 0 TypeScript errors (or only type errors from knowledge-map-3d missing types — acceptable).

If `KnowledgeMap` import fails at runtime, check the package's export:

```bash
node -e "const m = require('knowledge-map-3d'); console.log(Object.keys(m))"
```

Adjust import style if needed (default vs named).

- [ ] **Step 5: Run dev server and verify galaxy renders**

```bash
npm run dev
```

Open `http://localhost:5173` — should see the 3D galaxy with orbiting planets.

- [ ] **Step 6: Commit**

```bash
cd ..
git add galaxy/src/App.tsx galaxy/src/GalaxyChrome.tsx
git commit -m "feat: render KnowledgeMap with live galaxy-data.json"
```

---

## Task 5: Build GalaxyChrome (header + legend + search)

**Files:**
- Replace: `galaxy/src/GalaxyChrome.tsx` (full implementation)
- Create: `galaxy/src/GalaxyChrome.css`

> **Claude Design step (before coding):** Open claude.ai → Claude Design → create a new design. Describe: "A dark space UI chrome for a 3D galaxy app. Black background. Top bar with: left = 'MOSHE' monospace wordmark + node count subtitle. Center = 5 pill buttons each with a colored dot + label (SOUL pink, MEMORY purple, SKILLS green, PROJECTS amber, RUNTIME cyan). Right = search input with rounded pill style. Semi-transparent gradient fade to transparent at bottom." Generate the design, screenshot it, use it as the visual reference for the CSS below.

- [ ] **Step 1: Replace `galaxy/src/GalaxyChrome.tsx`**

```tsx
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
  clusters, documents, search, onSearch, activeCluster, onClusterToggle
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
            className={`legend-btn ${activeCluster === c.id ? 'active' : ''}`}
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
```

- [ ] **Step 2: Create `galaxy/src/GalaxyChrome.css`**

```css
.chrome {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 24px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%);
  pointer-events: none;
}

.chrome-brand {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.chrome-title {
  font-family: monospace;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 5px;
  color: #fff;
  text-shadow: 0 0 20px rgba(255,255,255,0.3);
}

.chrome-sub {
  font-family: monospace;
  font-size: 10px;
  color: #444;
  letter-spacing: 1px;
  margin-top: 2px;
}

.chrome-legend {
  display: flex;
  gap: 6px;
  pointer-events: auto;
}

.legend-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  color: inherit;
  font-family: monospace;
}

.legend-btn:hover,
.legend-btn.active {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.18);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.lbl {
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #bbb;
}

.cnt {
  font-size: 9px;
  color: #555;
}

.chrome-search {
  margin-left: auto;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 6px 14px;
  color: #ccc;
  font-family: monospace;
  font-size: 12px;
  outline: none;
  pointer-events: auto;
  width: 180px;
  transition: border-color 0.2s;
}

.chrome-search:focus {
  border-color: rgba(255,255,255,0.25);
}

.chrome-search::placeholder {
  color: #444;
}
```

- [ ] **Step 3: Run dev server — verify chrome renders**

```bash
cd galaxy && npm run dev
```

Expected: dark header with "MOSHE", 5 colored cluster buttons, search field on the right.

- [ ] **Step 4: Verify clean build**

```bash
npm run build
```

Expected: `dist/` built, 0 errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add galaxy/src/GalaxyChrome.tsx galaxy/src/GalaxyChrome.css
git commit -m "feat: GalaxyChrome header, cluster legend, and search"
```

---

## Task 6: Vercel deployment

**Files:**
- Create: `galaxy/vercel.json`

- [ ] **Step 1: Create `galaxy/vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 2: Verify build produces correct dist/**

```bash
cd galaxy && npm run build && ls dist/
```

Expected: `index.html`, `assets/` directory visible.

- [ ] **Step 3: Connect repo to Vercel**

1. Go to https://vercel.com/new
2. Import the `Moshe` GitHub repository
3. Set **Root Directory** → `galaxy`
4. Framework: Vite (auto-detected)
5. Click **Deploy**

Expected: Vercel URL like `https://moshe-galaxy-xxx.vercel.app` shows the galaxy.

- [ ] **Step 4: Commit vercel.json**

```bash
cd ..
git add galaxy/vercel.json
git commit -m "chore: add Vercel deployment config"
git push
```

Expected: Vercel auto-deploys on push — check Vercel dashboard for green status.

---

## Task 7: Domain migration (Manus → Vercel)

No code changes — DNS configuration only.

- [ ] **Step 1: Add custom domain in Vercel**

1. Vercel dashboard → your project → **Settings** → **Domains**
2. Click **Add** → enter `mikewebstudio.com`
3. Also add `www.mikewebstudio.com`
4. Vercel shows nameservers: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`

- [ ] **Step 2: Update nameservers at Manus**

1. Log into Manus domain panel
2. Find `mikewebstudio.com` → **DNS / Nameservers**
3. Replace existing nameservers with:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
4. Save

- [ ] **Step 3: Wait for propagation and verify**

```bash
# Check propagation (run every few minutes)
dig mikewebstudio.com NS +short
```

Expected within 10–30 min: returns `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

- [ ] **Step 4: Verify HTTPS live**

Open `https://mikewebstudio.com` in browser.

Expected: Moshe's 3D galaxy loads with SSL padlock. ✓

---

## Task 8 (bonus): Auto-regenerate on /rrr

This makes the galaxy update automatically every session end.

**Files:**
- Modify: `galaxy/src/` — no changes needed
- Modify: `.opencode/skills/rrr/SKILL.md` — add regeneration step

- [ ] **Step 1: Open `.opencode/skills/rrr/SKILL.md`**

Read the file and find where the session-end steps are listed.

- [ ] **Step 2: Add regeneration step near the end of the skill**

Add the following as a final step in the rrr ritual (before or after the git commit section):

```markdown
## Galaxy Sync

After completing the session retrospective, regenerate Moshe's galaxy data:

\`\`\`bash
cd /Users/pasuthunjunkong/workspace/Moshe/galaxy && bun scripts/galaxy-gen.ts
cd /Users/pasuthunjunkong/workspace/Moshe
git add galaxy/public/galaxy-data.json
git commit -m "chore: sync galaxy — $(date '+%Y-%m-%d')"
git push
\`\`\`

This keeps mikewebstudio.com reflecting Moshe's current state.
```

- [ ] **Step 3: Test the full /rrr → galaxy flow**

```bash
# Simulate: add a file to ψ/inbox/, then run the cycle
echo "test idea" > ψ/inbox/test-galaxy-sync.md
cd galaxy && bun scripts/galaxy-gen.ts
cd ..
git add galaxy/public/galaxy-data.json
git commit -m "chore: sync galaxy — test"
git push
```

Expected: Vercel deploys, new node visible in the PROJECTS nebula within 60s.

- [ ] **Step 4: Clean up test file and commit rrr skill**

```bash
rm ψ/inbox/test-galaxy-sync.md
git add .opencode/skills/rrr/SKILL.md
git commit -m "feat: auto-sync galaxy on /rrr session end"
git push
```

---

## Success Criteria

- [ ] `https://mikewebstudio.com` loads the 3D galaxy in < 3s
- [ ] All 5 nebulae visible with correct colors (pink/purple/green/amber/cyan)
- [ ] Real Moshe skills appear as green nodes in SKILLS nebula
- [ ] Search highlights matching nodes, fades others
- [ ] Clicking a legend button isolates that cluster
- [ ] Running `bun scripts/galaxy-gen.ts` + push updates the live site
- [ ] HTTPS + SSL working on custom domain
- [ ] `/rrr` session end triggers galaxy regeneration (bonus)
