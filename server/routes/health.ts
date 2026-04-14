import { Router } from 'express'

const router = Router()
const GATEWAY_URL = process.env.HERMES_GATEWAY_URL || 'http://127.0.0.1:8642'

// GET /api/health — aggregate health check
router.get('/', async (_req, res) => {
  try {
    const gatewayRes = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    const gateway = gatewayRes.ok ? await gatewayRes.json() : { status: 'unreachable' }

    res.json({
      workspace: { status: 'ok' },
      gateway: { ...gateway, url: GATEWAY_URL },
    })
  } catch {
    res.json({
      workspace: { status: 'ok' },
      gateway: { status: 'unreachable', url: GATEWAY_URL },
    })
  }
})

export { router as healthRouter }
