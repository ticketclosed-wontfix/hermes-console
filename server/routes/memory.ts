import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()
const MEMORIES_DIR = path.join(os.homedir(), '.hermes', 'memories')

// GET /api/memory — get memory and user profile
router.get('/', (_req, res) => {
  try {
    const memoryPath = path.join(MEMORIES_DIR, 'MEMORY.md')
    const userPath = path.join(MEMORIES_DIR, 'USER.md')

    const memory = fs.existsSync(memoryPath) ? fs.readFileSync(memoryPath, 'utf-8') : ''
    const user = fs.existsSync(userPath) ? fs.readFileSync(userPath, 'utf-8') : ''

    res.json({
      memory: { content: memory, chars: memory.length, maxChars: 2200 },
      user: { content: user, chars: user.length, maxChars: 1375 },
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as memoryRouter }
