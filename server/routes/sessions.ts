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

// GET /api/sessions/:id/export — export session as markdown or JSON
router.get('/:id/export', (req, res) => {
  try {
    const db = getDb()
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!session) {
      db.close()
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const messages = db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(req.params.id) as Record<string, unknown>[]
    db.close()

    const format = (req.query.format as string) || 'json'

    if (format === 'json') {
      const filename = `session-${req.params.id}.json`
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Type', 'application/json')
      res.json({ session, messages })
      return
    }

    if (format === 'markdown') {
      const title = (session.title as string) || 'Untitled Session'
      const model = (session.model as string) || 'unknown'
      const startedAt = session.started_at
        ? new Date((session.started_at as number) * 1000).toISOString()
        : 'unknown'
      const inputTokens = session.input_tokens ?? 0
      const outputTokens = session.output_tokens ?? 0
      const cost = session.estimated_cost_usd != null
        ? `$${(session.estimated_cost_usd as number).toFixed(4)}`
        : 'N/A'

      let md = `# ${title}\n\n`
      md += `| Field | Value |\n|-------|-------|\n`
      md += `| Model | ${model} |\n`
      md += `| Started | ${startedAt} |\n`
      md += `| Tokens | ${inputTokens} in / ${outputTokens} out |\n`
      md += `| Est. Cost | ${cost} |\n\n---\n\n`

      for (const msg of messages) {
        const role = (msg.role as string) || 'unknown'
        const content = (msg.content as string) || ''
        const toolCalls = msg.tool_calls as string | null
        const toolName = msg.tool_name as string | null

        if (role === 'user') {
          md += `## User\n\n${content}\n\n`
        } else if (role === 'assistant') {
          md += `## Assistant\n\n${content}\n\n`
          if (toolCalls) {
            md += `<details>\n<summary>Tool Calls</summary>\n\n\`\`\`json\n${toolCalls}\n\`\`\`\n\n</details>\n\n`
          }
        } else if (role === 'tool') {
          md += `## Tool${toolName ? ` (${toolName})` : ''}\n\n\`\`\`\n${content}\n\`\`\`\n\n`
        } else {
          md += `## ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n${content}\n\n`
        }
      }

      const filename = `session-${req.params.id}.md`
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.send(md)
      return
    }

    res.status(400).json({ error: 'Invalid format. Use "json" or "markdown".' })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/sessions/:id/fork — fork session messages
router.post('/:id/fork', (req, res) => {
  try {
    const db = getDb()
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
    if (!session) {
      db.close()
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const messages = db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(req.params.id)
    db.close()

    res.json({ messages, source_session: session })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as sessionsRouter }
