import express from 'express'
import { createServer } from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'
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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

const app = express()
const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '127.0.0.1'
const GATEWAY_URL = process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'
const API_KEY = process.env.HERMES_API_KEY || ''

app.use(express.json())

// Auth middleware — all /api routes require the bearer token
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (API_KEY && token !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

// Local filesystem routes
app.use('/api/sessions', sessionsRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/memory', memoryRouter)
app.use('/api/health', healthRouter)
app.use('/api/config', configRouter)
app.use('/api/files', filesRouter)
app.use('/api/search', searchRouter)

// Proxy to gateway — chat, models, jobs, runs
const gatewayProxy = createProxyMiddleware({
  target: GATEWAY_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq) => {
      if (API_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${API_KEY}`)
      }
    },
  },
})

app.use('/v1', gatewayProxy)
app.use('/api/jobs', gatewayProxy)

// Serve static files from the Vite build output
app.use(express.static(DIST_DIR))

// SPA fallback: any non-API GET request returns index.html
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

// Create HTTP server + attach WebSocket terminal
const server = createServer(app)
attachTerminalWs(server)

server.listen(PORT, HOST, () => {
  console.log(`[hermes-workspace] production server listening on http://${HOST}:${PORT}`)
  console.log(`[hermes-workspace] serving static files from ${DIST_DIR}`)
  console.log(`[hermes-workspace] proxying to gateway at ${GATEWAY_URL}`)
})
