import express from 'express'
import type { Express } from 'express'
import { createServer } from 'http'
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'
import { sessionsRouter } from './routes/sessions.js'
import { skillsRouter } from './routes/skills.js'
import { memoryRouter } from './routes/memory.js'
import { healthRouter } from './routes/health.js'
import { configRouter } from './routes/config.js'
import { filesRouter } from './routes/files.js'
import { searchRouter } from './routes/search.js'
import { attachTerminalWs } from './terminal.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

export type AppOptions = {
  apiKey?: string
  gatewayUrl?: string
  distDir?: string
  // When true, skip serving static files + SPA fallback (useful for pure API tests).
  skipStatic?: boolean
}

export function createApp(opts: AppOptions = {}): Express {
  const app = express()

  // Read the bearer token from API_SERVER_KEY (matches .env variable name).
  // Also accept legacy HERMES_API_KEY for back-compat. Without this, the gateway
  // proxy forwards no Authorization header and every /v1/chat/completions call
  // returns 403, which the UI silently swallows.
  const API_KEY =
    opts.apiKey ?? (process.env.API_SERVER_KEY || process.env.HERMES_API_KEY || '')
  const GATEWAY_URL =
    opts.gatewayUrl ?? (process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642')
  const distDir = opts.distDir ?? DIST_DIR

  app.use(express.json({ limit: '20mb' }))

  // NOTE: The /api routes hit local SQLite only and are reachable only from
  // same-origin browser requests against this server. They do NOT require the
  // gateway bearer. Previously a /api auth middleware existed but it only
  // "worked" because HERMES_API_KEY was never set and the check short-circuited;
  // activating it would lock out the browser (which never sends a bearer).
  // Auth is enforced only on the upstream proxy to the Hermes gateway.

  // Local filesystem routes
  app.use('/api/sessions', sessionsRouter)
  app.use('/api/skills', skillsRouter)
  app.use('/api/memory', memoryRouter)
  app.use('/api/health', healthRouter)
  app.use('/api/config', configRouter)
  app.use('/api/files', filesRouter)
  app.use('/api/search', searchRouter)

  // Proxy to gateway — chat, models, jobs, runs.
  // NOTE: When mounted via app.use('/v1', ...), Express strips '/v1' from
  // req.url before the proxy sees it. We register at the app root and use
  // pathFilter so the proxy receives the full original URL.
  const gatewayProxy = createProxyMiddleware({
    target: GATEWAY_URL,
    changeOrigin: true,
    pathFilter: (pathname: string) =>
      pathname.startsWith('/v1/') || pathname.startsWith('/api/jobs'),
    on: {
      proxyReq: (proxyReq, req) => {
        if (API_KEY) {
          proxyReq.setHeader('Authorization', `Bearer ${API_KEY}`)
        }
        // express.json() already consumed req.body — re-serialize it onto the
        // proxied request or upstream gets an empty stream.
        fixRequestBody(proxyReq, req as any)
      },
    },
  })

  app.use(gatewayProxy)

  if (!opts.skipStatic) {
    // Serve static files from the Vite build output
    app.use(express.static(distDir))

    // SPA fallback: any non-API GET request returns index.html
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  return app
}

// When imported as the entry point, start the server. Under Vitest we only
// want createApp; skip binding the port.
const isEntryPoint = !process.env.VITEST && process.env.NODE_ENV !== 'test'

if (isEntryPoint) {
  const PORT = Number(process.env.PORT || 3001)
  const HOST = process.env.HOST || '127.0.0.1'
  const GATEWAY_URL = process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'

  const app = createApp()
  const server = createServer(app)
  attachTerminalWs(server)

  server.listen(PORT, HOST, () => {
    console.log(
      `[hermes-console] production server listening on http://${HOST}:${PORT}`,
    )
    console.log(`[hermes-console] serving static files from ${DIST_DIR}`)
    console.log(`[hermes-console] proxying to gateway at ${GATEWAY_URL}`)
  })
}
