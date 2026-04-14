import express from 'express'
import cors from 'cors'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { sessionsRouter } from './routes/sessions.js'
import { skillsRouter } from './routes/skills.js'
import { memoryRouter } from './routes/memory.js'
import { healthRouter } from './routes/health.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)
const GATEWAY_URL = process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'
const API_KEY = process.env.API_SERVER_KEY || ''

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://10.0.30.200:3000'] }))
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[hermes-workspace] middleware listening on http://127.0.0.1:${PORT}`)
  console.log(`[hermes-workspace] proxying to gateway at ${GATEWAY_URL}`)
})
