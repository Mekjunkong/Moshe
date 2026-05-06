#!/usr/bin/env node
import { stdin, stdout, stderr } from 'node:process';
import { spawn } from 'node:child_process';

const ORACLE_URL = (process.env.ORACLE_V2_URL || 'http://127.0.0.1:47778').replace(/\/$/, '');
const VERSION = '0.1.0';
const AUTOSTART = String(process.env.ARRA_ORACLE_AUTOSTART || '').toLowerCase() === 'true';
const ORACLE_PORT = new URL(ORACLE_URL).port || '47778';
let oracleChild = null;

let buffer = Buffer.alloc(0);
let transportMode = 'headers';

function log(message) {
  stderr.write(`[arra-oracle-mcp] ${message}\n`);
}

function send(payload) {
  const json = JSON.stringify(payload);
  if (transportMode === 'lines') {
    stdout.write(`${json}\n`);
    return;
  }
  const body = Buffer.from(json, 'utf8');
  stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  stdout.write(body);
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function rawFetchJson(path) {
  const url = `${ORACLE_URL}${path}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

function startOracleServer() {
  if (oracleChild || !AUTOSTART) return;
  const bunx = process.env.ARRA_ORACLE_BUNX || 'bunx';
  const pkg = process.env.ARRA_ORACLE_PACKAGE || 'arra-oracle@github:Soul-Brews-Studio/arra-oracle#main';
  oracleChild = spawn(bunx, ['--bun', pkg, '--port', ORACLE_PORT], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, ORACLE_PORT },
  });
  oracleChild.stderr?.on('data', (chunk) => log(`oracle server: ${String(chunk).trim().slice(0, 500)}`));
  oracleChild.on('exit', (code) => {
    log(`oracle server exited with code ${code}`);
    oracleChild = null;
  });
  log(`autostarted Arra Oracle HTTP server on ${ORACLE_URL}`);
}

async function ensureOracleServer() {
  try {
    return await rawFetchJson('/api/health');
  } catch (firstError) {
    if (!AUTOSTART) throw firstError;
    startOracleServer();
    for (let i = 0; i < 20; i += 1) {
      await sleep(500);
      try {
        return await rawFetchJson('/api/health');
      } catch {}
    }
    throw firstError;
  }
}

async function fetchJson(path) {
  if (path !== '/api/health') await ensureOracleServer();
  return rawFetchJson(path);
}

function textContent(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

const tools = [
  {
    name: 'health',
    description: 'Check local Arra Oracle HTTP server health and version.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search',
    description: 'Search the Arra Oracle memory layer. Uses the local HTTP /api/search?q= endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query.' },
        limit: { type: 'number', description: 'Maximum results to return.', default: 5 },
      },
      required: ['q'],
      additionalProperties: false,
    },
  },
  {
    name: 'oracles',
    description: 'List Oracle identities and project activity from local Arra Oracle.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

async function callTool(name, args = {}) {
  if (name === 'health') {
    return textContent(await ensureOracleServer());
  }
  if (name === 'search') {
    const q = String(args.q || '').trim();
    if (!q) throw new Error('q is required');
    const limit = Number.isFinite(Number(args.limit)) ? Math.max(1, Math.min(20, Number(args.limit))) : 5;
    const data = await fetchJson(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    return textContent(data);
  }
  if (name === 'oracles') {
    return textContent(await fetchJson('/api/oracles'));
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(message) {
  const { id, method, params } = message;
  if (process.env.ARRA_MCP_DEBUG_LOG) {
    try {
      await import('node:fs').then(({ appendFileSync }) => appendFileSync(process.env.ARRA_MCP_DEBUG_LOG, `${new Date().toISOString()} ${method} id=${id ?? 'none'}\n`));
    } catch {}
  }
  try {
    if (method === 'initialize') {
      result(id, {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'arra-oracle-mcp-adapter', version: VERSION },
      });
      return;
    }
    if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return;
    if (method === 'ping') {
      result(id, {});
      return;
    }
    if (method === 'tools/list') {
      result(id, { tools });
      return;
    }
    if (method === 'tools/call') {
      const out = await callTool(params?.name, params?.arguments || {});
      result(id, out);
      return;
    }
    error(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    error(id, -32000, err instanceof Error ? err.message : String(err));
  }
}

function parseFrames() {
  while (true) {
    const trimmedStart = buffer.toString('utf8', 0, Math.min(buffer.length, 32)).trimStart();
    if (trimmedStart.startsWith('{')) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) return;
      transportMode = 'lines';
      const line = buffer.slice(0, newline).toString('utf8').trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      try {
        void handle(JSON.parse(line));
      } catch (err) {
        log(`invalid line message: ${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    const crlfSep = buffer.indexOf('\r\n\r\n');
    const lfSep = buffer.indexOf('\n\n');
    let sep = -1;
    let sepLength = 4;
    if (crlfSep !== -1 && (lfSep === -1 || crlfSep <= lfSep)) {
      sep = crlfSep;
      sepLength = 4;
    } else if (lfSep !== -1) {
      sep = lfSep;
      sepLength = 2;
    }
    if (sep === -1) return;
    transportMode = 'headers';
    const header = buffer.slice(0, sep).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(sep + sepLength);
      continue;
    }
    const length = Number(match[1]);
    const start = sep + sepLength;
    const end = start + length;
    if (buffer.length < end) return;
    const body = buffer.slice(start, end).toString('utf8');
    buffer = buffer.slice(end);
    try {
      void handle(JSON.parse(body));
    } catch (err) {
      log(`invalid framed message: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  parseFrames();
});

stdin.on('end', () => process.exit(0));
log(`adapter ready; ORACLE_V2_URL=${ORACLE_URL}`);
