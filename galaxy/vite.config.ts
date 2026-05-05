import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import oracleActionsHandler from './api/oracle/actions.js'
import oracleSessionHandler from './api/oracle/session.js'

const ORACLE_API_ROUTES = new Map([
  ['/api/oracle/actions', oracleActionsHandler],
  ['/api/oracle/session', oracleSessionHandler],
])

function oracleActionApiPlugin() {
  return {
    name: 'oracle-action-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? '', 'http://localhost').pathname
        const handler = ORACLE_API_ROUTES.get(pathname)
        if (!handler) {
          return next()
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        const rawBody = Buffer.concat(chunks).toString('utf8')
        if (rawBody) {
          try {
            req.body = JSON.parse(rawBody)
          } catch (error) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({
              ok: false,
              error: 'invalid_json',
              message: 'Request body must be valid JSON.',
              detail: String(error?.message ?? error),
            }))
            return
          }
        } else {
          req.body = {}
        }

        await handler(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), oracleActionApiPlugin()],
  base: '/',
  optimizeDeps: {
    include: ['three'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'three-vendor'
            if (id.includes('react-dom') || id.includes('react/jsx-runtime') || id.includes('/react/')) return 'react-vendor'
          }

          if (id.includes('knowledge-map-3d')) {
            return 'knowledge-map-3d'
          }

          return undefined
        },
      },
    },
  },
})
