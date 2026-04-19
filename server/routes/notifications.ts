import { Router } from 'express'
import type { Request, Response } from 'express'
import { getDb, getWriteDb } from '../db.js'

const router = Router()

// SSE broadcaster — shared across all connected clients
const sseClients = new Set<Response>()

function broadcastSSE(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    try {
      client.write(payload)
    } catch {
      // client disconnected — will clean up on next keepalive check
    }
  }
}

function getUnreadCount(db: ReturnType<typeof getDb>): number {
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE read_at IS NULL AND dismissed_at IS NULL'
  ).get() as { c: number }
  return row.c
}

// POST /api/notifications/ingest
router.post('/ingest', (req, res) => {
  const secret = process.env.HERMES_CONSOLE_INGEST_SECRET || ''
  const header = req.headers['x-hermes-ingest-secret'] as string | undefined
  if (!secret || !header || header !== secret) {
    res.status(401).json({ error: 'Invalid or missing ingest secret' })
    return
  }

  const body = req.body as {
    source?: string
    repo?: string
    kind?: string
    title?: string
    body?: string
    url?: string
    severity?: string
    metadata?: unknown
    created_at?: string
  }

  if (!body.source || !body.kind || !body.title) {
    res.status(400).json({ error: 'Missing required fields: source, kind, title' })
    return
  }

  const validSeverities = ['info', 'warning', 'error']
  const severity = validSeverities.includes(body.severity || '') ? body.severity! : 'info'
  const createdAt = body.created_at || new Date().toISOString()
  const metadataJson = body.metadata ? JSON.stringify(body.metadata) : null

  try {
    const db = getWriteDb()
    const result = db.prepare(`
      INSERT INTO notifications (source, repo, kind, title, body, url, severity, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.source,
      body.repo || null,
      body.kind,
      body.title,
      body.body || null,
      body.url || null,
      severity,
      metadataJson,
      createdAt,
    )
    const id = result.lastInsertRowid

    // Fetch the inserted row for broadcasting
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Record<string, unknown>
    db.close()

    // Broadcast to SSE clients
    broadcastSSE('notification', row)

    res.status(201).json({ id, notification: row })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Number(req.query.offset) || 0
    const unread = req.query.unread === 'true'
    const repo = req.query.repo as string | undefined
    const kind = req.query.kind as string | undefined
    const source = req.query.source as string | undefined

    const conditions: string[] = ['dismissed_at IS NULL']
    const params: unknown[] = []

    if (unread) {
      conditions.push('read_at IS NULL')
    }
    if (repo) {
      conditions.push('repo = ?')
      params.push(repo)
    }
    if (kind) {
      conditions.push('kind = ?')
      params.push(kind)
    }
    if (source) {
      conditions.push('source = ?')
      params.push(source)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const items = db.prepare(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    const totalRow = db.prepare(
      `SELECT COUNT(*) as c FROM notifications ${where}`
    ).get(...params) as { c: number }

    const unreadCount = getUnreadCount(db)
    db.close()

    res.json({ items, total: totalRow.c, unread_count: unreadCount })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', (_req, res) => {
  try {
    const db = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(
      'UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND dismissed_at IS NULL'
    ).run(now)
    db.close()

    // Broadcast updated unread count
    const roDb = getDb()
    const unreadCount = getUnreadCount(roDb)
    roDb.close()
    broadcastSSE('unread_count', { count: unreadCount })

    res.json({ count: result.changes })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/notifications/:id/read
router.post('/:id/read', (req, res) => {
  try {
    const db = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(
      'UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL'
    ).run(now, req.params.id)
    db.close()

    // Broadcast updated unread count
    const roDb = getDb()
    const unreadCount = getUnreadCount(roDb)
    roDb.close()
    broadcastSSE('unread_count', { count: unreadCount })

    if (result.changes === 0) {
      res.status(404).json({ error: 'Notification not found or already read' })
      return
    }
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(
      'UPDATE notifications SET dismissed_at = ? WHERE id = ? AND dismissed_at IS NULL'
    ).run(now, req.params.id)
    db.close()

    // Broadcast updated unread count
    const roDb = getDb()
    const unreadCount = getUnreadCount(roDb)
    roDb.close()
    broadcastSSE('unread_count', { count: unreadCount })

    if (result.changes === 0) {
      res.status(404).json({ error: 'Notification not found or already dismissed' })
      return
    }
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/notifications/stream (SSE)
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // for nginx/SWAG
  })

  // Send initial unread count
  try {
    const db = getDb()
    const unreadCount = getUnreadCount(db)
    db.close()
    res.write(`event: unread_count\ndata: ${JSON.stringify({ count: unreadCount })}\n\n`)
  } catch {
    res.write(`event: unread_count\ndata: {"count":0}\n\n`)
  }

  sseClients.add(res)

  // Keep-alive ping every 20 seconds
  const keepalive = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      clearInterval(keepalive)
      sseClients.delete(res)
    }
  }, 20000)

  req.on('close', () => {
    clearInterval(keepalive)
    sseClients.delete(res)
  })
})

// Export broadcaster for use in ingest route (already used internally above)
export { broadcastSSE, sseClients }
export { router as notificationsRouter }