// Oracle OS real data — sourced from ψ/, Obsidian, git, and system state
// This module is the "brain" layer between raw sources and the dashboard UI.

export interface OracleProject {
  name: string
  url: string
  status: string
  note: string
  accent: 'orange' | 'cyan' | 'violet' | 'green'
}

export interface OracleLearning {
  title: string
  date: string
  summary: string
}

export interface OracleCron {
  name: string
  schedule: string
  nextRun: string
  status: string
}

export interface OracleWiroStatus {
  lastPush: string
  commit: string
  website: string
  opportunity: string
}

export interface OracleData {
  born: string
  brainNodes: number
  memoryNodes: number
  skillNodes: number
  runtimeNodes: number
  projectNodes: number
  recentLearnings: OracleLearning[]
  retrospectivesCount: number
  retrospectivesRecent: string[]
  activeCrons: OracleCron[]
  nextWeeklyReport: string
  wiro: OracleWiroStatus
  projects: OracleProject[]
  level3Phase: string
}

export const ORACLE_DATA: OracleData = {
  born: '2026-04-18',
  brainNodes: 36,
  memoryNodes: 2,
  skillNodes: 29,
  runtimeNodes: 4,
  projectNodes: 0,

  recentLearnings: [
    {
      title: 'Wiro4x4 Homepage Push',
      date: '2026-05-02',
      summary: 'Keep surgical homepage commits; verify with targeted lint. Cookie sameSite: none required for logout test.',
    },
    {
      title: 'Aum Hippie Young',
      date: '2026-05-02',
      summary: 'Hero + CTA conversion improvements pushed. Images optimized 22MB→1.2MB. Thai typo fixes.',
    },
    {
      title: 'Oracle Level 3',
      date: '2026-05-03',
      summary: 'Dashboard prototype built. Next: connect to real ψ/ data.',
    },
  ],

  retrospectivesCount: 3,
  retrospectivesRecent: [
    '2026-05-03 — Oracle OS Dashboard Prototype',
    '2026-05-02 — Wiro Homepage Push',
    '2026-04-24 — Aum Deploy Photo Fix',
  ],

  activeCrons: [
    {
      name: 'Weekly Oracle Report',
      schedule: 'Every Monday 09:00 +07',
      nextRun: '2026-05-04 09:00 +07',
      status: 'scheduled',
    },
    {
      name: 'Wiro4x4 Daily QA Check',
      schedule: 'Daily 08:00 +07',
      nextRun: '2026-05-03 08:00 +07',
      status: 'active',
    },
    {
      name: 'Switch to Gemini',
      schedule: '2026-05-04 09:00 once',
      nextRun: '2026-05-04 09:00 +07',
      status: 'scheduled',
    },
  ],

  nextWeeklyReport: '2026-05-04 09:00 +07',

  wiro: {
    lastPush: '2026-05-02 23:26 +07',
    commit: 'aaaf3d2',
    website: 'https://www.wiro4x4indochina.com',
    opportunity:
      'Test Hebrew WhatsApp CTA. Add real booking count. Improve trust proof with verifiable data.',
  },

  projects: [
    {
      name: 'Wiro4x4',
      url: 'https://www.wiro4x4indochina.com',
      status: 'Active',
      note: 'Kosher 4×4 tours. Hebrew/English audience. Homepage conversion push shipped.',
      accent: 'orange',
    },
    {
      name: 'Aum Hippie Young',
      url: 'https://aum-hippie-young.vercel.app',
      status: 'Active',
      note: 'ATV/mountain tours Chiang Mai. Hero + CTA conversion improvements pushed.',
      accent: 'cyan',
    },
    {
      name: 'Etsy Digital Products',
      url: '—',
      status: 'Validation',
      note: 'Validated 3 ideas: Meal Prep, Invoice Tracker, Crochet Pattern. Next: 5 higher-ticket keywords.',
      accent: 'violet',
    },
    {
      name: 'Smart Farm',
      url: '—',
      status: 'Passive',
      note: 'Longan orchard 50 trees, Chiang Mai. Not actively developed.',
      accent: 'green',
    },
    {
      name: 'Moshe Oracle OS',
      url: '—',
      status: 'Building',
      note: 'Level 3 dashboard prototype built. Next: connect to ψ/ + Obsidian data.',
      accent: 'orange',
    },
  ],

  level3Phase: 'Phase 1: Dashboard prototype → Next: Real-time data connection',
}
