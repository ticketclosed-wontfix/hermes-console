import { Router } from 'express'
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const router = Router()
const DB_PATH = path.join(os.homedir(), '.hermes', 'state.db')

function getDb() {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true })
}

// GET /api/sessions — list sessions
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Number(req.query.offset) || 0
    const search = (req.query.q as string)?.trim()

    let sessions
    if (search) {
      sessions = db.prepare(`
        SELECT s.* FROM sessions s
        JOIN messages m ON m.session_id = s.id
        JOIN messages_fts fts ON fts.rowid = m.id
        WHERE messages_fts MATCH ?
        GROUP BY s.id
        ORDER BY s.started_at DESC
        LIMIT ? OFFSET ?
      `).all(search, limit, offset)
    } else {
      sessions = db.prepare(
        'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?'
      ).all(limit, offset)
    }

    const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }
    db.close()

    res.json({ items: sessions, total: total.count })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/sessions/:id — get session
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
    db.close()

    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.json({ session })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/sessions/:id/messages — get messages for a session
router.get('/:id/messages', (req, res) => {
  try {
    const db = getDb()
    const messages = db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(req.params.id)
    db.close()

    res.json({ items: messages, total: messages.length })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as sessionsRouter }
