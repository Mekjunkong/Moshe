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
    lastCommitAt: safeExec('git', ['log', '-1', '--pretty=%cI'], path),
    github: github ? `${github.owner}/${github.repo}` : undefined,
    remoteHost: github ? 'github.com' : undefined,
  };
}

function envStatus(name, purpose) {
  return { name, configured: Boolean(process.env[name]), purpose };
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
        risk: 'low',
        requiresConfirmation: true,
      },
      {
        id: 'dispatch-wiro-ci',
        title: 'Dispatch Wiro CI',
        description: 'Trigger the allowlisted GitHub workflow that verifies Wiro4x4 health.',
        transport: 'github-api',
        risk: 'medium',
        requiresConfirmation: true,
      },
      {
        id: 'vercel-redeploy',
        title: 'Request Vercel redeploy',
        description: 'Ask Vercel to redeploy the Oracle dashboard after a confirmed change.',
        transport: 'vercel-api',
        risk: 'medium',
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
const auditEntries = readOracleAuditEntries(automation.auditPath, 50);
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

const data = {
  generated: generatedAt,
  born: '2026-04-18',
  level3Phase: 'Phase 3B: Feedback loop — audit-derived learnings, auth, allowlist, audit log, preview mode',
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
  activeCrons: cronJobs(),
  projects: [
    {
      name: 'Moshe Oracle OS',
      url: process.env.ORACLE_DASHBOARD_URL || '',
      status: 'Building',
      note: 'Phase 3A active: server-side action API foundation, auth, allowlist, audit log.',
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
  nextActions: [
    'Set ORACLE_SESSION_SECRET to arm the Mike-only signed session gate.',
    'The Oracle now turns audit trail events into learnings before refreshing live data.',
    'Keep the browser read-only until a valid session cookie unlocks execute mode.',
    'Add execution handlers for GitHub and Vercel only after the audit trail is proven.',
  ],
};

writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
console.log(`✅ Oracle live data written to ${OUT} [Phase 2A]`);
console.log(`   Websites: ${data.websites.map((w) => `${w.name}=${w.ok ? 'OK' : 'FAIL'}`).join(', ')}`);
console.log(`   Incidents: ${data.incidents.length} | Recommendations: ${data.recommendations.length} | Wiro CI: ${data.wiroCi?.conclusion ?? 'none'}`);
console.log(`   Repos: ${data.repos.length} | GitHub sensors: ${data.github.length} | Learnings: ${data.stats.learnings} | Retrospectives: ${data.stats.retrospectives}`);
