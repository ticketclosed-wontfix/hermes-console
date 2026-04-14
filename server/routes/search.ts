import { Router } from 'express'
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const router = Router()
const DB_PATH = path.join(os.homedir(), '.hermes', 'state.db')

function getDb() {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true })
}

type SearchHit = {
  session_id: string
  session_title: string | null
  model: string | null
  started_at: number
  message_id: number
  role: string
  snippet: string
  timestamp: number
}

// GET /api/search?q=query&limit=20
router.get('/', (req, res) => {
  try {
    const query = (req.query.q as string)?.trim()
    if (!query) {
      res.status(400).json({ error: 'Missing q parameter' })
      return
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100)
    const offset = Number(req.query.offset) || 0
    const db = getDb()

    // FTS5 search across messages, returning snippets with session context
    const hits = db.prepare(`
      SELECT
        s.id as session_id,
        s.title as session_title,
        s.model,
        s.started_at,
        m.id as message_id,
        m.role,
        snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet,
        m.timestamp
      FROM messages_fts fts
      JOIN messages m ON m.id = fts.rowid
      JOIN sessions s ON s.id = m.session_id
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(query, limit, offset) as SearchHit[]

    // Count total matches
    const countResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages_fts
      WHERE messages_fts MATCH ?
    `).get(query) as { count: number }

    db.close()

    res.json({
      items: hits,
      total: countResult.count,
      query,
    })
  } catch (err) {
    const msg = String(err)
    // FTS5 syntax errors are user errors, not 500s
    if (msg.includes('fts5')) {
      res.status(400).json({ error: 'Invalid search query', detail: msg })
      return
    }
    res.status(500).json({ error: msg })
  }
})

export { router as searchRouter }
