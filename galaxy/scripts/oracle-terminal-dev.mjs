#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const passphrase = process.env.ORACLE_SESSION_SECRET || `oracle-local-${randomBytes(18).toString('base64url')}`
const port = process.env.PORT || '5173'

console.log('\n🟠 Moshe Oracle local terminal runtime')
console.log('────────────────────────────────────────')
console.log(`URL:        http://localhost:${port}`)
console.log('Terminal:   ENABLED for this local process')
console.log(`Passphrase: ${passphrase}`)
console.log('Safety:     signed session + same-origin + denylist + workspace cwd allowlist')
console.log('\nOpen the Oracle dashboard, unlock the session, then use the Terminal tab.')
console.log('For Codex recipe, try: command -v codex && codex --version')
console.log('────────────────────────────────────────\n')

const child = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ORACLE_SESSION_SECRET: passphrase,
    ORACLE_TERMINAL_ENABLED: 'true',
    ORACLE_TERMINAL_AUDIT_PATH: process.env.ORACLE_TERMINAL_AUDIT_PATH || '/tmp/oracle-terminal-audit.jsonl',
  },
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
