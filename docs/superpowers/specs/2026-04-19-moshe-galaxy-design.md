# Moshe Galaxy — Design Spec
**Date**: 2026-04-19  
**Status**: Approved  
**Deployed at**: https://mikewebstudio.com/

---

## Vision

A 3D galaxy visualization of Moshe's mind — deployed at mikewebstudio.com. Five nebulae (SOUL, MEMORY, SKILLS, PROJECTS, RUNTIME) rendered as particle clouds with orbiting planet-nodes representing real files, skills, and projects. Built with `knowledge-map-3d` (React + Three.js), data generated from Moshe's actual `ψ/` folder structure.

---

## Architecture

```
Moshe/
└── galaxy/                        ← Vercel root directory
    ├── package.json
    ├── vite.config.ts
    ├── vercel.json
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx                ← renders <KnowledgeMap> with live data
    │   └── types.ts               ← MapDocument, ClusterMeta, NebulaMeta
    ├── scripts/
    │   └── galaxy-gen.ts          ← reads ψ/, outputs galaxy-data.json
    └── public/
        └── galaxy-data.json       ← committed, regenerated locally
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| 3D visualization | `knowledge-map-3d` (Three.js + UnrealBloomPass) |
| Frontend framework | Vite + React + TypeScript |
| Data generator | Bun (`scripts/galaxy-gen.ts`) |
| UI chrome prototype | Claude Design (claude.ai) |
| Hosting | Vercel (free tier) |
| Domain | mikewebstudio.com (migrated from Manus) |

---

## The 5 Nebulae

### SOUL — `#f472b6` (pink)
Moshe's core identity and creative output.

| Source | Nodes |
|--------|-------|
| `ψ/memory/resonance/` | oracle.md, awaken logs, belief files |
| `ψ/writing/` | drafts, content |
| `ψ/lab/` | experiments |
| Skills: `who-are-you`, `philosophy`, `resonance`, `awaken` | skill nodes |

### MEMORY — `#a78bfa` (purple)
What Moshe has learned and remembered.

| Source | Nodes |
|--------|-------|
| `ψ/memory/learnings/` | lesson files |
| `ψ/memory/retrospectives/` | session retrospectives |
| `~/.claude/projects/…/memory/` | user, feedback, project memories |
| Obsidian vault notes | MyVault key notes |

### SKILLS — `#3dd68c` (green)
Moshe's capabilities and tools.

| Source | Nodes |
|--------|-------|
| `.opencode/skills/` | all 29 oracle skills |
| Key skills | rrr, recap, learn, trace, dig, forward, standup, oracle, bampenpien |

### PROJECTS — `#f59e0b` (amber)
Active work, incoming ideas, completed deliverables.

| Source | Nodes | Brightness |
|--------|-------|-----------|
| `ψ/active/` | WIP items | bright (large orbit radius) |
| `ψ/inbox/` | unprocessed inputs | medium |
| `ψ/outbox/` | ready to deliver | medium |
| `ψ/archive/` | completed work | dim (small, fast orbit) |

### RUNTIME — `#22d3ee` (cyan)
Where Moshe lives and breathes.

| Source | Nodes |
|--------|-------|
| Claude Code | `claude-code` node |
| Hermes / Telegram | `hermes` node |
| Obsidian vault | `obsidian-vault` node |
| Wiro4x4 business | `wiro4x4` node |

---

## Nebula Connections (ring pattern)

```
SOUL ←→ MEMORY       strength: 0.8   color: #c084fc
MEMORY ←→ SKILLS     strength: 0.6   color: #818cf8
SKILLS ←→ PROJECTS   strength: 0.8   color: #34d399
PROJECTS ←→ RUNTIME  strength: 0.7   color: #38bdf8
RUNTIME ←→ SOUL      strength: 0.5   color: #e879f9
```

---

## Data Generator (`scripts/galaxy-gen.ts`)

**Inputs** (paths read at runtime):
- `ψ/` — all subfolders
- `.opencode/skills/` — skill directories
- `~/.claude/projects/…/memory/` — Claude memory files

**Output**: `public/galaxy-data.json` with shape:
```ts
{
  clusters: ClusterMeta[],   // 5 entries, positions defined below
  documents: MapDocument[],  // one per file/skill found
  nebulae: NebulaMeta[]      // 5 connections (ring)
}
```

**Cluster 3D positions** (Three.js units, y-spread kept shallow for galaxy-plane feel):

| Cluster | cx | cy | cz | radius |
|---------|----|----|-----|--------|
| SOUL | -120 | 20 | -60 | 80 |
| MEMORY | 80 | -10 | -100 | 70 |
| SKILLS | 140 | 30 | 40 | 90 |
| PROJECTS | -60 | -20 | 80 | 85 |
| RUNTIME | -140 | 10 | 30 | 65 |

**Document assignment logic**:
- File path contains `resonance/`, `writing/`, `lab/` → SOUL
- File path contains `memory/learnings/`, `memory/retrospectives/` → MEMORY
- File is a skill directory → SKILLS
- File path contains `active/`, `inbox/`, `outbox/`, `archive/` → PROJECTS
- Hardcoded runtime entries → RUNTIME

**Orbit parameters**:
- `active/` files: `orbitRadius: 30–50`, larger, bright
- `archive/` files: `orbitRadius: 80–120`, dim, fast
- Skills: evenly spaced `orbitPhase`, medium radius
- Runtime nodes: fixed large radius, slow orbit

---

## UI Chrome (Claude Design → React)

The non-3D shell is prototyped in **Claude Design** first, then implemented in React. Components:

- **Header bar** — "MOSHE" wordmark + last-updated timestamp
- **Cluster legend** — 5 color dots with labels, clickable to highlight
- **Stats sidebar** — counts per cluster (e.g. "12 memories · 29 skills")
- **Search** — highlights matching nodes, fades others (built into `knowledge-map-3d`)
- **Background** — pure black `#000000`

---

## Update Flow (keeping the galaxy alive)

```bash
# 1. Moshe's brain changes (new file, new learning, etc.)
# 2. Regenerate the data:
bun scripts/galaxy-gen.ts

# 3. Commit and push:
git add public/galaxy-data.json
git commit -m "chore: update galaxy data"
git push

# 4. Vercel auto-deploys in ~30s → mikewebstudio.com updates ✨
```

**Optional automation**: Hook step 2 into `/rrr` so `galaxy-data.json` regenerates at every session end.

---

## Deployment (Vercel + Domain Migration)

### Vercel Setup
1. Connect `Moshe` repo to Vercel
2. Set **Root Directory** to `galaxy/`
3. Build command: `npm run build`
4. Output directory: `dist/`

### Domain Migration (Manus → Vercel)
1. In Vercel dashboard → **Domains** → add `mikewebstudio.com`
2. Vercel provides nameservers (e.g. `ns1.vercel-dns.com`)
3. Log into Manus domain panel → replace nameservers with Vercel's
4. Wait ~10–30 min for propagation
5. Vercel auto-provisions SSL certificate → site is live on HTTPS

---

## Implementation Phases

| Phase | What | Output |
|-------|------|--------|
| 1 | Scaffold `galaxy/` Vite app, install deps | Running locally |
| 2 | Prototype UI chrome in Claude Design | Visual reference |
| 3 | Build `galaxy-gen.ts` — reads ψ/, outputs JSON | `galaxy-data.json` |
| 4 | Implement `App.tsx` — renders `<KnowledgeMap>` | 3D galaxy locally |
| 5 | Apply Claude Design chrome (header, sidebar, legend) | Full UI locally |
| 6 | Deploy to Vercel, migrate domain | Live at mikewebstudio.com |
| 7 | (Optional) Hook into `/rrr` for auto-regeneration | Always fresh |

---

## Success Criteria

- [ ] `mikewebstudio.com` loads the 3D galaxy in < 3s
- [ ] All 5 nebulae visible with correct colors and labels
- [ ] Real Moshe files appear as planet nodes
- [ ] Search highlights matching nodes
- [ ] Cluster legend toggles visibility
- [ ] Running `bun scripts/galaxy-gen.ts` + push updates the live site
- [ ] SSL/HTTPS working on custom domain
