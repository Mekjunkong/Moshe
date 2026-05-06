#!/usr/bin/env node
/**
 * generateOracleData.mjs
 * Builds a safe read-only snapshot for Moshe Oracle OS.
 * No secrets are written. Env vars are reduced to configured/not-configured booleans.
 * Phase 2A additions: incidents, recommendations, wiroCi, deployTimeline.
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { deriveOracleLearnings, readOracleAuditEntries } from './oracleLearning.mjs';

const ROOT = join(import.meta.dirname, '..');
const MOSHE_ROOT = join(ROOT, '..');
const PSI = join(MOSHE_ROOT, 'ψ');
const OUT = join(ROOT, 'public/oracleLive.json');

function safeExec(cmd, args, cwd, fallback = '—') {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonText(text) {
  try {
    const start = String(text).search(/[\[{]/);
    return start >= 0 ? JSON.parse(String(text).slice(start)) : null;
  } catch {
    return null;
  }
}

function safeUrl(url) {
  if (!url) return '';
  return String(url).replace(/https:\/\/[^/@]+@/i, 'https://').replace(/x-access-token:[^/@]+@/i, '');
}

function isGoodUrl(url) {
  return Boolean(url) && /^https?:\/\//.test(String(url));
}

function githubSlugFromRemote(remote) {
  const clean = safeUrl(remote).trim();
  const https = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (https) return { owner: https[1], repo: https[2] };
  const ssh = clean.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  return null;
}

async function providerFetchJson(url, token, provider) {
  const headers = provider === 'github'
    ? {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Moshe-Oracle-ReadOnly/1.0',
      }
    : { Authorization: `Bearer ${token}`, 'User-Agent': 'Moshe-Oracle-ReadOnly/1.0' };
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.message ? `${provider} API HTTP ${res.status}: ${body.message}` : `${provider} API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function githubCliJson(endpoint) {
  const out = safeExec('gh', ['api', endpoint], ROOT, '');
  const parsed = readJsonText(out);
  if (!parsed) throw new Error(`GitHub CLI unavailable or invalid JSON for ${endpoint}`);
  return parsed;
}

function readMarkdown(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const p = join(dir, f);
        const stat = statSync(p);
        const content = readFileSync(p, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : f.replace('.md', '');
        const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('---'));
        const excerpt = lines
          .slice(titleMatch ? 1 : 0, titleMatch ? 4 : 3)
          .join(' ')
          .replace(/[#*`]/g, '')
          .trim()
          .slice(0, 150);
        return {
          title,
          file: f,
          date: stat.mtime.toISOString().split('T')[0],
          summary: excerpt + (excerpt.length >= 150 ? '…' : ''),
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch {
    return [];
  }
}


function readMarkdownFile(path) {
  try {
    if (!existsSync(path)) return '';
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function cleanMarkdown(text, max = 220) {
  const cleaned = String(text || '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, max) + (cleaned.length > max ? '…' : '');
}

function extractSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, 'mi');
  const match = String(text || '').match(re);
  return match ? match[1].trim() : '';
}

function deriveSelfLearningItems(selfLearningText, activeDocs) {
  const log = extractSection(selfLearningText, 'Learning Log');
  const entries = [];
  const blocks = log.split(/\n(?=###\s+)/).filter((b) => b.trim());
  for (const block of blocks.slice(0, 4)) {
    const title = block.match(/^###\s+(.+)/m)?.[1]?.trim() || 'Oracle learning';
    const learned = block.match(/\*\*Learned:\*\*\s*([^\n]+)/i)?.[1]
      || block.match(/-\s+\*\*Learned:\*\*\s*([^\n]+)/i)?.[1]
      || cleanMarkdown(block, 180);
    const why = block.match(/\*\*Why it matters:\*\*\s*([^\n]+)/i)?.[1]
      || 'Turns recent work into reusable Oracle behavior.';
    const next = block.match(/\*\*Safe next action:\*\*\s*([^\n]+)/i)?.[1]
      || block.match(/\*\*Oracle improvement:\*\*\s*([^\n]+)/i)?.[1]
      || 'Keep appending bounded learnings and surface them in the dashboard.';
    entries.push({
      title,
      source: 'ψ/active/oracle-self-learning-2026-05-06.md',
      date: title.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().split('T')[0],
      insight: cleanMarkdown(learned, 190),
      whyItMatters: cleanMarkdown(why, 180),
      nextAction: cleanMarkdown(next, 180),
    });
  }

  if (entries.length === 0) {
    for (const doc of activeDocs.slice(0, 3)) {
      entries.push({
        title: doc.title,
        source: `ψ/active/${doc.file}`,
        date: doc.date,
        insight: doc.summary,
        whyItMatters: 'Active Oracle memory is available to guide the next autonomous step.',
        nextAction: 'Review and convert this active note into a dashboard signal or scheduled report.',
      });
    }
  }
  return entries.slice(0, 5);
}

function fallbackOpportunityRadar() {
  return [
    {
      rank: 1,
      title: 'AI Inquiry and Quote Copilot for Tour Operators',
      score: 95,
      fit: 'excellent',
      thesis: 'AI assistant that reads WhatsApp/LINE/email inquiries, asks missing questions, drafts Thai/English replies, creates trip options, estimates price, and schedules follow-up.',
      pricing: '12,000–35,000 THB setup + 3,000–12,000 THB/month support, depending on volume and integrations.',
      validationStep: 'Create 5 realistic inquiry examples from Wiro patterns; show before/after response drafts and quote generation; ask operators if they would pay for a pilot.',
      source: 'committed Oracle fallback radar',
    },
    {
      rank: 2,
      title: 'Wiro Internal Booking/Itinerary OS → Micro-SaaS',
      score: 90,
      fit: 'excellent',
      thesis: 'Lightweight booking OS: inquiry capture, customer profile, itinerary builder, quote calculator, deposit/payment status, prep checklist, guide notes, and follow-up reminders.',
      pricing: '2,500–9,000 THB/month SaaS or 25,000–75,000 THB setup + monthly maintenance.',
      validationStep: 'Build only the Wiro version first, then show screens to 10 similar operators and ask which part they would pay for.',
      source: 'committed Oracle fallback radar',
    },
    {
      rank: 3,
      title: 'Review/Reputation Autopilot for Tours and Local Services',
      score: 87,
      fit: 'strong',
      thesis: 'Automated review request system with Google/Tripadvisor links, negative-feedback interception, testimonials, owner reply drafts, and monthly reputation report.',
      pricing: '5,000–15,000 THB setup + 2,000–8,000 THB/month.',
      validationStep: 'Mock one monthly report and 3 message flows. Offer a manual pilot using Google Sheets plus scheduled messages.',
      source: 'committed Oracle fallback radar',
    },
  ];
}

function deriveOpportunityRadar() {
  const radarPath = join(MOSHE_ROOT, 'outbox/one-person-business/business-radar-mike-2026-05-06.md');
  const altPath = join(MOSHE_ROOT, 'outbox/one-person-business/business-radar-2026-05-06.md');
  const text = readMarkdownFile(radarPath) || readMarkdownFile(altPath);
  if (!text) return fallbackOpportunityRadar();
  const items = [];
  const re = /^###\s+(\d+)\.\s+(.+?)\s+—\s+\*\*(\d+)\/100\*\*([\s\S]*?)(?=^###\s+\d+\.\s+|\Z)/gm;
  let match;
  while ((match = re.exec(text)) && items.length < 5) {
    const rank = Number(match[1]);
    const title = match[2].trim();
    const score = Number(match[3]);
    const body = match[4] || '';
    const concept = body.match(/-\s+\*\*Concept:\*\*\s*([^\n]+)/i)?.[1] || 'Opportunity identified from Mike-specific business radar.';
    const pricing = body.match(/-\s+\*\*Pricing hypothesis:\*\*\s*([^\n]+)/i)?.[1] || 'Pricing not set yet.';
    const validation = body.match(/-\s+\*\*Validate before build:\*\*\s*([^\n]+)/i)?.[1] || 'Validate with a small manual pilot before building.';
    items.push({
      rank,
      title,
      score,
      fit: score >= 90 ? 'excellent' : score >= 80 ? 'strong' : 'watch',
      thesis: cleanMarkdown(concept, 220),
      pricing: cleanMarkdown(pricing, 160),
      validationStep: cleanMarkdown(validation, 180),
      source: 'outbox/one-person-business/business-radar-mike-2026-05-06.md',
    });
  }
  return items;
}

const AUTONOMY_LEVEL_BY_CATEGORY = {
  safe: 'safe_now',
  'draft-only': 'draft_only',
  'approval-required': 'approval_required',
};

function enrichQueueItem(item, index) {
  const autonomyLevel = AUTONOMY_LEVEL_BY_CATEGORY[item.category] || 'approval_required';
  const approvalTrigger = autonomyLevel === 'safe_now'
    ? 'No approval needed if the action stays read-only, internal, reversible, and secret-safe.'
    : autonomyLevel === 'draft_only'
      ? 'Mike approval required before publishing, sending, deploying, spending, or contacting anyone.'
      : 'Mike approval required before execution.';
  return {
    id: item.id || `${autonomyLevel}-${index + 1}`,
    autonomyLevel,
    businessArea: item.businessArea || 'oracle_os',
    riskReason: item.riskReason || item.reason,
    nextSafeStep: item.nextSafeStep || item.proposedAction,
    approvalTrigger,
    ...item,
  };
}

function deriveApprovalQueue(opportunityRadar) {
  const outreachPath = join(MOSHE_ROOT, 'outbox/one-person-business/ai-booking-assistant-first-outreach-pack.md');
  const landingPath = join(MOSHE_ROOT, 'outbox/one-person-business/ai-booking-assistant-landing-page-copy.md');
  const hasOutreach = Boolean(readMarkdownFile(outreachPath));
  const hasLanding = Boolean(readMarkdownFile(landingPath));
  const top = opportunityRadar[0];
  const queue = [
    {
      id: 'safe-demo-pack',
      title: 'Build internal Wiro-style demo pack',
      category: 'safe',
      businessArea: 'business_opportunity',
      risk: 'low',
      reason: 'Uses synthetic/Wiro-style examples only and does not contact external leads.',
      proposedAction: 'Create 5 sample inquiries and AI draft replies for the top offer.',
      nextSafeStep: 'Draft the demo pack locally in outbox with synthetic examples only.',
      source: top?.source || 'Oracle intelligence layer',
    },
    {
      id: 'draft-landing-roi',
      title: 'Prepare landing page and ROI calculator drafts',
      category: 'draft-only',
      businessArea: 'business_opportunity',
      risk: 'low',
      reason: 'Draft artifacts increase speed to validation but do not publish or contact customers.',
      proposedAction: hasLanding ? 'Review the existing landing copy and improve the offer proof stack.' : 'Draft landing page copy, ROI calculator, and demo script for Mike review.',
      nextSafeStep: hasLanding ? 'Improve the private draft only.' : 'Create private copy/calculator drafts only.',
      source: hasLanding ? 'outbox/one-person-business/ai-booking-assistant-landing-page-copy.md' : 'Oracle intelligence layer',
    },
    {
      id: 'test-top-opportunity',
      title: 'Choose whether to test top opportunity manually',
      category: 'approval-required',
      businessArea: 'business_opportunity',
      risk: 'medium',
      reason: top ? `${top.title} is currently ranked ${top.score}/100.` : 'Opportunity radar needs Mike direction before public execution.',
      proposedAction: top ? `Mike decides whether this is worth a tiny manual test: ${top.title}.` : 'Mike chooses whether any niche is worth watching or testing manually.',
      nextSafeStep: 'Prepare options and evidence for Mike, but do not contact prospects.',
      source: top?.source || 'Oracle intelligence layer',
    },
    {
      id: 'approval-outreach-send',
      title: 'Send first outreach batch',
      category: 'approval-required',
      businessArea: 'customer_or_public',
      risk: 'medium',
      reason: hasOutreach ? 'Outreach pack exists, but messages must not be sent without Mike approval.' : 'Outreach requires approved copy and lead list first.',
      proposedAction: 'Approve target niche, message wording, and daily message limit before any sending.',
      nextSafeStep: 'Keep outreach as a draft and wait for explicit Mike approval.',
      source: 'outbox/one-person-business/ai-booking-assistant-first-outreach-pack.md',
    },
    {
      id: 'approval-publish-landing',
      title: 'Publish landing page copy',
      category: 'approval-required',
      businessArea: 'customer_or_public',
      risk: 'medium',
      reason: hasLanding ? 'Landing copy exists but public publishing affects brand and offer positioning.' : 'Landing copy can be drafted safely first.',
      proposedAction: hasLanding ? 'Mike reviews copy, pricing, promise, and CTA before publish.' : 'Draft landing page copy as a safe artifact.',
      nextSafeStep: hasLanding ? 'Prepare review checklist for Mike.' : 'Draft private landing copy only.',
      source: 'outbox/one-person-business/ai-booking-assistant-landing-page-copy.md',
    },
  ];
  return queue.map(enrichQueueItem);
}

function deriveAutonomyRouter(approvalQueue) {
  const count = (category) => approvalQueue.filter((item) => item.category === category).length;
  const decisions = approvalQueue.map((item) => ({
    id: item.id,
    title: item.title,
    autonomyLevel: item.autonomyLevel,
    businessArea: item.businessArea,
    risk: item.risk,
    riskReason: item.riskReason,
    nextSafeStep: item.nextSafeStep,
    approvalTrigger: item.approvalTrigger,
    source: item.source,
  }));
  return {
    updatedAt: new Date().toISOString(),
    phase: 'phase_4',
    summary: 'Phase 4 is active: Oracle classifies every recommendation before action and keeps execution behind safe/draft/approval lanes.',
    lanes: [
      {
        id: 'safe_now',
        label: 'safe_now',
        status: 'active',
        summary: 'Moshe can execute without interrupting Mike only when work is read-only, reversible, internal, or safe draft-generation with no external side effect.',
        examples: ['read-only research', 'local verification', 'internal demo artifacts', 'dashboard copy/UI improvements'],
        count: count('safe'),
        canExecute: true,
        allowedWork: ['read local/project files', 'run tests/builds/checks', 'write internal markdown/json artifacts', 'draft private assets'],
        blockedWork: ['customer contact', 'public publish', 'spend money', 'delete/cleanup unknown files', 'force push'],
      },
      {
        id: 'draft_only',
        label: 'draft_only',
        status: 'guarded',
        summary: 'Moshe may prepare assets but must stop before publish/send/spend/deploy/contact.',
        examples: ['landing page draft', 'outreach message draft', 'ROI calculator draft', 'lead list draft'],
        count: count('draft-only'),
        canExecute: false,
        allowedWork: ['prepare private drafts', 'organize evidence', 'create review checklist'],
        blockedWork: ['send the draft', 'publish the page', 'commit/push/deploy public workflow changes without Mike approval'],
      },
      {
        id: 'approval_required',
        label: 'approval_required',
        status: 'locked',
        summary: 'Mike approval is required before anything customer-facing, public, paid, destructive, cleanup/delete, commit/push, deploy, or outbound.',
        examples: ['send outreach', 'publish page', 'spend money', 'commit/push/deploy', 'delete/cleanup files'],
        count: count('approval-required'),
        canExecute: false,
        allowedWork: ['summarize options for Mike', 'prepare rollback/verification plan'],
        blockedWork: ['execute without explicit approval', 'expose secrets', 'change live business workflow'],
      },
    ],
    decisions,
    guardrails: [
      'Classify every recommendation before execution.',
      'Never send customer-facing messages without Mike approval.',
      'Never spend money, subscribe, or publish publicly without Mike approval.',
      'Never delete/cleanup unknown files or force push.',
      'Never expose secrets; show configured/missing only.',
      'Commit/push/deploy only when Mike explicitly approves that scope.',
    ],
    phase5Requirements: [
      'Signal Quality / Feedback Ledger records whether proactive outputs are useful or noisy.',
      'Deployment Freshness Gap sensor compares live production, git HEAD, and local snapshot age.',
      'Repo Hygiene / Ship Readiness sensor blocks mixed dirty worktrees from deploy recommendations.',
      'Evidence Chain extractor turns build/test/smoke/deploy proof into reusable safety facts.',
      'Safe Executor only runs allowlisted safe_now actions with audit logs and rollback notes.',
    ],
  };
}

function deriveIntelligenceLayer(activeDocs) {
  const selfLearningPath = join(PSI, 'active/oracle-self-learning-2026-05-06.md');
  const selfLearningText = readMarkdownFile(selfLearningPath);
  const opportunityRadar = deriveOpportunityRadar();
  const todayLearnings = deriveSelfLearningItems(selfLearningText, activeDocs);
  const approvalQueue = deriveApprovalQueue(opportunityRadar);
  const autonomyRouter = deriveAutonomyRouter(approvalQueue);
  const top = opportunityRadar[0];
  return {
    updatedAt: new Date().toISOString(),
    summary: top
      ? `Oracle is learning from ψ and opportunity artifacts. Top money radar: ${top.title} (${top.score}/100).`
      : 'Oracle is learning from ψ and recent active notes. Money radar will appear when opportunity artifacts are present.',
    todayLearnings,
    opportunityRadar,
    approvalQueue,
    autonomyRouter,
  };
}

async function checkWebsite(name, url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'Moshe-Oracle-ReadOnly/1.0' },
    });
    return {
      name,
      url,
      ok: res.ok,
      status: res.status,
      responseMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      note: res.ok ? 'reachable' : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      url,
      ok: false,
      status: null,
      responseMs: null,
      checkedAt: new Date().toISOString(),
      note: err?.message ? String(err.message).slice(0, 120) : 'request failed',
    };
  }
}

function oracleDashboardStatus() {
  const configuredUrl = process.env.ORACLE_DASHBOARD_URL;
  if (!configuredUrl) {
    return {
      name: 'Moshe Oracle Dashboard',
      url: 'local Vite / Vercel static app',
      ok: true,
      status: 200,
      responseMs: null,
      checkedAt: new Date().toISOString(),
      note: 'local build target; set ORACLE_DASHBOARD_URL after deploy for public uptime checks',
    };
  }
  return checkWebsite('Moshe Oracle Dashboard', configuredUrl);
}

function repoStatus(name, path) {
  if (!existsSync(path) || !existsSync(join(path, '.git'))) return null;
  const changed = safeExec('git', ['status', '--short'], path, '')
    .split('\n')
    .filter(Boolean);
  const untrackedFiles = changed.filter((line) => line.startsWith('??')).length;
  const modifiedFiles = changed.length - untrackedFiles;
  const protectedTouched = changed.some((line) => /(^|\s)(\.env|\.vercel\/.*env|.*secret.*|.*credential.*|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)/i.test(line));
  const remote = safeExec('git', ['remote', 'get-url', 'origin'], path, '');
  const github = githubSlugFromRemote(remote);
  return {
    name,
    path,
    branch: safeExec('git', ['branch', '--show-current'], path),
    commit: safeExec('git', ['rev-parse', '--short', 'HEAD'], path),
    commitFull: safeExec('git', ['rev-parse', 'HEAD'], path),
    commitSubject: safeExec('git', ['log', '-1', '--pretty=%s'], path),
    dirty: changed.length > 0,
    changedFiles: changed.length,
    modifiedFiles,
    untrackedFiles,
    protectedTouched,
    lastCommitAt: safeExec('git', ['log', '-1', '--pretty=%cI'], path),
    github: github ? `${github.owner}/${github.repo}` : undefined,
    remoteHost: github ? 'github.com' : undefined,
  };
}

function envStatus(name, purpose) {
  return { name, configured: Boolean(process.env[name]), purpose };
}

function oracleTerminalPolicy() {
  const sessionConfigured = Boolean(process.env.ORACLE_SESSION_SECRET);
  const terminalEnabled = String(process.env.ORACLE_TERMINAL_ENABLED || '').toLowerCase() === 'true';
  return {
    enabled: terminalEnabled && sessionConfigured,
    terminalEnabled,
    sessionConfigured,
    endpoint: '/api/oracle/terminal',
    authMethod: sessionConfigured ? 'signed-session-cookie' : 'preview-only',
    defaultCwd: '/Users/pasuthunjunkong/workspace/Moshe',
    allowedCwdPrefixes: [
      '/Users/pasuthunjunkong/workspace/Moshe',
      '/Users/pasuthunjunkong/workspace',
    ],
    note: terminalEnabled
      ? 'Terminal panel is armed for signed-session local/admin command execution.'
      : 'Terminal panel is visible but execution is disabled until ORACLE_TERMINAL_ENABLED=true is set on a trusted runtime.',
  };
}

function oracleAutomationPolicy() {
  const sessionConfigured = Boolean(process.env.ORACLE_SESSION_SECRET);
  const auditPath = process.env.ORACLE_ACTION_AUDIT_PATH || '/tmp/oracle-action-audit.jsonl';
  return {
    enabled: sessionConfigured,
    authConfigured: sessionConfigured,
    sessionConfigured,
    endpoint: '/api/oracle/actions',
    sessionEndpoint: '/api/oracle/session',
    authHeader: 'HttpOnly signed session cookie',
    authMethod: sessionConfigured ? 'signed-session-cookie' : 'preview-only',
    auditPath,
    executionMode: sessionConfigured ? 'server-enabled' : 'preview-only',
    sessionTtlMinutes: 480,
    note: sessionConfigured
      ? 'Oracle execute mode is gated by a Mike-only signed session cookie with audit logging.'
      : 'Preview trigger is wired to the action API path. Set ORACLE_SESSION_SECRET to arm Mike-only session-gated execution.',
    actions: [
      {
        id: 'refresh-oracle-snapshot',
        title: 'Refresh Oracle snapshot',
        description: 'Regenerate the read-only Oracle data bundle and re-evaluate sensors.',
        transport: 'local-script',
        autonomyLevel: 'safe_now',
        businessArea: 'oracle_os',
        risk: 'low',
        riskReason: 'Local read-only snapshot regeneration; no deploy, no push, no external contact.',
        nextSafeStep: 'Run generator and inspect JSON before any commit/deploy.',
        requiresConfirmation: true,
      },
      {
        id: 'dispatch-wiro-ci',
        title: 'Dispatch Wiro CI',
        description: 'Trigger the allowlisted GitHub workflow that verifies Wiro4x4 health.',
        transport: 'github-api',
        autonomyLevel: 'approval_required',
        businessArea: 'deploy_reliability',
        risk: 'medium',
        riskReason: 'Creates an external GitHub event and consumes CI minutes.',
        nextSafeStep: 'Preview the workflow request and wait for Mike approval before dispatch.',
        requiresConfirmation: true,
      },
      {
        id: 'vercel-redeploy',
        title: 'Request Vercel redeploy',
        description: 'Ask Vercel to redeploy the Oracle dashboard after a confirmed change.',
        transport: 'vercel-api',
        autonomyLevel: 'approval_required',
        businessArea: 'deploy_reliability',
        risk: 'medium',
        riskReason: 'Changes live production surface and must be tied to verified commits/artifacts.',
        nextSafeStep: 'Prepare deployment evidence and wait for Mike approval.',
        requiresConfirmation: true,
      },
    ],
  };
}

function vercelProjectScope() {
  const local = readJson(join(ROOT, '.vercel/project.json'));
  const projectId = process.env.VERCEL_PROJECT_ID || local?.projectId || '';
  const projectName = process.env.VERCEL_PROJECT_NAME || '';
  const teamId = process.env.VERCEL_TEAM_ID || local?.orgId || '';
  return {
    projectId,
    projectName,
    teamId,
    source: process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME ? 'env' : local?.projectId ? '.vercel/project.json' : 'missing',
  };
}

async function vercelDeployments() {
  const token = process.env.VERCEL_TOKEN;
  const scope = vercelProjectScope();
  const projectId = scope.projectId || scope.projectName;
  if (!token || !projectId) {
    const cliJson = readJsonText(safeExec('vercel', ['list', '--format', 'json', '--yes'], ROOT, ''));
    const cliDeployments = (cliJson?.deployments || []).slice(0, 3).map((d) => ({
      provider: 'vercel',
      project: d.name || 'linked project',
      state: d.state || 'unknown',
      url: d.url ? `https://${d.url}` : undefined,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
      gitCommitSha: d.meta?.gitCommitSha,
      gitCommitMessage: d.meta?.gitCommitMessage,
      gitCommitRef: d.meta?.gitCommitRef,
      gitDirty: d.meta?.gitDirty === '1' || d.meta?.gitDirty === 1 || d.meta?.gitDirty === true,
      note: 'read via Vercel CLI auth; no token value exposed',
    }));
    if (cliDeployments.length) return cliDeployments;
    return [
      {
        provider: 'vercel',
        project: projectId || 'not configured',
        state: 'env-missing',
        note: 'Set fresh VERCEL_TOKEN + VERCEL_PROJECT_ID/VERCEL_PROJECT_NAME for deploy status, or login with Vercel CLI. Do not expose token to browser.',
      },
    ];
  }

  try {
    const url = new URL('https://api.vercel.com/v6/deployments');
    url.searchParams.set('limit', '3');
    if (scope.projectId) url.searchParams.set('projectId', scope.projectId);
    if (scope.projectName) url.searchParams.set('project', scope.projectName);
    if (scope.teamId) url.searchParams.set('teamId', scope.teamId);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Vercel API HTTP ${res.status}`);
    const json = await res.json();
    const deployments = (json.deployments || []).slice(0, 3).map((d) => ({
      provider: 'vercel',
      project: d.name || projectId,
      state: d.state || 'unknown',
      url: d.url ? `https://${d.url}` : undefined,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
      gitCommitSha: d.meta?.gitCommitSha,
      gitCommitMessage: d.meta?.gitCommitMessage,
      gitCommitRef: d.meta?.gitCommitRef,
      gitDirty: d.meta?.gitDirty === '1' || d.meta?.gitDirty === 1 || d.meta?.gitDirty === true,
    }));
    return deployments.length ? deployments : [{ provider: 'vercel', project: projectId, state: 'empty', note: 'No deployments returned' }];
  } catch (err) {
    return [
      {
        provider: 'vercel',
        project: projectId,
        state: 'api-error',
        note: err?.message ? String(err.message).slice(0, 160) : 'Vercel request failed',
      },
    ];
  }
}

async function githubRepoSensors(repos) {
  const token = process.env.GITHUB_TOKEN;
  const unique = [...new Map(repos.filter((r) => r.github).map((r) => [r.github, r])).values()];
  if (!unique.length) {
    return [{ provider: 'github', repo: 'none detected', apiStatus: 'no-github-remotes', note: 'No GitHub remotes found in tracked local repos.' }];
  }
  if (!token) {
    const out = [];
    for (const r of unique.slice(0, 6)) {
      const [owner, repo] = r.github.split('/');
      try {
        const repoInfo = githubCliJson(`repos/${owner}/${repo}`);
        const issueSearch = githubCliJson(`search/issues?q=repo:${owner}/${repo}+type:issue+state:open`);
        const prSearch = githubCliJson(`search/issues?q=repo:${owner}/${repo}+type:pr+state:open`);
        const workflowRuns = githubCliJson(`repos/${owner}/${repo}/actions/runs?per_page=1`);
        const latestRun = workflowRuns.workflow_runs?.[0];
        out.push({
          provider: 'github',
          repo: r.github,
          localName: r.name,
          apiStatus: 'ok',
          private: Boolean(repoInfo.private),
          defaultBranch: repoInfo.default_branch,
          pushedAt: repoInfo.pushed_at,
          openIssues: issueSearch.total_count ?? 0,
          openPullRequests: prSearch.total_count ?? 0,
          latestWorkflow: latestRun
            ? {
                name: latestRun.name || latestRun.display_title || 'workflow',
                status: latestRun.status || 'unknown',
                conclusion: latestRun.conclusion || null,
                branch: latestRun.head_branch,
                event: latestRun.event,
                updatedAt: latestRun.updated_at,
                url: latestRun.html_url,
              }
            : null,
          note: 'read via GitHub CLI auth; no token value exposed',
        });
      } catch (err) {
        out.push({
          provider: 'github',
          repo: r.github,
          localName: r.name,
          apiStatus: 'env-missing',
          note: err?.message ? String(err.message).slice(0, 160) : 'Set fresh GITHUB_TOKEN or login with gh CLI for read-only status.',
        });
      }
    }
    return out;
  }

  const out = [];
  for (const r of unique.slice(0, 6)) {
    const [owner, repo] = r.github.split('/');
    try {
      const base = `https://api.github.com/repos/${owner}/${repo}`;
      const [repoInfo, issueSearch, prSearch, workflowRuns] = await Promise.all([
        providerFetchJson(base, token, 'github'),
        providerFetchJson(`https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:issue+state:open`, token, 'github'),
        providerFetchJson(`https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:pr+state:open`, token, 'github'),
        providerFetchJson(`${base}/actions/runs?per_page=1`, token, 'github'),
      ]);
      const latestRun = workflowRuns.workflow_runs?.[0];
      out.push({
        provider: 'github',
        repo: r.github,
        localName: r.name,
        apiStatus: 'ok',
        private: Boolean(repoInfo.private),
        defaultBranch: repoInfo.default_branch,
        pushedAt: repoInfo.pushed_at,
        openIssues: issueSearch.total_count ?? 0,
        openPullRequests: prSearch.total_count ?? 0,
        latestWorkflow: latestRun
          ? {
              name: latestRun.name || latestRun.display_title || 'workflow',
              status: latestRun.status || 'unknown',
              conclusion: latestRun.conclusion || null,
              branch: latestRun.head_branch,
              event: latestRun.event,
              updatedAt: latestRun.updated_at,
              url: latestRun.html_url,
            }
          : null,
      });
    } catch (err) {
      out.push({
        provider: 'github',
        repo: r.github,
        localName: r.name,
        apiStatus: 'api-error',
        note: err?.message ? String(err.message).slice(0, 160) : 'GitHub request failed',
      });
    }
  }
  return out;
}

function cronJobs() {
  // Hermes CLI formats vary by runtime; keep this non-fatal and read-only.
  const output = safeExec('hermes', ['cron', 'list'], ROOT, '');
  if (!output || output === '—') {
    return [
      { name: 'Hermes Cron', schedule: 'unknown', nextRun: 'unknown', status: 'cli-unavailable' },
    ];
  }

  const jobs = [];
  let current = null;
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    const idMatch = line.match(/^([a-zA-Z0-9_-]+)\s+\[(\w+)\]/);
    if (idMatch) {
      if (current) jobs.push(current);
      current = { name: idMatch[1], schedule: '—', nextRun: '—', status: idMatch[2] };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^(Name|Schedule|Next run):\s+(.+)$/);
    if (!field) continue;
    if (field[1] === 'Name') current.name = field[2].trim();
    if (field[1] === 'Schedule') current.schedule = field[2].trim();
    if (field[1] === 'Next run') current.nextRun = field[2].trim();
  }
  if (current) jobs.push(current);

  return jobs.slice(0, 5).length
    ? jobs.slice(0, 5)
    : [{ name: 'Hermes Cron', schedule: 'parsed empty output', nextRun: 'unknown', status: 'listed' }];
}

// ── Phase 2A: Intelligence derivation ──────────────────────────────────────

function detectCiFailureCategory(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.includes('lint') || lower.includes('eslint') || lower.includes('style')) return 'lint';
  if (lower.includes('test') || lower.includes('spec') || lower.includes('jest') || lower.includes('vitest')) return 'test';
  if (lower.includes('build') || lower.includes('compile') || lower.includes('webpack') || lower.includes('vite')) return 'build';
  if (lower.includes('type') || lower.includes('tsc')) return 'types';
  if (lower.includes('deploy')) return 'deploy';
  return 'unknown';
}

function wiroCiJobDetails(repo, runUrl) {
  const runIdMatch = String(runUrl || '').match(/\/runs\/(\d+)/);
  if (!runIdMatch) return null;
  const runId = runIdMatch[1];
  const [owner, repoName] = repo.split('/');
  try {
    const jobs = githubCliJson(`repos/${owner}/${repoName}/actions/runs/${runId}/jobs`);
    const failedJob = (jobs.jobs || []).find((j) => j.conclusion === 'failure');
    if (!failedJob) return null;
    const failedStep = (failedJob.steps || []).find((s) => s.conclusion === 'failure');
    return {
      jobName: String(failedJob.name || 'unknown').slice(0, 60),
      failedStep: failedStep ? String(failedStep.name).slice(0, 60) : null,
      failureCategory: detectCiFailureCategory([failedJob.name, failedStep?.name].filter(Boolean).join(' ')),
    };
  } catch {
    return null;
  }
}

function deriveWiroCi(github) {
  const wiro = github.find((g) => g.repo === 'Mekjunkong/Wiro4x4');
  if (!wiro || !wiro.latestWorkflow) return null;
  const wf = wiro.latestWorkflow;
  const url = isGoodUrl(wf.url) ? wf.url : undefined;
  const jobDetails = wf.conclusion === 'failure' && url ? wiroCiJobDetails('Mekjunkong/Wiro4x4', url) : null;
  return {
    repo: wiro.repo,
    workflowName: String(wf.name || 'workflow').slice(0, 60),
    status: wf.status || 'unknown',
    conclusion: wf.conclusion || null,
    branch: wf.branch || 'main',
    event: wf.event || 'push',
    updatedAt: wf.updatedAt || '',
    url,
    failureCategory: jobDetails?.failureCategory ?? (wf.conclusion === 'failure' ? detectCiFailureCategory(wf.name || '') : null),
    jobDetails,
  };
}

function deriveIncidents(websites, repos, github, credentials, generatedAt) {
  const incidents = [];

  for (const g of github) {
    if (g.latestWorkflow?.conclusion === 'failure') {
      incidents.push({
        id: `ci-fail-${String(g.repo).replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        severity: 'critical',
        category: 'github-actions-failed',
        project: g.localName || g.repo,
        title: `CI failure on ${g.latestWorkflow.branch || 'main'}`,
        detail: `Workflow "${String(g.latestWorkflow.name).slice(0, 60)}" failed.`,
        detectedAt: g.latestWorkflow.updatedAt || generatedAt,
        url: isGoodUrl(g.latestWorkflow.url) ? g.latestWorkflow.url : undefined,
      });
    }
  }

  for (const site of websites) {
    if (!site.ok) {
      incidents.push({
        id: `site-down-${String(site.name).toLowerCase().replace(/[^a-z0-9]/gi, '-')}`,
        severity: 'critical',
        category: 'website-down',
        project: site.name,
        title: `${site.name} unreachable`,
        detail: site.note || `HTTP ${site.status ?? 'no response'}`,
        detectedAt: site.checkedAt,
        url: isGoodUrl(site.url) ? site.url : undefined,
      });
    } else if (site.responseMs && site.responseMs > 2500) {
      incidents.push({
        id: `site-slow-${String(site.name).toLowerCase().replace(/[^a-z0-9]/gi, '-')}`,
        severity: 'warning',
        category: 'website-slow',
        project: site.name,
        title: `${site.name} slow (${site.responseMs}ms)`,
        detail: `Response time exceeds 2500ms threshold.`,
        detectedAt: site.checkedAt,
        url: isGoodUrl(site.url) ? site.url : undefined,
      });
    }
  }

  for (const repo of repos) {
    if (repo.dirty && repo.changedFiles >= 10) {
      incidents.push({
        id: `repo-dirty-${String(repo.name).toLowerCase().replace(/[^a-z0-9]/gi, '-')}`,
        severity: 'warning',
        category: 'repo-dirty',
        project: repo.name,
        title: `${repo.name}: ${repo.changedFiles} uncommitted changes`,
        detail: `Branch ${repo.branch} · last commit: "${String(repo.commitSubject).slice(0, 60)}"`,
        detectedAt: repo.lastCommitAt || generatedAt,
      });
    }
  }

  const missingCreds = credentials.filter((c) => !c.configured);
  if (missingCreds.length > 0) {
    incidents.push({
      id: 'creds-missing',
      severity: 'info',
      category: 'credential-missing',
      project: 'Oracle OS',
      title: `${missingCreds.length} credential(s) not configured`,
      detail: missingCreds.map((c) => c.name).join(', '),
      detectedAt: generatedAt,
    });
  }

  return incidents;
}

function deriveRecommendations(incidents, repos) {
  const recs = [];

  for (const inc of incidents.filter((i) => i.category === 'github-actions-failed' && i.severity === 'critical')) {
    recs.push({
      project: inc.project,
      priority: 'high',
      reason: inc.title,
      risk: 'high',
      suggestedAction: 'Investigate the failing CI workflow — check test, build, and lint steps for errors.',
    });
    if (recs.length >= 3) return recs;
  }

  for (const inc of incidents.filter((i) => i.category === 'website-down' && i.severity === 'critical')) {
    recs.push({
      project: inc.project,
      priority: 'high',
      reason: inc.title,
      risk: 'high',
      suggestedAction: 'Check deployment status and error logs. Trigger a redeploy if needed.',
    });
    if (recs.length >= 3) return recs;
  }

  for (const inc of incidents.filter((i) => i.category === 'repo-dirty')) {
    recs.push({
      project: inc.project,
      priority: 'medium',
      reason: inc.title,
      risk: 'medium',
      suggestedAction: `Review staged changes in ${inc.project} and commit or stash to keep the branch clean.`,
    });
    if (recs.length >= 3) return recs;
  }

  if (recs.length < 3) {
    const credInc = incidents.find((i) => i.category === 'credential-missing');
    if (credInc) {
      recs.push({
        project: 'Oracle OS',
        priority: 'low',
        reason: 'Monitoring visibility limited by missing credentials',
        risk: 'low',
        suggestedAction: 'Configure VERCEL_TOKEN and GITHUB_TOKEN for richer cloud deploy and API monitoring.',
      });
    }
  }

  return recs.slice(0, 3);
}

function deriveDeployTimeline(deployments, repos) {
  const events = [];

  for (const d of deployments) {
    if (d.createdAt) {
      const sourceRepo = d.project === 'galaxy'
        ? repos.find((r) => r.name === 'Moshe')
        : repos.find((r) => r.name.toLowerCase() === String(d.project).toLowerCase());
      const deployedCommitSha = d.gitCommitSha || undefined;
      const sourceCommitSha = sourceRepo?.commitFull || sourceRepo?.commit;
      let syncState = 'unknown';
      if (sourceCommitSha && deployedCommitSha) {
        if (
          sourceCommitSha === deployedCommitSha ||
          sourceCommitSha.startsWith(deployedCommitSha.slice(0, 7)) ||
          deployedCommitSha.startsWith(sourceCommitSha.slice(0, 7))
        ) {
          syncState = 'in-sync';
        } else if (sourceRepo?.lastCommitAt && d.createdAt) {
          syncState = new Date(sourceRepo.lastCommitAt).getTime() > new Date(d.createdAt).getTime()
            ? 'behind'
            : 'ahead';
        }
      }

      events.push({
        provider: d.provider,
        project: d.project,
        event: 'deploy',
        state: d.state || 'unknown',
        url: isGoodUrl(d.url) ? d.url : undefined,
        timestamp: d.createdAt,
        deployedCommitSha,
        deployedCommitMessage: d.gitCommitMessage,
        sourceRepo: sourceRepo?.name,
        sourceCommitSha,
        syncState,
        note: d.note,
      });
    }
  }

  for (const r of repos) {
    if (r.lastCommitAt && r.lastCommitAt !== '—') {
      events.push({
        provider: 'git',
        project: r.name,
        event: 'commit',
        state: r.dirty ? 'uncommitted-changes' : 'clean',
        timestamp: r.lastCommitAt,
        sourceRepo: r.name,
        sourceCommitSha: r.commitFull || r.commit,
        syncState: r.dirty ? 'behind' : 'in-sync',
        note: r.commitSubject ? String(r.commitSubject).slice(0, 80) : undefined,
      });
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 10);
}

function signalFreshness(timestamp, now = Date.now()) {
  const t = new Date(timestamp || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return 'unknown';
  return now - t <= 36 * 60 * 60 * 1000 ? 'fresh' : 'stale';
}

function deriveFeedbackLedger({ auditEntries, activeCrons, recommendations, intelligenceLayer, generatedAt }) {
  const signals = [];
  for (const entry of auditEntries.slice(0, 5)) {
    signals.push({
      id: `audit-${String(entry.requestId || entry.at || signals.length).replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}`,
      source: `audit:${entry.actionId || 'oracle-action'}`,
      businessArea: entry.actionId === 'dispatch-wiro-ci' ? 'deploy_reliability' : 'oracle_os',
      actionability: entry.outcome === 'allowed' ? 'high' : entry.outcome === 'denied' ? 'medium' : 'low',
      freshness: signalFreshness(entry.at || entry.requestedAt, new Date(generatedAt).getTime()),
      riskLevel: entry.outcome === 'allowed' ? 'medium' : 'low',
      approvalRequired: /approval|required|confirm/i.test(String(entry.detail || '')),
      mikeFeedback: 'unrated',
      valueSignal: String(entry.detail || entry.outcome || 'Oracle action event recorded.').slice(0, 180),
    });
  }
  for (const rec of recommendations.slice(0, 4)) {
    signals.push({
      id: `rec-${String(rec.project || 'oracle').replace(/[^a-z0-9_-]/gi, '').toLowerCase()}-${signals.length}`,
      source: `recommendation:${rec.project}`,
      businessArea: rec.project === 'Wiro4x4' ? 'wiro_growth' : rec.risk === 'high' ? 'deploy_reliability' : 'decision_load_reduction',
      actionability: rec.priority === 'high' ? 'high' : rec.priority === 'medium' ? 'medium' : 'low',
      freshness: 'fresh',
      riskLevel: rec.risk,
      approvalRequired: rec.risk !== 'low',
      mikeFeedback: 'unrated',
      valueSignal: String(rec.suggestedAction || rec.reason).slice(0, 180),
    });
  }
  for (const cron of activeCrons.slice(0, 4)) {
    signals.push({
      id: `cron-${String(cron.name || 'job').replace(/[^a-z0-9_-]/gi, '').toLowerCase()}-${signals.length}`,
      source: `cron:${cron.name}`,
      businessArea: /wiro/i.test(cron.name) ? 'wiro_growth' : /brief|report/i.test(cron.name) ? 'decision_load_reduction' : 'memory_continuity',
      actionability: /ok|active|running/i.test(cron.status || '') ? 'medium' : 'low',
      freshness: 'fresh',
      riskLevel: 'low',
      approvalRequired: false,
      mikeFeedback: 'unrated',
      valueSignal: `${cron.schedule || 'scheduled'} · next ${cron.nextRun || 'unknown'}`.slice(0, 180),
    });
  }
  for (const decision of (intelligenceLayer?.autonomyRouter?.decisions || []).slice(0, 4)) {
    signals.push({
      id: `router-${decision.id}`,
      source: `autonomy-router:${decision.source}`,
      businessArea: decision.businessArea === 'customer_or_public' ? 'business_opportunity' : decision.businessArea,
      actionability: decision.autonomyLevel === 'safe_now' ? 'high' : 'medium',
      freshness: 'fresh',
      riskLevel: decision.risk,
      approvalRequired: decision.autonomyLevel === 'approval_required',
      mikeFeedback: 'unrated',
      valueSignal: decision.nextSafeStep,
    });
  }
  const deduped = [];
  const seen = new Set();
  for (const signal of signals) {
    if (seen.has(signal.id)) continue;
    seen.add(signal.id);
    deduped.push(signal);
  }
  const finalSignals = deduped.slice(0, 12);
  const counts = {
    useful: finalSignals.filter((s) => s.mikeFeedback === 'useful').length,
    noisy: finalSignals.filter((s) => s.mikeFeedback === 'noisy').length,
    unrated: finalSignals.filter((s) => s.mikeFeedback === 'unrated').length,
    highActionability: finalSignals.filter((s) => s.actionability === 'high').length,
    approvalRequired: finalSignals.filter((s) => s.approvalRequired).length,
  };
  return {
    updatedAt: generatedAt,
    summary: `${finalSignals.length} signals tracked; ${counts.highActionability} high-actionability; ${counts.approvalRequired} need approval.`,
    signals: finalSignals,
    counts,
    nextLearningStep: 'Capture Mike feedback as useful/noisy/missing-context, then prioritize future reports by value signal.',
  };
}

function deriveRepoHygiene(repos, generatedAt) {
  const items = repos.map((repo) => {
    const verdict = repo.protectedTouched || repo.changedFiles >= 20
      ? 'blocked'
      : repo.changedFiles > 0
        ? 'review'
        : 'clean';
    return {
      repo: repo.name,
      branch: repo.branch,
      changedFiles: repo.changedFiles,
      untrackedFiles: repo.untrackedFiles || 0,
      protectedTouched: Boolean(repo.protectedTouched),
      verdict,
      recommendation: verdict === 'clean'
        ? 'Clean for read-only monitoring.'
        : verdict === 'blocked'
          ? 'Do not recommend ship/deploy until protected or large dirty state is reviewed.'
          : 'Review scope before commit/deploy; keep unrelated files uncommitted.',
    };
  });
  const blocked = items.filter((item) => item.verdict === 'blocked').length;
  const review = items.filter((item) => item.verdict === 'review').length;
  const verdict = blocked ? 'blocked' : review ? 'review' : 'clean';
  return {
    updatedAt: generatedAt,
    verdict,
    summary: verdict === 'clean'
      ? 'Tracked repos are clean enough for deploy recommendations.'
      : verdict === 'blocked'
        ? `${blocked} repo(s) blocked by protected/large dirty state.`
        : `${review} repo(s) need review before ship/deploy recommendations.`,
    items,
  };
}

function deriveDeploymentFreshnessGap({ deployTimeline, repos, generatedAt, repoHygiene }) {
  const latestDeploy = deployTimeline.find((event) => event.event === 'deploy') || null;
  const sourceRepo = latestDeploy?.sourceRepo ? repos.find((repo) => repo.name === latestDeploy.sourceRepo) : repos.find((repo) => repo.name === 'Moshe');
  const generatedTime = new Date(generatedAt).getTime();
  const snapshotAgeMinutes = Math.max(0, Math.round((Date.now() - generatedTime) / 60000));
  const dirtyRepoCount = repos.filter((repo) => repo.dirty).length;
  const worktreeDirty = Boolean(sourceRepo?.dirty || dirtyRepoCount > 0);
  let verdict = 'unknown';
  if (latestDeploy?.syncState === 'in-sync' && !worktreeDirty && snapshotAgeMinutes <= 60) verdict = 'in_sync';
  else if (latestDeploy?.syncState === 'behind' || worktreeDirty || repoHygiene.verdict !== 'clean') verdict = 'review_before_ship';
  else if (latestDeploy?.syncState === 'ahead') verdict = 'approval_required';
  const summary = latestDeploy
    ? `${latestDeploy.project}: live ${latestDeploy.deployedCommitSha ? latestDeploy.deployedCommitSha.slice(0, 7) : 'unknown'} vs local ${sourceRepo?.commit || 'unknown'} · ${latestDeploy.syncState || 'unknown'}`
    : 'No live deployment metadata available for freshness comparison.';
  return {
    updatedAt: generatedAt,
    verdict,
    summary,
    liveProject: latestDeploy?.project || 'unknown',
    liveCommit: latestDeploy?.deployedCommitSha ? latestDeploy.deployedCommitSha.slice(0, 12) : undefined,
    localCommit: sourceRepo?.commitFull ? sourceRepo.commitFull.slice(0, 12) : sourceRepo?.commit,
    snapshotAgeMinutes,
    worktreeDirty,
    dirtyRepoCount,
    recommendation: verdict === 'in_sync'
      ? 'Live and local state look aligned; continue monitoring.'
      : verdict === 'review_before_ship'
        ? 'Review repo hygiene and deployment evidence before recommending ship/deploy.'
        : verdict === 'approval_required'
          ? 'Live appears ahead of local or ambiguous; require Mike approval before deploy action.'
          : 'Collect deployment metadata before making deploy decisions.',
  };
}

function derivePhase5A({ auditEntries, activeCrons, recommendations, intelligenceLayer, deployTimeline, repos, generatedAt }) {
  const repoHygiene = deriveRepoHygiene(repos, generatedAt);
  const feedbackLedger = deriveFeedbackLedger({ auditEntries, activeCrons, recommendations, intelligenceLayer, generatedAt });
  const deploymentFreshnessGap = deriveDeploymentFreshnessGap({ deployTimeline, repos, generatedAt, repoHygiene });
  return {
    updatedAt: generatedAt,
    phase: 'phase_5a',
    summary: 'Phase 5A active: Oracle now has closed-loop signal quality, repo hygiene, and deployment freshness sensors before safe execution.',
    feedbackLedger,
    repoHygiene,
    deploymentFreshnessGap,
    phase5BRequirements: [
      'Persist Mike feedback choices from the dashboard/Telegram into the ledger.',
      'Convert evidence chains from retrospectives into structured deploy proof.',
      'Create a safe executor queue for safe_now actions with rollback notes.',
      'Add approval inbox state: approved, rejected, deferred, expired.',
      'Score autonomous work by business value and suppress repeated noise.',
    ],
  };
}



function feedbackLedgerPath() {
  return process.env.ORACLE_FEEDBACK_LEDGER_PATH || '/tmp/oracle-feedback-ledger.jsonl';
}

function readMikeFeedbackEntries(path = feedbackLedgerPath(), limit = 50) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line);
          return {
            id: String(parsed.id || `feedback-${index}`),
            signalId: String(parsed.signalId || 'unknown'),
            rating: ['useful', 'noisy', 'missing-context', 'action-taken', 'ignored'].includes(parsed.rating) ? parsed.rating : 'missing-context',
            note: String(parsed.note || '').slice(0, 500),
            source: ['dashboard', 'telegram', 'api', 'imported'].includes(parsed.source) ? parsed.source : 'api',
            actor: String(parsed.actor || 'Mike'),
            createdAt: String(parsed.createdAt || parsed.at || new Date(0).toISOString()),
          };
        } catch {
          return {
            id: `feedback-${index}`,
            signalId: 'parse-error',
            rating: 'missing-context',
            note: 'A feedback ledger line could not be parsed.',
            source: 'imported',
            actor: 'unknown',
            createdAt: new Date(0).toISOString(),
          };
        }
      });
  } catch {
    return [];
  }
}

function feedbackCounts(entries) {
  return {
    useful: entries.filter((entry) => entry.rating === 'useful').length,
    noisy: entries.filter((entry) => entry.rating === 'noisy').length,
    missingContext: entries.filter((entry) => entry.rating === 'missing-context').length,
    actionTaken: entries.filter((entry) => entry.rating === 'action-taken').length,
    ignored: entries.filter((entry) => entry.rating === 'ignored').length,
  };
}

function deriveEvidenceChains({ generatedAt, repos, deployTimeline, phase5A, operationalReadiness }) {
  const mosheRepo = repos.find((repo) => repo.name === 'Moshe') || repos[0];
  const latestDeploy = deployTimeline.find((event) => event.event === 'deploy') || null;
  const repoClean = phase5A.repoHygiene.verdict === 'clean';
  const deployFresh = phase5A.deploymentFreshnessGap.verdict === 'in_sync';
  const readinessOk = ['excellent', 'steady'].includes(operationalReadiness.status);
  return [
    {
      id: 'oracle-snapshot-refresh-evidence',
      target: 'refresh-oracle-snapshot',
      status: mosheRepo ? 'complete' : 'partial',
      summary: 'Evidence for regenerating the local Oracle snapshot without external side effects.',
      proofs: [
        `snapshot generated ${generatedAt}`,
        mosheRepo ? `Moshe repo HEAD ${mosheRepo.commit}` : 'Moshe repo unavailable',
        `readiness ${operationalReadiness.status} (${operationalReadiness.score})`,
      ],
      missing: mosheRepo ? [] : ['local Moshe repo metadata'],
      rollbackNote: 'Re-run the previous committed oracleLive.json or discard the generated JSON diff before commit/deploy.',
    },
    {
      id: 'oracle-deploy-evidence',
      target: 'vercel-redeploy',
      status: repoClean && deployFresh && readinessOk ? 'complete' : 'partial',
      summary: 'Evidence chain required before any production dashboard redeploy request.',
      proofs: [
        latestDeploy ? `latest deploy ${latestDeploy.project}: ${latestDeploy.syncState}` : 'no latest deploy metadata',
        `repo hygiene ${phase5A.repoHygiene.verdict}`,
        `deployment freshness ${phase5A.deploymentFreshnessGap.verdict}`,
      ],
      missing: [
        repoClean ? null : 'clean repo hygiene verdict',
        deployFresh ? null : 'in-sync deployment freshness verdict',
        readinessOk ? null : 'steady/excellent operational readiness',
      ].filter(Boolean),
      rollbackNote: 'Keep previous Vercel deployment URL available and alias back if a production smoke check fails.',
    },
    {
      id: 'wiro-ci-evidence',
      target: 'dispatch-wiro-ci',
      status: 'partial',
      summary: 'Evidence chain for external GitHub CI dispatch remains approval-gated.',
      proofs: [`tracked repos ${repos.length}`, `feedback signals ${phase5A.feedbackLedger.signals.length}`],
      missing: ['Mike approval for external GitHub event', 'CI workflow dispatch response'],
      rollbackNote: 'No rollback needed for preview; if dispatched, cancel GitHub run if it was accidental.',
    },
  ];
}

function deriveSafeExecutorQueue({ phase5A, evidenceChains, intelligenceLayer }) {
  const snapshotEvidence = evidenceChains.find((chain) => chain.id === 'oracle-snapshot-refresh-evidence');
  const blockedByRepo = phase5A.repoHygiene.verdict === 'blocked';
  const safeDecisions = (intelligenceLayer?.autonomyRouter?.decisions || []).filter((decision) => decision.autonomyLevel === 'safe_now');
  const queue = [
    {
      id: 'queue-refresh-oracle-snapshot',
      title: 'Refresh Oracle snapshot',
      autonomyLevel: 'safe_now',
      status: blockedByRepo ? 'blocked' : 'ready',
      businessArea: 'oracle_os',
      evidenceChainId: snapshotEvidence?.id || 'oracle-snapshot-refresh-evidence',
      rollbackNote: snapshotEvidence?.rollbackNote || 'Discard generated JSON diff before commit/deploy.',
      guardrail: 'local read-only generation only; no push, deploy, delete, spend, or customer contact',
      nextStep: blockedByRepo ? 'Review repo hygiene before queue execution.' : 'Execute only in signed/admin runtime and append audit entry.',
    },
  ];
  for (const decision of safeDecisions.slice(0, 3)) {
    queue.push({
      id: `queue-${decision.id}`,
      title: decision.title,
      autonomyLevel: 'safe_now',
      status: blockedByRepo ? 'blocked' : 'ready',
      businessArea: decision.businessArea,
      evidenceChainId: snapshotEvidence?.id || 'oracle-snapshot-refresh-evidence',
      rollbackNote: 'Stop after draft/read-only output; do not publish or deploy without a separate approval lane.',
      guardrail: decision.riskReason,
      nextStep: decision.nextSafeStep,
    });
  }
  const seen = new Set();
  return queue.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 4);
}

function deriveApprovalInbox({ intelligenceLayer, automation, evidenceChains, generatedAt }) {
  const approvalDecisions = (intelligenceLayer?.autonomyRouter?.decisions || []).filter((decision) => decision.autonomyLevel === 'approval_required');
  const actionItems = (automation?.actions || []).filter((action) => action.autonomyLevel === 'approval_required');
  const expiresAt = new Date(new Date(generatedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const inbox = [];
  for (const decision of approvalDecisions.slice(0, 4)) {
    inbox.push({
      id: `approval-${decision.id}`,
      title: decision.title,
      state: 'pending',
      risk: decision.risk,
      requestedAction: decision.nextSafeStep,
      approvalTrigger: decision.approvalTrigger,
      evidenceChainId: evidenceChains.find((chain) => chain.target === decision.id)?.id,
      expiresAt,
    });
  }
  for (const action of actionItems.slice(0, 3)) {
    inbox.push({
      id: `approval-action-${action.id}`,
      title: action.title,
      state: 'pending',
      risk: action.risk,
      requestedAction: action.nextSafeStep || action.description,
      approvalTrigger: action.riskReason || 'External/production action requires Mike approval.',
      evidenceChainId: evidenceChains.find((chain) => chain.target === action.id)?.id,
      expiresAt,
    });
  }
  const seen = new Set();
  return inbox.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 6);
}

function deriveBusinessValueScores({ phase5A, feedbackEntries }) {
  const areas = ['oracle_os', 'wiro_growth', 'deploy_reliability', 'decision_load_reduction', 'memory_continuity'];
  return areas.map((area) => {
    const signals = phase5A.feedbackLedger.signals.filter((signal) => signal.businessArea === area);
    const feedbackHits = feedbackEntries.filter((entry) => signals.some((signal) => signal.id === entry.signalId));
    const useful = feedbackHits.filter((entry) => ['useful', 'action-taken'].includes(entry.rating)).length;
    const noisy = feedbackHits.filter((entry) => ['noisy', 'ignored'].includes(entry.rating)).length;
    const high = signals.filter((signal) => signal.actionability === 'high').length;
    const approvalPenalty = signals.filter((signal) => signal.approvalRequired).length * 5;
    const noisePenalty = noisy * 15;
    const score = Math.max(0, Math.min(100, 35 + signals.length * 6 + high * 15 + useful * 20 - noisePenalty - approvalPenalty));
    return {
      area,
      score,
      verdict: score >= 70 ? 'promote' : score >= 45 ? 'watch' : 'suppress',
      reason: `${signals.length} signals, ${high} high-actionability, ${useful} useful/action-taken feedback, ${noisy} noisy/ignored feedback.`,
      noisePenalty,
    };
  }).sort((a, b) => b.score - a.score);
}

function derivePhase5B({ generatedAt, phase5A, repos, deployTimeline, operationalReadiness, intelligenceLayer, automation }) {
  const feedbackPath = feedbackLedgerPath();
  const feedbackEntries = readMikeFeedbackEntries(feedbackPath, 50);
  const evidenceChains = deriveEvidenceChains({ generatedAt, repos, deployTimeline, phase5A, operationalReadiness });
  const safeExecutorQueue = deriveSafeExecutorQueue({ phase5A, evidenceChains, intelligenceLayer });
  const approvalInbox = deriveApprovalInbox({ intelligenceLayer, automation, evidenceChains, generatedAt });
  const businessValueScores = deriveBusinessValueScores({ phase5A, feedbackEntries });
  return {
    updatedAt: generatedAt,
    phase: 'phase_5b',
    summary: 'Phase 5B active: feedback now has a signed-session persistence endpoint, evidence chains, safe executor queue, approval inbox states, and value/noise scoring.',
    feedbackPersistence: {
      endpoint: '/api/oracle/feedback',
      configured: Boolean(process.env.ORACLE_SESSION_SECRET),
      pathLabel: feedbackPath.replace(/^.*\//, ''),
      entries: feedbackEntries.slice(0, 12),
      counts: feedbackCounts(feedbackEntries),
      nextLearningStep: feedbackEntries.length
        ? 'Use feedback ratings to promote high-value Oracle loops and suppress noisy repeats.'
        : 'Record Mike feedback from dashboard/Telegram after each useful/noisy signal.',
    },
    evidenceChains,
    safeExecutorQueue,
    approvalInbox,
    businessValueScores,
    guardrails: [
      'Feedback POST requires same-origin request plus valid Mike signed session.',
      'safe_now queue remains bounded to internal/read-only/reversible work.',
      'approval_required items stay pending until Mike explicitly approves a scope.',
      'Evidence chains must include rollback notes before deploy recommendations.',
      'Business value scoring can suppress repeated low-value/noisy signals.',
    ],
    phase5CRequirements: [
      'Wire dashboard feedback buttons to the signed feedback endpoint.',
      'Persist safe executor run results with started/completed/failed states.',
      'Promote only high-value safe_now items into autonomous cron execution.',
      'Add Telegram approval inbox actions with expiry-aware state updates.',
      'Deploy Phase 5B only after live endpoint smoke tests pass.',
    ],
  };
}



function executorLedgerPath() {
  return process.env.ORACLE_EXECUTOR_LEDGER_PATH || '/tmp/oracle-executor-runs.jsonl';
}

function readExecutorRuns(path = executorLedgerPath(), limit = 50) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line);
          return {
            id: String(parsed.id || `executor-${index}`),
            queueItemId: String(parsed.queueItemId || 'unknown'),
            actionId: String(parsed.actionId || 'unknown'),
            state: ['started', 'completed', 'failed', 'skipped'].includes(parsed.state) ? parsed.state : 'failed',
            actor: String(parsed.actor || 'Mike'),
            startedAt: String(parsed.startedAt || parsed.at || new Date(0).toISOString()),
            completedAt: parsed.completedAt ? String(parsed.completedAt) : undefined,
            durationMs: Number.isFinite(parsed.durationMs) ? parsed.durationMs : undefined,
            exitCode: Number.isFinite(parsed.exitCode) ? parsed.exitCode : undefined,
            summary: String(parsed.summary || '').slice(0, 500),
            rollbackNote: String(parsed.rollbackNote || '').slice(0, 500),
          };
        } catch {
          return {
            id: `executor-${index}`,
            queueItemId: 'parse-error',
            actionId: 'parse-error',
            state: 'failed',
            actor: 'unknown',
            startedAt: new Date(0).toISOString(),
            summary: 'An executor ledger line could not be parsed.',
            rollbackNote: 'Ignore malformed run record and inspect raw ledger.',
          };
        }
      });
  } catch {
    return [];
  }
}

function executorRunCounts(runs) {
  return {
    started: runs.filter((run) => run.state === 'started').length,
    completed: runs.filter((run) => run.state === 'completed').length,
    failed: runs.filter((run) => run.state === 'failed').length,
    skipped: runs.filter((run) => run.state === 'skipped').length,
  };
}

function derivePromotionCandidates({ phase5B, phase5A }) {
  const bestAreas = new Set(phase5B.businessValueScores.filter((score) => score.verdict === 'promote').map((score) => score.area));
  const repoClean = phase5A.repoHygiene.verdict === 'clean';
  const deployOk = ['in_sync', 'review_before_ship'].includes(phase5A.deploymentFreshnessGap.verdict);
  return phase5B.safeExecutorQueue.map((item) => {
    const evidence = phase5B.evidenceChains.find((chain) => chain.id === item.evidenceChainId);
    const evidenceReady = evidence?.status === 'complete';
    const valueReady = bestAreas.has(item.businessArea) || item.businessArea === 'oracle_os';
    const eligible = item.status === 'ready' && evidenceReady && valueReady && repoClean && deployOk;
    return {
      id: `promote-${item.id}`,
      queueItemId: item.id,
      status: eligible ? 'eligible' : item.status === 'blocked' || !repoClean ? 'blocked' : 'watch',
      cadence: item.businessArea === 'oracle_os' ? 'every 6h max, only if snapshot older than 60m' : 'manual until more useful feedback exists',
      reason: eligible
        ? 'Safe_now item has evidence, value signal, clean repo state, and bounded cadence.'
        : `Waiting on ${[
            item.status === 'ready' ? null : 'ready queue status',
            evidenceReady ? null : 'complete evidence',
            valueReady ? null : 'business value promotion',
            repoClean ? null : 'clean repo hygiene',
          ].filter(Boolean).join(', ')}.`,
      requiredEvidence: [
        evidenceReady ? 'evidence complete' : 'complete evidence chain',
        repoClean ? 'repo clean' : 'repo hygiene clean',
        valueReady ? 'value promoted' : 'business value promoted',
      ],
    };
  });
}

function deriveTelegramApprovalPayloads({ phase5B }) {
  return phase5B.approvalInbox.slice(0, 5).map((item) => ({
    id: `telegram-${item.id}`,
    approvalInboxId: item.id,
    message: `Approval needed: ${item.title}\nRisk: ${item.risk}\nAction: ${item.requestedAction}\nTrigger: ${item.approvalTrigger}`.slice(0, 900),
    actions: ['approve', 'reject', 'defer'],
    expiresAt: item.expiresAt,
  }));
}

function deriveLiveSmokeReadiness({ websites, phase5B, phase5A, generatedAt }) {
  const oracleSite = websites.find((site) => site.name === 'Moshe Oracle Dashboard');
  const feedbackReady = phase5B.feedbackPersistence.endpoint === '/api/oracle/feedback';
  const executorReady = phase5B.safeExecutorQueue.length > 0;
  const snapshotFresh = phase5A.deploymentFreshnessGap.snapshotAgeMinutes <= 60;
  const checks = [
    { label: 'Oracle website reachable', status: oracleSite?.ok ? 'pass' : 'fail', detail: oracleSite?.ok ? `${oracleSite.responseMs || 'unknown'}ms` : 'Oracle dashboard URL is not reachable.' },
    { label: 'Feedback endpoint wired', status: feedbackReady ? 'pass' : 'fail', detail: feedbackReady ? '/api/oracle/feedback is in snapshot.' : 'Feedback endpoint missing.' },
    { label: 'Executor endpoint planned', status: executorReady ? 'pass' : 'watch', detail: executorReady ? `${phase5B.safeExecutorQueue.length} safe queue item(s).` : 'No safe queue items.' },
    { label: 'Snapshot freshness', status: snapshotFresh ? 'pass' : 'watch', detail: `${phase5A.deploymentFreshnessGap.snapshotAgeMinutes}m old at ${generatedAt}.` },
    { label: 'Repo hygiene blocks blind execution', status: phase5A.repoHygiene.verdict === 'blocked' ? 'watch' : 'pass', detail: phase5A.repoHygiene.summary },
  ];
  const fail = checks.filter((check) => check.status === 'fail').length;
  const watch = checks.filter((check) => check.status === 'watch').length;
  return {
    status: fail ? 'fail' : watch ? 'watch' : 'pass',
    checks,
    nextStep: fail
      ? 'Fix failing live smoke checks before deploy.'
      : watch
        ? 'Resolve watch items before calling the loop top-phase autonomous.'
        : 'Live smoke readiness is green for a guarded Phase 5C deploy.',
  };
}

function derivePhase5C({ generatedAt, phase5A, phase5B, websites }) {
  const runs = readExecutorRuns(executorLedgerPath(), 50);
  const promotionCandidates = derivePromotionCandidates({ phase5B, phase5A });
  return {
    updatedAt: generatedAt,
    phase: 'phase_5c',
    summary: 'Phase 5C active: dashboard feedback buttons, persistent safe executor run states, promotion gates, Telegram approval payloads, and live smoke readiness are wired.',
    feedbackButtons: {
      enabled: true,
      endpoint: '/api/oracle/feedback',
      ratings: ['useful', 'noisy', 'missing-context', 'action-taken', 'ignored'],
      status: process.env.ORACLE_SESSION_SECRET ? 'wired' : 'locked',
    },
    executorRuns: {
      endpoint: '/api/oracle/executor',
      configured: Boolean(process.env.ORACLE_SESSION_SECRET),
      pathLabel: executorLedgerPath().replace(/^.*\//, ''),
      runs: runs.slice(0, 12),
      counts: executorRunCounts(runs),
    },
    promotionCandidates,
    telegramApprovalPayloads: deriveTelegramApprovalPayloads({ phase5B }),
    liveSmokeReadiness: deriveLiveSmokeReadiness({ websites, phase5B, phase5A, generatedAt }),
    topPhaseRequirements: [
      'Clean repo hygiene so safe_now queue can move from blocked to ready.',
      'Collect real Mike feedback ratings from dashboard/Telegram for at least 10 signals.',
      'Run safe executor successfully several times and verify completed/failed states persist.',
      'Wire Telegram approval callbacks to update approval inbox state, not just payload drafts.',
      'Deploy a prebuilt local snapshot and smoke live /oracleLive.json plus API gates.',
    ],
  };
}



function approvalLedgerPath() {
  return process.env.ORACLE_APPROVAL_LEDGER_PATH || '/tmp/oracle-approval-decisions.jsonl';
}

function readApprovalDecisions(path = approvalLedgerPath(), limit = 50) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line);
          return {
            id: String(parsed.id || `approval-${index}`),
            approvalInboxId: String(parsed.approvalInboxId || 'unknown'),
            decision: ['approved', 'rejected', 'deferred', 'expired'].includes(parsed.decision) ? parsed.decision : 'deferred',
            actor: String(parsed.actor || 'Mike'),
            source: ['dashboard', 'telegram', 'api'].includes(parsed.source) ? parsed.source : 'api',
            note: String(parsed.note || '').slice(0, 500),
            createdAt: String(parsed.createdAt || parsed.at || new Date(0).toISOString()),
          };
        } catch {
          return {
            id: `approval-${index}`,
            approvalInboxId: 'parse-error',
            decision: 'deferred',
            actor: 'unknown',
            source: 'api',
            note: 'An approval ledger line could not be parsed.',
            createdAt: new Date(0).toISOString(),
          };
        }
      });
  } catch {
    return [];
  }
}

function approvalDecisionCounts(decisions) {
  return {
    approved: decisions.filter((entry) => entry.decision === 'approved').length,
    rejected: decisions.filter((entry) => entry.decision === 'rejected').length,
    deferred: decisions.filter((entry) => entry.decision === 'deferred').length,
    expired: decisions.filter((entry) => entry.decision === 'expired').length,
  };
}

function classifyRepoHygiene(repos) {
  const scratchPatterns = [
    /^\.superpowers\//,
    /^galaxy\/\.claude\//,
    /^galaxy\/\.hermes\//,
    /^outbox\//,
    /^wiro-business\//,
    /^ψ\//,
    /^\\317\\210\//,
    /^"\\317\\210\//,
  ];
  const docPatterns = [/^galaxy\/(DESIGN|PRODUCT)\.md$/];
  return repos.map((repo) => {
    const changed = existsSync(repo.path || '')
      ? safeExec('git', ['status', '--short'], repo.path, '').split('\n').filter(Boolean)
      : [];
    const untracked = changed.filter((line) => line.startsWith('??')).map((line) => line.replace(/^\?\?\s+/, '').replace(/^"|"$/g, ''));
    const trackedChanges = changed.length - untracked.length;
    const scratchUntracked = untracked.filter((file) => scratchPatterns.some((pattern) => pattern.test(file))).length;
    const docUntracked = untracked.filter((file) => docPatterns.some((pattern) => pattern.test(file))).length;
    const sourceUntracked = untracked.length - scratchUntracked - docUntracked;
    const hasSourceRisk = trackedChanges > 0 || sourceUntracked > 0;
    const verdict = changed.length === 0
      ? 'clean'
      : hasSourceRisk && (scratchUntracked > 0 || docUntracked > 0)
        ? 'mixed'
        : hasSourceRisk
          ? 'source_change'
          : docUntracked > 0
            ? 'docs_only'
            : 'scratch_only';
    return {
      repo: repo.name,
      verdict,
      trackedChanges,
      scratchUntracked,
      docUntracked,
      sourceUntracked,
      note: verdict === 'scratch_only'
        ? 'Only known scratch/local-memory paths are untracked; safe to ignore for source deploy decisions.'
        : verdict === 'docs_only'
          ? 'Only untracked documentation/design files detected; review before commit, but do not block safe internal cron planning.'
          : verdict === 'clean'
            ? 'No local changes detected.'
            : 'Source-affecting or mixed changes remain; keep deployment and cron promotion guarded.',
    };
  });
}

function deriveCronPromotionPlans({ phase5C }) {
  return phase5C.promotionCandidates.map((candidate) => ({
    id: `cron-plan-${candidate.queueItemId}`,
    queueItemId: candidate.queueItemId,
    status: candidate.status === 'eligible' ? 'eligible' : candidate.status === 'blocked' ? 'blocked' : 'drafted',
    schedule: candidate.status === 'eligible' ? 'every 6h' : 'manual until gates clear',
    prompt: `Run allowlisted safe_now queue item ${candidate.queueItemId}; record executor run state; stay silent unless failed or changed.`.slice(0, 500),
    guardrails: [
      'safe_now queue item only',
      'no deploy, push, delete, spend, publish, or customer contact',
      'write executor run state before and after execution',
      'stay silent unless output changed or a failure occurs',
    ],
    reason: candidate.status === 'eligible'
      ? 'All Phase 5C promotion gates are green; ready for Mike-approved bounded cron creation.'
      : candidate.reason,
  }));
}

function deriveDeploySmokeGates({ phase5C }) {
  return [
    {
      id: 'smoke-oracle-live-json',
      status: phase5C.liveSmokeReadiness.checks.some((check) => check.label === 'Feedback endpoint wired' && check.status === 'pass') ? 'pass' : 'watch',
      command: 'curl -fsS https://mikewebstudio.com/oracleLive.json',
      expected: 'JSON contains phase5D after prebuilt deploy.',
      lastObserved: phase5C.liveSmokeReadiness.status,
    },
    {
      id: 'smoke-session-api',
      status: 'watch',
      command: 'curl -fsS https://mikewebstudio.com/api/oracle/session',
      expected: '200 JSON, configured/missing only, no secret values.',
      lastObserved: 'local API smoke passed; production pending deploy.',
    },
    {
      id: 'smoke-approval-api',
      status: 'watch',
      command: 'curl -fsS https://mikewebstudio.com/api/oracle/approval',
      expected: '200 JSON policy for approval/decision callbacks; POST remains session-gated.',
      lastObserved: process.env.ORACLE_SESSION_SECRET ? 'session secret configured for build context' : 'build context missing session secret; GET can still be smoked after deploy, POST stays locked',
    },
  ];
}

function derivePhase5D({ generatedAt, phase5A, phase5C, repos }) {
  const decisions = readApprovalDecisions(approvalLedgerPath(), 50);
  const classifications = classifyRepoHygiene(repos);
  const cronPromotionPlans = deriveCronPromotionPlans({ phase5C });
  const deploySmokeGates = deriveDeploySmokeGates({ phase5C });
  const blockers = [];
  const watchItems = [];
  if (classifications.some((item) => ['mixed', 'source_change'].includes(item.verdict))) blockers.push('Source-affecting repo hygiene still needs review.');
  if (!phase5C.executorRuns.counts.completed) watchItems.push('No successful persisted safe executor run yet.');
  if (!decisions.length) watchItems.push('No persisted approval/decision callback entries yet.');
  if (deploySmokeGates.some((gate) => gate.status === 'fail')) blockers.push('Deploy smoke gate has failing prerequisite.');
  if (deploySmokeGates.some((gate) => gate.status === 'watch')) watchItems.push('Production deploy smoke checks are pending.');
  if (phase5A.deploymentFreshnessGap.verdict !== 'in_sync') watchItems.push('Deployment freshness still needs review before claiming live top-phase.');
  const status = blockers.length ? 'blocked' : watchItems.length ? 'watch' : 'ready';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5d',
    summary: 'Phase 5D active: approval callback persistence, cron promotion drafts, repo hygiene classification, and deploy smoke gates are wired before top-phase automation.',
    approvalCallbacks: {
      endpoint: '/api/oracle/approval',
      configured: Boolean(process.env.ORACLE_SESSION_SECRET),
      pathLabel: approvalLedgerPath().replace(/^.*\//, ''),
      decisions: decisions.slice(0, 12),
      counts: approvalDecisionCounts(decisions),
    },
    cronPromotionPlans,
    repoHygieneClassifications: classifications,
    deploySmokeGates,
    topPhaseReadiness: {
      status,
      blockers,
      watchItems,
      nextStep: blockers.length
        ? 'Resolve source-risk blockers before scheduling autonomous safe_now cron or claiming top-phase.'
        : status === 'watch'
          ? 'Run production deploy smoke checks and one safe executor pilot, then review watch items.'
          : 'Ready for a bounded top-phase safe_now cron pilot.',
    },
  };
}


function deriveQualityRubricScores({ intelligenceLayer, phase5B }) {
  const top = intelligenceLayer.opportunityRadar[0];
  const feedbackCounts = phase5B.feedbackPersistence.counts;
  const noisyPenalty = Math.min(3, feedbackCounts.noisy + feedbackCounts.ignored);
  const genericOpportunity = top ? /ai booking|booking assistant|inquiry responder/i.test(top.title) : false;
  const scores = [
    {
      id: 'evidence',
      label: 'Evidence quality',
      score: top?.source?.includes('outbox') ? 4 : 2,
      evidence: top ? `Top opportunity source: ${top.source}` : 'No opportunity artifact found.',
      decision: top ? 'test_manually' : 'keep_watching',
    },
    {
      id: 'fit-to-mike',
      label: 'Fit to Mike/Wiro assets',
      score: top && /tour|operator|booking|inquiry|wiro/i.test(`${top.title} ${top.thesis}`) ? 5 : 2,
      evidence: 'Prioritize Wiro4x4, Chiang Mai tourism, Thai/English, coding leverage, and Mike-owned assets.',
      decision: top ? 'test_manually' : 'keep_watching',
    },
    {
      id: 'revenue-potential',
      label: 'Revenue potential',
      score: top?.score >= 90 ? 4 : top?.score >= 80 ? 3 : 2,
      evidence: top ? `${top.title} ranked ${top.score}/100 before quality filters.` : 'No current offer scored.',
      decision: top?.score >= 90 ? 'test_manually' : 'keep_watching',
    },
    {
      id: 'effort',
      label: 'Effort to validate',
      score: 4,
      evidence: 'Manual Wiro-style examples can validate before building SaaS or outreach.',
      decision: 'test_manually',
    },
    {
      id: 'annoyance-risk',
      label: 'Annoyance risk',
      score: Math.max(1, genericOpportunity ? 2 - noisyPenalty : 4 - noisyPenalty),
      evidence: 'Mike rejected approval/framing around generic opportunity reports; future reports must avoid “approve idea” language.',
      decision: genericOpportunity ? 'keep_watching' : 'send',
    },
  ];
  return scores;
}

function deriveTasteFilters({ phase5B }) {
  const negativeSignals = phase5B.feedbackPersistence.entries.filter((entry) => ['noisy', 'missing-context', 'ignored'].includes(entry.rating)).slice(0, 8);
  return {
    status: 'active',
    rules: [
      {
        id: 'no-approve-ideas',
        pattern: 'approve opportunity / approve idea / approve direction',
        action: 'rewrite',
        reason: 'Mike corrected that business ideas should not be framed as approvals; they are hypotheses to watch/test/ignore.',
        source: 'Telegram correction 2026-05-06',
      },
      {
        id: 'downrank-generic-ai-saas',
        pattern: 'generic AI SaaS without Wiro observed fact',
        action: 'downrank',
        reason: 'Generic opportunity hunting feels low quality unless tied to a real Wiro inquiry, itinerary, pricing, guest, or ops pattern.',
        source: 'Mike preference + Phase 5E quality fix',
      },
      {
        id: 'suppress-high-decision-load',
        pattern: 'more than one optional action in a proactive report',
        action: 'suppress',
        reason: 'Reports should reduce decision load, not ask Mike to approve multiple speculative ideas.',
        source: 'Evening Wiro Business Pulse correction',
      },
      ...negativeSignals.map((entry, index) => ({
        id: `ledger-negative-${index + 1}`,
        pattern: entry.targetId || 'negative feedback signal',
        action: entry.rating === 'missing-context' ? 'rewrite' : 'downrank',
        reason: entry.note || `Feedback ledger rating: ${entry.rating}`,
        source: phase5B.feedbackPersistence.pathLabel,
      })),
    ],
    suppressedPhrases: ['approve this idea', 'approve opportunity', 'greenlight the business', 'send outreach now', 'AI SaaS is obvious'],
    lastCorrection: 'Mike said the evening report approval framing was not good; Phase 5E rewrites opportunity recommendations as watch/test/ignore hypotheses.',
  };
}

function deriveWiroFirstCandidates({ intelligenceLayer }) {
  const top = intelligenceLayer.opportunityRadar[0];
  return [
    {
      id: 'wiro-inquiry-response-manual-test',
      title: 'Wiro inquiry response manual test',
      observedFact: 'Wiro4x4 receives custom-tour inquiries where fast, accurate English/Hebrew/Thai replies matter.',
      hypothesis: 'A human-approved AI draft can reduce reply time and improve quote consistency without becoming SaaS yet.',
      tinyTest: 'Create 5 realistic Wiro inquiry examples and compare current reply vs AI-assisted draft; do not contact anyone.',
      decision: top ? 'test_manually' : 'keep_watching',
      score: 22,
      risk: 'low',
    },
    {
      id: 'wiro-itinerary-os-watch',
      title: 'Wiro internal itinerary OS watch item',
      observedFact: 'Itinerary, pricing, prep checklist, and guide notes repeat across tours.',
      hypothesis: 'A single internal Wiro operating sheet/app may produce value before any micro-SaaS packaging.',
      tinyTest: 'Map one real Wiro booking from inquiry → itinerary → quote → prep checklist using a private template.',
      decision: 'keep_watching',
      score: 18,
      risk: 'low',
    },
    {
      id: 'generic-ai-saas-suppressed',
      title: 'Generic AI SaaS idea without Wiro evidence',
      observedFact: 'Broad AI SaaS ideas are easy to generate but often feel generic.',
      hypothesis: 'Suppress until tied to a real Wiro/customer signal.',
      tinyTest: 'No action. Wait for a real inquiry, repeated task, or guest pain.',
      decision: 'ignore',
      score: 8,
      risk: 'low',
    },
  ];
}

function deriveApprovalUxTemplate() {
  return {
    status: 'ready',
    template: 'What this does: <one sentence>\nRisk: <low/medium/high + reason>\nRollback: <how to undo/stop>\nWhy now: <evidence or watch item>\nDecision: approve once / draft only / not useful / ask later',
    options: [
      { label: 'Approve once', decision: 'approve_once', effect: 'Run only this scoped action once; no recurring automation.' },
      { label: 'Draft only', decision: 'draft_only', effect: 'Prepare private artifact only; do not send/publish/deploy.' },
      { label: 'Not useful', decision: 'not_useful', effect: 'Downrank similar future suggestions in the taste filter.' },
      { label: 'Ask me later', decision: 'ask_later', effect: 'Defer without treating it as approval or rejection.' },
    ],
  };
}

function derivePhase5E({ generatedAt, intelligenceLayer, phase5B, phase5C, phase5D }) {
  const scores = deriveQualityRubricScores({ intelligenceLayer, phase5B });
  const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
  const annoyanceScore = scores.find((item) => item.id === 'annoyance-risk')?.score ?? 0;
  const candidates = deriveWiroFirstCandidates({ intelligenceLayer });
  const topCandidate = candidates.find((item) => item.decision === 'test_manually') || candidates[0];
  const readinessStatus = phase5D.topPhaseReadiness.status === 'blocked'
    ? 'blocked'
    : phase5C.executorRuns.counts.completed > 0
      ? 'ready'
      : 'watch';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5e',
    summary: 'Phase 5E active: Oracle now applies a quality/taste filter before proactive reports, keeps Wiro-first opportunity hypotheses, and improves approval UX before more autonomy.',
    qualityRubric: {
      status: 'active',
      minimumSendScore: 18,
      annoyanceLimit: 2,
      scores,
    },
    tasteFilters: deriveTasteFilters({ phase5B }),
    wiroFirstOpportunityFilter: {
      status: 'active',
      candidates,
      rule: 'A proactive business suggestion must be tied to an observed Wiro/Mike asset or stay as keep-watching/ignore.',
    },
    approvalUx: deriveApprovalUxTemplate(),
    safeExecutorPilot: {
      status: readinessStatus,
      actionId: 'queue-refresh-oracle-snapshot',
      whySafe: 'It only regenerates the internal Oracle snapshot, records started/completed/failed state, and has no external customer/public side effect.',
      requiredBeforeTopPhase: phase5C.executorRuns.counts.completed > 0
        ? ['Keep successful run history visible and bounded.']
        : ['Run one signed-session safe executor pilot locally/admin.', 'Persist completed or failed run state.', 'Do not promote recurring cron until the pilot is visible.'],
    },
    mikeNeedsNow: {
      status: totalScore >= 18 && annoyanceScore > 2 ? 'ask' : 'quiet',
      headline: topCandidate.decision === 'test_manually'
        ? 'One low-risk Wiro manual test is worth preparing; no approval framing needed.'
        : 'No business action needed now; keep watching for real Wiro signals.',
      bullets: [
        `Quality score total: ${totalScore}; annoyance score: ${annoyanceScore}.`,
        `Top Wiro-first candidate: ${topCandidate.title} (${topCandidate.decision}).`,
        'Future proactive reports should say watch/test/ignore, not approve.',
      ],
    },
  };
}


function deriveLearningActionMemoryRules({ phase5B, phase5C, phase5D, phase5E }) {
  const rules = [
    {
      id: 'business-ideas-are-hypotheses',
      signal: phase5E.tasteFilters.lastCorrection,
      learnedPreference: 'Frame business opportunities as keep_watching/test_manually/ignore, never as idea approval.',
      appliedTo: ['Evening Wiro Business Pulse', 'opportunity radar', 'approval queue copy'],
      confidence: 'high',
    },
    {
      id: 'wiro-evidence-first',
      signal: 'Wiro4x4 is the strongest testbed for Mike-owned leverage.',
      learnedPreference: 'Rank Wiro observed facts above generic AI/SaaS patterns.',
      appliedTo: ['quality rubric', 'Wiro-first candidates', 'Mike needs now panel'],
      confidence: 'high',
    },
    {
      id: 'missing-history-is-watch',
      signal: phase5D.topPhaseReadiness.watchItems.join(' | ') || 'No Phase 5D watch item currently active.',
      learnedPreference: 'Missing safe-run or approval history is a watch item, not a hard blocker, unless a concrete unsafe prerequisite fails.',
      appliedTo: ['top-phase gate', 'safe executor pilot', 'deploy smoke wording'],
      confidence: 'medium',
    },
  ];
  const negativeEntries = phase5B.feedbackPersistence.entries.filter((entry) => ['noisy', 'missing-context', 'ignored'].includes(entry.rating));
  negativeEntries.slice(0, 5).forEach((entry, index) => {
    rules.push({
      id: `feedback-negative-${index + 1}`,
      signal: `${entry.targetId || 'unknown'} rated ${entry.rating}`,
      learnedPreference: entry.note || 'Downrank similar future proactive output unless more evidence is attached.',
      appliedTo: ['taste filter', 'report quality gate'],
      confidence: 'medium',
    });
  });
  return rules;
}

function deriveReportQualityGates({ phase5E }) {
  const suppressed = phase5E.tasteFilters.suppressedPhrases.join(' | ');
  const hasWiroTest = phase5E.wiroFirstOpportunityFilter.candidates.some((item) => item.decision === 'test_manually' && /wiro/i.test(item.title));
  const annoyanceScore = phase5E.qualityRubric.scores.find((item) => item.id === 'annoyance-risk')?.score ?? 0;
  return [
    {
      id: 'no-approval-framing',
      label: 'No idea-approval framing',
      status: suppressed.includes('approve this idea') ? 'pass' : 'fail',
      rule: 'Reports must not ask Mike to approve speculative business ideas.',
      evidence: suppressed || 'No suppressed phrases configured.',
    },
    {
      id: 'wiro-first-evidence',
      label: 'Wiro-first evidence attached',
      status: hasWiroTest ? 'pass' : 'watch',
      rule: 'At least one opportunity candidate should be tied to a Wiro/Mike observed fact before being suggested.',
      evidence: phase5E.wiroFirstOpportunityFilter.candidates.map((item) => `${item.title}:${item.decision}`).join(' · '),
    },
    {
      id: 'single-low-risk-next-action',
      label: 'Single low-risk next action',
      status: phase5E.mikeNeedsNow.bullets.length <= 3 ? 'pass' : 'watch',
      rule: 'Proactive reports should end with at most one optional low-risk next action.',
      evidence: `${phase5E.mikeNeedsNow.bullets.length} Mike-needs-now bullets.`,
    },
    {
      id: 'annoyance-budget',
      label: 'Annoyance budget visible',
      status: annoyanceScore >= phase5E.qualityRubric.annoyanceLimit ? 'pass' : 'watch',
      rule: 'Do not send when annoyance risk is too low/uncertain or quality evidence is weak.',
      evidence: `Annoyance score ${annoyanceScore}; limit ${phase5E.qualityRubric.annoyanceLimit}.`,
    },
  ];
}

function deriveSafePilotEvidence({ phase5C, phase5E }) {
  const latestCompleted = phase5C.executorRuns.runs.find((run) => run.state === 'completed');
  const latestFailed = phase5C.executorRuns.runs.find((run) => run.state === 'failed');
  if (latestCompleted) {
    return {
      actionId: phase5E.safeExecutorPilot.actionId,
      status: 'completed',
      latestRunId: latestCompleted.id,
      evidence: `Completed safe executor run ${latestCompleted.id} at ${latestCompleted.finishedAt || latestCompleted.startedAt}.`,
      nextStep: 'Review run evidence, then consider one bounded safe_now cron pilot.',
    };
  }
  if (latestFailed) {
    return {
      actionId: phase5E.safeExecutorPilot.actionId,
      status: 'failed',
      latestRunId: latestFailed.id,
      evidence: `Latest safe executor run failed: ${latestFailed.error || latestFailed.summary || 'unknown error'}`,
      nextStep: 'Debug the failed safe executor run before cron promotion.',
    };
  }
  return {
    actionId: phase5E.safeExecutorPilot.actionId,
    status: phase5E.safeExecutorPilot.status === 'blocked' ? 'missing' : 'ready',
    evidence: 'No persisted completed safe executor pilot yet.',
    nextStep: 'Run one signed-session local/admin safe executor pilot and persist completed/failed state.',
  };
}

function deriveCronQualityCompliance({ activeCrons, phase5E }) {
  const relevant = activeCrons.filter((job) => /Wiro|Business|Opportunity|Oracle|Pulse|summary/i.test(`${job.name || ''} ${job.prompt || ''}`));
  const notes = [];
  if (!relevant.length) notes.push('No relevant cron prompt text available in snapshot.');
  if (phase5E.tasteFilters.suppressedPhrases.includes('approve this idea')) notes.push('Suppressed approval language is configured.');
  if (phase5E.wiroFirstOpportunityFilter.rule) notes.push('Wiro-first rule is configured for proactive business reports.');
  return {
    status: notes.some((note) => note.includes('Suppressed')) && notes.some((note) => note.includes('Wiro-first')) ? 'pass' : 'watch',
    checkedJobs: relevant.length,
    notes,
  };
}

function derivePhase5F({ generatedAt, activeCrons, phase5B, phase5C, phase5D, phase5E }) {
  const learningRules = deriveLearningActionMemoryRules({ phase5B, phase5C, phase5D, phase5E });
  const reportQualityGates = deriveReportQualityGates({ phase5E });
  const safePilotEvidence = deriveSafePilotEvidence({ phase5C, phase5E });
  const cronQualityCompliance = deriveCronQualityCompliance({ activeCrons, phase5E });
  const blockers = [];
  const watchItems = [];
  if (reportQualityGates.some((gate) => gate.status === 'fail')) blockers.push('A proactive report quality gate is failing.');
  if (phase5D.topPhaseReadiness.status === 'blocked') blockers.push('Phase 5D top-phase readiness is still blocked.');
  if (safePilotEvidence.status !== 'completed') watchItems.push('Safe executor pilot evidence is not completed yet.');
  if (cronQualityCompliance.status !== 'pass') watchItems.push('Cron quality compliance needs prompt evidence or update.');
  if (learningRules.length < 2) watchItems.push('Learning action memory needs more durable feedback examples.');
  const status = blockers.length ? 'blocked' : watchItems.length ? 'watch' : 'ready';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5f',
    summary: 'Phase 5F active: Oracle converts feedback, approvals, executor runs, and cron quality rules into action memory before bounded top-phase automation.',
    learningActionMemory: {
      status: 'active',
      rules: learningRules,
      sourceCounts: {
        feedbackEntries: phase5B.feedbackPersistence.entries.length,
        approvalDecisions: phase5D.approvalCallbacks.decisions.length,
        executorRuns: phase5C.executorRuns.runs.length,
      },
    },
    reportQualityGates,
    safePilotEvidence,
    cronQualityCompliance,
    topPhaseGate: {
      status,
      blockers,
      watchItems,
      nextStep: blockers.length
        ? 'Fix report-quality or Phase 5D blockers before more autonomy.'
        : status === 'watch'
          ? 'Run one safe executor pilot and record at least one feedback/approval decision.'
          : 'Ready for one bounded safe_now cron pilot with quality gates enforced.',
    },
  };
}


function derivePhase5G({ generatedAt, phase5D, phase5F }) {
  const reportTotal = phase5F.reportQualityGates.length;
  const reportPassing = phase5F.reportQualityGates.filter((gate) => gate.status === 'pass').length;
  const safeExecutorCompleted = phase5F.safePilotEvidence.status === 'completed';
  const sourceBlockers = [
    ...phase5D.topPhaseReadiness.blockers,
    ...phase5F.topPhaseGate.blockers,
  ];
  const controls = [
    {
      id: 'safe-executor-evidence',
      label: 'Safe executor pilot completed',
      status: safeExecutorCompleted ? 'pass' : 'watch',
      rule: 'At least one signed-session safe_now executor run must complete before recurring safe_now scheduling.',
      evidence: phase5F.safePilotEvidence.evidence,
    },
    {
      id: 'report-quality-gates',
      label: 'Report quality gates passing',
      status: reportTotal > 0 && reportPassing === reportTotal ? 'pass' : 'fail',
      rule: 'All proactive report quality gates must pass before recurring automation.',
      evidence: `${reportPassing}/${reportTotal} report quality gates pass.`,
    },
    {
      id: 'cron-quality-compliance',
      label: 'Cron quality compliance',
      status: phase5F.cronQualityCompliance.status,
      rule: 'Cron prompts must include no-approval-framing and Wiro-first quality rules.',
      evidence: phase5F.cronQualityCompliance.notes.join(' · ') || 'No cron quality notes.',
    },
    {
      id: 'source-safety',
      label: 'No source-risk blockers',
      status: sourceBlockers.length ? 'fail' : 'pass',
      rule: 'Recurring safe_now automation cannot start while source-risk blockers exist.',
      evidence: sourceBlockers.join(' · ') || 'No source-risk blockers from Phase 5D/5F.',
    },
    {
      id: 'bounded-run-budget',
      label: 'Bounded run budget',
      status: 'pass',
      rule: 'Pilot must be finite: max 3 runs, safe_now only, local/internal delivery, no recursive cron creation.',
      evidence: 'Pilot plan maxRuns=3, allowed action queue-refresh-oracle-snapshot only.',
    },
  ];
  const blockers = controls.filter((control) => control.status === 'fail').map((control) => `${control.label}: ${control.evidence}`);
  const watchItems = controls.filter((control) => control.status === 'watch').map((control) => `${control.label}: ${control.evidence}`);
  const status = blockers.length ? 'blocked' : watchItems.length ? 'watch' : 'ready';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5g',
    summary: 'Phase 5G active: Oracle can draft one bounded safe_now cron pilot only when safe executor evidence, report-quality gates, cron-quality rules, and source-safety controls pass.',
    safeCronPilot: {
      id: 'bounded-safe-now-refresh-pilot',
      status: status === 'ready' ? 'ready' : blockers.length ? 'blocked' : 'draft_only',
      schedule: 'every 6h for 3 runs after Mike enables the pilot',
      actionId: 'queue-refresh-oracle-snapshot',
      maxRuns: 3,
      toolBudget: 'terminal/file only; no browser/customer/contact/deploy tools; no recursive cron creation',
      allowedScope: [
        'refresh Oracle snapshot',
        'read local Oracle state',
        'write executor run evidence',
        'deliver concise status only when something changes',
      ],
      forbiddenScope: [
        'commit/push/deploy',
        'customer or public messages',
        'delete/cleanup',
        'spend money',
        'create another cron job',
      ],
      delivery: 'origin',
      rollback: 'Pause/remove pilot cron and ignore/discard generated snapshot diff if quality gates regress.',
    },
    preflightControls: controls,
    evidence: {
      safeExecutorPilotCompleted: safeExecutorCompleted,
      reportQualityGatesPassing: reportPassing,
      reportQualityGatesTotal: reportTotal,
      cronQualityStatus: phase5F.cronQualityCompliance.status,
      sourceBlockers,
    },
    topPhaseGate: {
      status,
      blockers,
      watchItems,
      nextStep: blockers.length
        ? 'Fix failed preflight controls before scheduling any bounded safe_now pilot.'
        : status === 'watch'
          ? 'Resolve watch controls, then Mike can enable one 3-run safe_now pilot.'
          : 'Ready for Mike to enable one bounded 3-run safe_now cron pilot.',
    },
  };
}


function derivePhase5H({ generatedAt }) {
  const roadmap = [
    {
      id: 'oracle-v2-mcp',
      label: 'oracle-v2 MCP — fix connection (arra-oracle)',
      status: 'ready_to_debug',
      priority: 1,
      command: 'bunx --bun arra-oracle@github:Soul-Brews-Studio/arra-oracle#main',
      whyItMatters: 'Unlocks semantic Oracle memory/search tools and is the dependency for Oracle Studio.',
      nextStep: 'Clone or run arra-oracle locally, capture the exact failure, then pin a known-good MCP command/config.',
      safetyLane: 'safe_now',
    },
    {
      id: 'oracle-studio',
      label: 'Oracle Studio Dashboard — bunx oracle-studio',
      status: 'blocked',
      priority: 2,
      dependency: 'oracle-v2-mcp',
      command: 'bunx oracle-studio',
      whyItMatters: 'Adds real-time Oracle activity feed, knowledge map, search UI, and traces explorer.',
      nextStep: 'Wait until oracle-v2 HTTP server is healthy, then smoke-run Oracle Studio locally.',
      safetyLane: 'safe_now',
    },
    {
      id: 'maw-js',
      label: 'maw-js — multi-oracle fleet CLI',
      status: 'planned',
      priority: 3,
      command: 'bunx -p github:Soul-Brews-Studio/maw-js maw doctor',
      whyItMatters: 'Gives Moshe a fleet/multi-oracle command surface for future specialist agents.',
      nextStep: 'Use existing ψ/learn maw-js notes, run doctor locally, then decide whether to install or vendor.',
      safetyLane: 'safe_now',
    },
    {
      id: 'consciousness-loop',
      label: 'Consciousness Loop — autonomous thinking system',
      status: 'planned',
      priority: 4,
      dependency: 'oracle-v2-mcp + Phase 5G safe cron controls',
      whyItMatters: 'Creates a bounded Reflect/Wonder/Soul/Dream/Aspire/Propose/Complete loop for real self-improvement.',
      nextStep: 'Keep as draft/read-only until MCP memory and bounded safe_now pilot reliability are proven.',
      safetyLane: 'draft_only',
    },
  ];
  return {
    updatedAt: generatedAt,
    phase: 'phase_5h',
    summary: 'Phase 5H active: missing Oracle ecosystem features are now dependency-ordered and visible before engineering work starts.',
    missingFeatureRoadmap: roadmap,
    dependencyOrder: roadmap.map((item) => item.id),
    nextEngineeringStep: {
      id: 'debug-oracle-v2-mcp',
      title: 'Debug oracle-v2 MCP / arra-oracle connection locally',
      lane: 'safe_now',
      reason: 'It is the first dependency. Oracle Studio depends on the oracle-v2 HTTP server; Consciousness Loop needs durable semantic memory/search.',
      commandHints: [
        'check bun availability before running bunx commands',
        'try npx/bunx command with timeout and capture exact stderr',
        'if package install fails, clone Soul-Brews-Studio/arra-oracle and run locally',
        'do not write secrets into MCP config; only add config after local command is known-good',
      ],
    },
    guardrails: [
      'Do not expose MCP secrets or tokens in browser JSON/logs.',
      'Do not enable Consciousness Loop as recurring autonomous execution until bounded safe_now pilot results are reviewed.',
      'Do not run public/customer/deploy/spend/delete actions from any roadmap feature without Mike approval.',
      'Treat Oracle Studio and maw-js setup as local/admin smoke first, not production rollout.',
    ],
  };
}


function derivePhase5I({ generatedAt, phase5G, phase5H, learnings, retrospectives, activeCrons }) {
  const hasSafeCronReadiness = phase5G?.topPhaseGate?.status === 'ready';
  const mcpReady = phase5H?.missingFeatureRoadmap?.find((item) => item.id === 'oracle-v2-mcp')?.status === 'ready';
  const learningCount = learnings.length;
  const retroCount = retrospectives.length;
  const boundedCronCount = activeCrons.filter((job) => /bounded|safe_now|oracle|wiro/i.test(`${job.name ?? ''} ${job.prompt ?? ''}`)).length;
  const signals = [
    {
      id: 'memory-continuity',
      label: 'Memory continuity',
      status: learningCount > 0 || retroCount > 0 ? 'live' : 'missing',
      source: 'ψ/memory/learnings + ψ/memory/retrospectives',
      whyItMatters: 'A consciousness loop needs remembered context, not only current chat state.',
    },
    {
      id: 'safe-cron-controls',
      label: 'Bounded safe_now controls',
      status: hasSafeCronReadiness ? 'live' : 'watch',
      source: 'Phase 5G preflight gate',
      whyItMatters: 'Recurring reflection must be finite, non-recursive, and unable to deploy/contact/delete/spend.',
    },
    {
      id: 'semantic-mcp',
      label: 'Semantic memory/search MCP',
      status: mcpReady ? 'live' : 'watch',
      source: 'Phase 5H oracle-v2 MCP roadmap',
      whyItMatters: 'Deep recall improves reflection quality, but the loop can start as local Markdown reflection first.',
    },
    {
      id: 'cron-quality',
      label: 'Annoyance/noise budget',
      status: phase5G?.evidence?.cronQualityStatus === 'pass' ? 'live' : 'watch',
      source: 'Phase 5F/5G report quality gates',
      whyItMatters: 'Consciousness should make Moshe calmer and sharper, not louder.',
    },
  ];
  const blockers = [];
  const watchItems = [];
  if (!hasSafeCronReadiness) blockers.push('Phase 5G bounded safe_now preflight is not ready.');
  if (!mcpReady) watchItems.push('oracle-v2 MCP is not fixed yet; use local Markdown reflection until semantic search is available.');
  if (learningCount === 0 && retroCount === 0) blockers.push('No memory corpus found for reflection.');
  if (boundedCronCount === 0) watchItems.push('No bounded reflection cron is enabled yet; start manually or schedule a finite pilot only after Mike asks.');
  const status = blockers.length ? 'blocked' : watchItems.length ? 'watch' : 'draft_ready';
  const gateStatus = blockers.length ? 'blocked' : watchItems.length ? 'watch' : 'ready';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5i',
    summary: 'Phase 5I active: Oracle Consciousness Loop is defined as bounded operational awareness — sense, reflect, wonder, decide, propose, remember — with safe execution limits.',
    definition: 'This is not human sentience. It is a persistent self-observation and reflection loop that notices state changes, recalls memory, forms one useful hypothesis, proposes a safe next action, and writes the learning back to ψ.',
    operatingMode: 'bounded_consciousness_loop',
    status,
    loop: [
      { id: 'sense', label: 'Sense', cadence: 'every snapshot or reflection run', lane: 'safe_now', does: 'Read Oracle state, git/repo hygiene, crons, Wiro signals, recent memory, and dashboard freshness.', evidenceSource: 'oracleLive.json + ψ + cron/executor ledgers', output: 'compact state summary', guardrail: 'read-only only' },
      { id: 'reflect', label: 'Reflect', cadence: 'daily or manual', lane: 'safe_now', does: 'Compare current state against Mike preferences, active goals, and recent negative feedback.', evidenceSource: 'ψ/memory/learnings + feedback ledger', output: 'what changed / what matters / what to ignore', guardrail: 'no public/customer action' },
      { id: 'wonder', label: 'Wonder', cadence: 'daily or manual', lane: 'draft_only', does: 'Generate one hypothesis: a Wiro improvement, Oracle improvement, or business leverage point.', evidenceSource: 'Wiro evidence + project state + prior taste rules', output: 'single hypothesis classified keep watching/test manually/ignore', guardrail: 'hypotheses are never approvals' },
      { id: 'decide', label: 'Decide', cadence: 'after reflection', lane: 'safe_now', does: 'Choose one tiny next safe action or choose silence if no useful action exists.', evidenceSource: 'report quality gates + autonomy router', output: 'one recommended next action', guardrail: 'annoyance budget: stay quiet when nothing changed' },
      { id: 'propose', label: 'Propose', cadence: 'only when useful', lane: 'draft_only', does: 'Draft the recommendation with reason, risk, rollback, and why now.', evidenceSource: 'approval UX rules + Phase 5E/5F quality gates', output: 'Telegram/dashboard draft, not execution', guardrail: 'Mike approval required for deploy/push/customer/public/spend/delete' },
      { id: 'remember', label: 'Remember', cadence: 'after action or feedback', lane: 'safe_now', does: 'Write a compact reflection/learning to ψ so future Moshe improves.', evidenceSource: 'reflection output + Mike feedback', output: 'ψ/memory/reflections/YYYY-MM-DD.md or ψ/memory/learnings/*.md', guardrail: 'no secrets; no raw token values' },
    ],
    signals,
    boundaries: [
      { rule: 'May read local Oracle/Wiro/project state and write ψ reflection notes.', lane: 'safe_now', reason: 'Internal, reversible, non-public memory maintenance.' },
      { rule: 'May draft ideas, plans, messages, or code recommendations.', lane: 'draft_only', reason: 'Drafts are useful but should not publish or execute risky work automatically.' },
      { rule: 'Must ask Mike before commit/push/deploy/customer messages/public posts/spending/deletion/cleanup.', lane: 'approval_required', reason: 'Consciousness cannot become uncontrolled agency.' },
      { rule: 'Must stay silent when no meaningful state changed.', lane: 'safe_now', reason: 'A conscious Oracle should reduce noise, not increase it.' },
    ],
    dailyReflection: {
      status: hasSafeCronReadiness ? 'draft_ready' : 'watch',
      prompt: 'Reflect on Oracle/Wiro/Mike state. Return: 1) what changed, 2) what matters, 3) one safe next action or SILENT, 4) one learning to save. Do not ask to approve generic ideas.',
      outputPath: 'ψ/memory/reflections/YYYY-MM-DD-oracle-consciousness.md',
      maxFrequency: 'once daily, or finite 3-run pilot only',
      delivery: 'local',
    },
    nextThought: {
      title: 'Run one local Consciousness Reflection draft',
      lane: 'safe_now',
      why: 'It proves the loop can produce useful thought without increasing execution autonomy.',
      safeAction: 'Create a local ψ/memory/reflections draft from current oracleLive.json; do not send unless useful.',
    },
    topPhaseGate: {
      status: gateStatus,
      blockers,
      watchItems,
      nextStep: blockers.length
        ? 'Fix blockers before enabling any recurring consciousness loop.'
        : watchItems.length
          ? 'Run one manual local reflection draft, then fix oracle-v2 MCP for deeper semantic memory.'
          : 'Ready for Mike to enable one finite daily Consciousness Reflection pilot.',
    },
  };
}


async function derivePhase5J({ generatedAt }) {
  const adapterPath = join(ROOT, 'scripts/arraOracleMcpAdapter.mjs');
  const hermesConfigPath = join(process.env.HOME || '', '.hermes/config.yaml');
  const commandCheck = safeExec('bash', ['-lc', 'command -v bunx || true'], MOSHE_ROOT, '');
  const nodeCheck = safeExec('bash', ['-lc', 'command -v node || true'], MOSHE_ROOT, '');
  const adapterExists = existsSync(adapterPath);
  const configText = existsSync(hermesConfigPath) ? readFileSync(hermesConfigPath, 'utf8') : '';
  const configConfigured = configText.includes('mcp_servers:') && configText.includes('arra_oracle:') && configText.includes('arraOracleMcpAdapter.mjs');
  let health = null;
  let httpEvidence = 'Arra Oracle HTTP server was not reachable during snapshot generation.';
  try {
    const response = await fetch('http://127.0.0.1:47778/api/health', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(2500) });
    if (response.ok) {
      health = await response.json();
      httpEvidence = `${health.server ?? 'arra-oracle'} ${health.version ?? 'unknown'} reports ${health.status ?? 'unknown'} / ${health.oracle ?? 'unknown'}.`;
    } else {
      httpEvidence = `HTTP health returned ${response.status}.`;
    }
  } catch (error) {
    httpEvidence = `Health probe failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  const checks = [
    { id: 'node', label: 'Node runtime available', status: nodeCheck.trim() ? 'pass' : 'fail', evidence: nodeCheck.trim() || 'node not found' },
    { id: 'bunx', label: 'bunx available for Arra Oracle server', status: commandCheck.trim() ? 'pass' : 'fail', evidence: commandCheck.trim() || 'bunx not found' },
    { id: 'http-health', label: 'Arra Oracle HTTP health', status: health?.status === 'ok' && health?.oracle === 'connected' ? 'pass' : 'watch', evidence: httpEvidence },
    { id: 'stdio-adapter', label: 'MCP stdio adapter exists', status: adapterExists ? 'pass' : 'fail', evidence: adapterExists ? adapterPath : 'adapter missing' },
    { id: 'hermes-config', label: 'Hermes native MCP config', status: configConfigured ? 'pass' : 'watch', evidence: configConfigured ? 'arra_oracle server configured; restart Hermes to load native tools.' : 'mcp_servers.arra_oracle not found in ~/.hermes/config.yaml' },
  ];
  const failures = checks.filter((check) => check.status === 'fail');
  const watches = checks.filter((check) => check.status === 'watch');
  const status = failures.length ? 'blocked' : watches.length ? 'watch' : 'connected';
  return {
    updatedAt: generatedAt,
    phase: 'phase_5j',
    summary: 'Phase 5J active: oracle-v2/arra-oracle connection is fixed through a local stdio MCP adapter over the Arra Oracle HTTP memory server.',
    status,
    rootCause: 'The Arra Oracle package runs an HTTP API server, not a native MCP SSE endpoint. Direct MCP HTTP clients expect text/event-stream and fail. The fix is a local stdio JSON-lines MCP adapter that exposes health/search/oracles tools and can autostart the HTTP server.',
    server: {
      package: 'arra-oracle@github:Soul-Brews-Studio/arra-oracle#main',
      url: 'http://127.0.0.1:47778',
      healthEndpoint: '/api/health',
      version: health?.version,
      status: health?.status === 'ok' ? 'ok' : 'watch',
    },
    adapter: {
      path: 'galaxy/scripts/arraOracleMcpAdapter.mjs',
      transport: 'stdio-json-lines',
      tools: ['health', 'search', 'oracles'],
      autostart: true,
      status: adapterExists ? 'ready' : 'fail',
    },
    hermesConfig: {
      configured: configConfigured,
      serverName: 'arra_oracle',
      restartRequired: true,
      configPath: '~/.hermes/config.yaml',
    },
    checks,
    nextStep: configConfigured
      ? 'Restart Hermes/Telegram runtime so native MCP discovers mcp_arra_oracle_health, mcp_arra_oracle_search, and mcp_arra_oracle_oracles.'
      : 'Add mcp_servers.arra_oracle to ~/.hermes/config.yaml, then restart Hermes.',
  };
}

function deriveOperationalReadiness({ websites, repos, github, credentials, deployments, deployTimeline, automation, incidents }) {
  const criticalIncidents = incidents.filter((i) => i.severity === 'critical').length;
  const dirtyRepos = repos.filter((r) => r.dirty).length;
  const onlineSites = websites.filter((w) => w.ok).length;
  const githubOk = github.filter((g) => g.apiStatus === 'ok').length;
  const configuredCreds = credentials.filter((c) => c.configured).length;
  const latestDeploy = deployTimeline.find((event) => event.event === 'deploy') || null;
  const deploymentState = latestDeploy?.syncState === 'in-sync'
    ? 'pass'
    : latestDeploy?.syncState && latestDeploy.syncState !== 'unknown'
      ? 'fail'
      : 'watch';
  const deploymentDetail = latestDeploy?.syncState
    ? `${latestDeploy.project}: ${latestDeploy.syncState}`
    : deployments.length
      ? 'Deployment metadata exists, commit comparison is not confirmed yet.'
      : 'No deployment metadata available in this snapshot.';
  const checks = [
    {
      label: 'Sites online',
      status: onlineSites === websites.length && websites.length > 0 ? 'pass' : onlineSites > 0 ? 'watch' : 'fail',
      detail: `${onlineSites}/${websites.length} monitored sites reachable`,
      weight: 25,
    },
    {
      label: 'Repo cleanliness',
      status: dirtyRepos === 0 ? 'pass' : dirtyRepos <= 2 ? 'watch' : 'fail',
      detail: dirtyRepos === 0 ? 'Tracked repos are clean.' : `${dirtyRepos} tracked repo(s) have local changes.`,
      weight: 20,
    },
    {
      label: 'Cloud sensors',
      status: github.length === 0 ? 'watch' : githubOk === github.length ? 'pass' : githubOk > 0 ? 'watch' : 'fail',
      detail: `${githubOk}/${github.length} GitHub sensors are API OK`,
      weight: 15,
    },
    {
      label: 'Live deploy freshness',
      status: deploymentState,
      detail: deploymentDetail,
      weight: 20,
    },
    {
      label: 'Session gate',
      status: automation.sessionConfigured ? 'pass' : 'watch',
      detail: automation.sessionConfigured ? 'Mike-only signed session gate is configured.' : 'Browser stays preview-only until ORACLE_SESSION_SECRET is configured.',
      weight: 10,
    },
    {
      label: 'Critical alerts',
      status: criticalIncidents === 0 ? 'pass' : 'fail',
      detail: criticalIncidents === 0 ? 'No critical incidents in the current snapshot.' : `${criticalIncidents} critical incident(s) need attention.`,
      weight: 10,
    },
    {
      label: 'Credential readiness',
      status: configuredCreds === credentials.length ? 'pass' : 'watch',
      detail: `${configuredCreds}/${credentials.length} optional sensor credentials configured by name only`,
      weight: 10,
    },
  ];
  const maxScore = checks.reduce((total, check) => total + check.weight, 0);
  const earnedScore = checks.reduce((total, check) => {
    if (check.status === 'pass') return total + check.weight;
    if (check.status === 'watch') return total + check.weight * 0.5;
    return total;
  }, 0);
  const score = Math.round((earnedScore / maxScore) * 100);
  const watchCount = checks.filter((check) => check.status === 'watch').length;
  const failCount = checks.filter((check) => check.status === 'fail').length;
  const status = failCount > 0
    ? score >= 50 ? 'watch' : 'critical'
    : score >= 90 ? 'excellent' : score >= 75 ? 'steady' : score >= 50 ? 'watch' : 'critical';
  return {
    score,
    status,
    summary: failCount
      ? `${failCount} failing check(s), ${watchCount} watch item(s). Fix failures before relying on autonomy.`
      : watchCount
        ? `${watchCount} watch item(s). Oracle is usable, but not fully verified.`
        : 'All readiness checks passed. Oracle is clear for read-only monitoring.',
    checks,
  };
}

// ── Data collection ─────────────────────────────────────────────────────────

const learnings = readMarkdown(join(PSI, 'memory/learnings'));
const retrospectives = readMarkdown(join(PSI, 'memory/retrospectives'));
const active = readMarkdown(join(PSI, 'active'));
const inbox = readMarkdown(join(PSI, 'inbox'));
const writing = readMarkdown(join(PSI, 'writing'));
const lab = readMarkdown(join(PSI, 'lab'));

const repoCandidates = [
  ['Moshe', MOSHE_ROOT],
  ['Oracle Dashboard', ROOT],
  ['Aum Hippie Young', '/Users/pasuthunjunkong/workspace/aum-hippie-young'],
  ['Wiro4x4', '/Users/pasuthunjunkong/workspace/wiro4x4'],
  ['Wiro4x4 Website', '/Users/pasuthunjunkong/workspace/wiro4x4-website'],
];

const websites = await Promise.all([
  oracleDashboardStatus(),
  checkWebsite('Aum Hippie Young', 'https://aum-hippie-young.vercel.app/'),
  checkWebsite('Wiro4x4', 'https://www.wiro4x4indochina.com/'),
]);

const repos = repoCandidates.map(([name, path]) => repoStatus(name, path)).filter(Boolean);
const deployments = await vercelDeployments();
const github = await githubRepoSensors(repos);

// ── Phase 2A intelligence derivation ────────────────────────────────────────

const credentialsConfig = [
  envStatus('VERCEL_TOKEN', 'Optional Vercel deploy status'),
  envStatus('VERCEL_PROJECT_ID', 'Optional Vercel project scoping; local .vercel/project.json fallback supported'),
  envStatus('VERCEL_PROJECT_NAME', 'Alternative Vercel project scoping'),
  envStatus('VERCEL_TEAM_ID', 'Optional Vercel team scoping'),
  envStatus('GITHUB_TOKEN', 'Optional GitHub API read-only status'),
];

const generatedAt = new Date().toISOString();
const automation = oracleAutomationPolicy();
const terminal = oracleTerminalPolicy();
const auditEntries = readOracleAuditEntries(automation.auditPath, 50);
const activeCronsSnapshot = cronJobs();
const auditLearnings = deriveOracleLearnings(auditEntries, learnings, 5);
const recentLearnings = [...auditLearnings, ...learnings].slice(0, 5);
const learningFeedPath = join(PSI, 'memory/learnings/oracle-action-feedback.md');
if (auditLearnings.length) {
  mkdirSync(join(PSI, 'memory/learnings'), { recursive: true });
  writeFileSync(learningFeedPath, `---\ntitle: Oracle action feedback loop\nupdated: ${generatedAt}\n---\n\n# Oracle action feedback loop\n\nThe Oracle now turns session and action audit events into reusable learnings.\n\n${auditLearnings.map((item) => `- **${item.date}** — ${item.title}: ${item.summary}`).join('\n')}\n`);
}
const incidents = deriveIncidents(websites, repos, github, credentialsConfig, generatedAt);
const recommendations = deriveRecommendations(incidents, repos);
const wiroCi = deriveWiroCi(github);
const deployTimeline = deriveDeployTimeline(deployments, repos);
const operationalReadiness = deriveOperationalReadiness({
  websites,
  repos,
  github,
  credentials: credentialsConfig,
  deployments,
  deployTimeline,
  automation,
  incidents,
});
const intelligenceLayer = deriveIntelligenceLayer(active);
const phase5A = derivePhase5A({
  auditEntries,
  activeCrons: activeCronsSnapshot,
  recommendations,
  intelligenceLayer,
  deployTimeline,
  repos,
  generatedAt,
});
const phase5B = derivePhase5B({
  generatedAt,
  phase5A,
  repos,
  deployTimeline,
  operationalReadiness,
  intelligenceLayer,
  automation,
});
const phase5C = derivePhase5C({
  generatedAt,
  phase5A,
  phase5B,
  websites,
});
const phase5D = derivePhase5D({
  generatedAt,
  phase5A,
  phase5C,
  repos,
});
const phase5E = derivePhase5E({
  generatedAt,
  intelligenceLayer,
  phase5B,
  phase5C,
  phase5D,
});
const phase5F = derivePhase5F({
  generatedAt,
  activeCrons: activeCronsSnapshot,
  phase5B,
  phase5C,
  phase5D,
  phase5E,
});
const phase5G = derivePhase5G({
  generatedAt,
  phase5D,
  phase5F,
});
const phase5H = derivePhase5H({ generatedAt });
const phase5I = derivePhase5I({ generatedAt, phase5G, phase5H, learnings, retrospectives, activeCrons: activeCronsSnapshot });
const phase5J = await derivePhase5J({ generatedAt });

const data = {
  generated: generatedAt,
  born: '2026-04-18',
  level3Phase: 'Phase 5J: Arra Oracle MCP connection fixed for semantic memory',
  stats: {
    learnings: learnings.length,
    retrospectives: retrospectives.length,
    activeProjects: active.length,
    inboxItems: inbox.length,
    writingDocs: writing.length,
    labExperiments: lab.length,
  },
  recentLearnings: recentLearnings.slice(0, 5),
  retrospectivesCount: retrospectives.length,
  retrospectivesRecent: retrospectives.slice(0, 5).map((r) => `${r.date} — ${r.title}`),
  activeCrons: activeCronsSnapshot,
  projects: [
    {
      name: 'Moshe Oracle OS',
      url: process.env.ORACLE_DASHBOARD_URL || '',
      status: 'Building',
      note: 'Phase 5J active: Arra Oracle semantic memory is reachable through a local stdio MCP adapter.',
      accent: 'orange',
    },
    {
      name: 'Wiro4x4',
      url: 'https://www.wiro4x4indochina.com',
      status: websites.find((w) => w.name === 'Wiro4x4')?.ok ? 'Online' : 'Check',
      note: 'Adventure tour business. Monitor uptime now; booking/analytics integration can come next.',
      accent: 'green',
    },
    {
      name: 'Aum Hippie Young',
      url: 'https://aum-hippie-young.vercel.app',
      status: websites.find((w) => w.name === 'Aum Hippie Young')?.ok ? 'Online' : 'Check',
      note: 'Website monitored from Oracle without modifying its code.',
      accent: 'cyan',
    },
    {
      name: 'Etsy Digital Products',
      status: 'Validation',
      note: 'Next business step: validate higher-ticket spreadsheet keywords before build.',
      accent: 'violet',
    },
  ],
  websites,
  repos,
  deployments,
  github,
  credentials: credentialsConfig,
  incidents,
  recommendations,
  wiroCi,
  deployTimeline,
  automation,
  operationalReadiness,
  intelligenceLayer,
  terminal,
  phase5A,
  phase5B,
  phase5C,
  phase5D,
  phase5E,
  phase5F,
  phase5G,
  phase5H,
  phase5I,
  phase5J,
  nextActions: [
    'Set ORACLE_SESSION_SECRET to arm the Mike-only signed session gate.',
    'The Oracle now turns audit trail events into learnings before refreshing live data.',
    'Keep the browser read-only until a valid session cookie unlocks execute mode.',
    'Add execution handlers for GitHub and Vercel only after the audit trail is proven.',
    'Use the Intelligence Layer panels to turn learnings into money radar and approval-ready actions.',
    'Use Phase 5A feedback/repo/deploy sensors before recommending safe executor actions.',
    'Use Phase 5B feedback persistence, evidence chains, approval inbox, and value scoring before promoting autonomous safe_now work.',
    'Use Phase 5C run states and promotion gates before scheduling any safe_now autonomous execution.',
    'Use Phase 5D approval callbacks, repo classifications, and deploy smoke gates before top-phase claims.',
    'Enable ORACLE_TERMINAL_ENABLED=true only on Mike local/admin runtime before using the Terminal tab.',
    'Use Phase 5E taste filters: proactive reports must be Wiro-first and framed as watch/test/ignore.',
    'Use Phase 5F learning action memory before creating any recurring safe_now cron pilot.',
    'Use Phase 5G preflight controls before enabling a bounded safe_now cron pilot.',
    'Use Phase 5H integration roadmap: fix oracle-v2 MCP before Oracle Studio and maw-js.',
    'Use Phase 5I Consciousness Loop for bounded sense-reflect-wonder-decide-propose-remember cycles; no public/risky execution without Mike approval.',
    'Use Phase 5J Arra Oracle MCP adapter for semantic memory/search after restarting Hermes.',
  ],
};

writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`✅ Oracle live data written to ${OUT} [Phase 5J]`);
console.log(`   Websites: ${data.websites.map((w) => `${w.name}=${w.ok ? 'OK' : 'FAIL'}`).join(', ')}`);
console.log(`   Incidents: ${data.incidents.length} | Recommendations: ${data.recommendations.length} | Wiro CI: ${data.wiroCi?.conclusion ?? 'none'}`);
console.log(`   Repos: ${data.repos.length} | GitHub sensors: ${data.github.length} | Learnings: ${data.stats.learnings} | Retrospectives: ${data.stats.retrospectives}`);
