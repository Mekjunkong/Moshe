#!/usr/bin/env node
/**
 * generateOracleData.mjs
 * Reads ψ/ vault and generates live oracle data JSON for the dashboard.
 * Run: node scripts/generateOracleData.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const ψ = '/Users/pasuthunjunkong/workspace/Moshe/ψ';
const OUT = join(import.meta.dirname, '../public/oracleLive.json');

function readMarkdown(dir) {
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const p = join(dir, f);
        const stat = statSync(p);
        const content = readFileSync(p, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : f.replace('.md', '');
        const lines = content.split('\n').filter(l => l.trim());
        const excerpt = lines.slice(1, 4).join(' ').replace(/[#*`]/g, '').trim().slice(0, 120);
        return {
          name: title,
          file: f,
          modified: stat.mtime.toISOString().split('T')[0],
          excerpt: excerpt + (excerpt.length >= 120 ? '…' : '')
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));
  } catch {
    return [];
  }
}

function countFiles(dir, ext = '.md') {
  try {
    return readdirSync(dir).filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

const learnings = readMarkdown(join(ψ, 'memory/learnings'));
const retrospectives = readMarkdown(join(ψ, 'memory/retrospectives'));
const active = readMarkdown(join(ψ, 'active'));
const inbox = readMarkdown(join(ψ, 'inbox'));
const writing = readMarkdown(join(ψ, 'writing'));
const lab = readMarkdown(join(ψ, 'lab'));

// Projects from active/
const projects = active.filter(a => a.name.toLowerCase().includes('project') || a.file.includes('project')).slice(0, 5);

// Cron jobs (static for now — would need hermes-cli to read live)
const cronJobs = [
  { name: 'Weekly Oracle Report', schedule: 'Mon 09:00 +07', nextRun: '2026-05-04', status: 'active' }
];

// Wiro4x4 — last push info (static, would need git)
const wiro = {
  lastPush: '2026-05-02',
  commit: 'aaaf3d2',
  status: 'updating',
  url: 'https://www.wiro4x4indochina.com'
};

const data = {
  generated: new Date().toISOString(),
  stats: {
    learnings: learnings.length,
    retrospectives: retrospectives.length,
    activeProjects: active.length,
    inboxItems: inbox.length,
    writingDocs: writing.length,
    labExperiments: lab.length
  },
  learnings: learnings.slice(0, 5),
  retrospectives: retrospectives.slice(0, 3),
  projects: projects.length > 0 ? projects : [
    { name: 'Wiro4x4', modified: '2026-05-02', excerpt: 'Adventure tour business in Indochina' },
    { name: 'Aum Hippie Young', modified: '2026-05-01', excerpt: 'Lifestyle brand website' },
    { name: 'Etsy Digital Products', modified: '2026-04-30', excerpt: 'Digital product business validation' },
    { name: 'Smart Farm', modified: '2026-04-28', excerpt: 'Longan orchard 50 trees Chiangmai' }
  ],
  cronJobs,
  wiro,
  memory: {
    totalLearnings: countFiles(join(ψ, 'memory/learnings')),
    totalRetrospectives: countFiles(join(ψ, 'memory/retrospectives'))
  }
};

writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`✅ Oracle live data written to ${OUT}`);
console.log(`   Learnings: ${data.stats.learnings} | Retrospectives: ${data.stats.retrospectives} | Active: ${data.stats.activeProjects}`);
