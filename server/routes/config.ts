import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()
const HERMES_DIR = path.join(os.homedir(), '.hermes')

// GET /api/config — read hermes config
router.get('/', (_req, res) => {
  try {
    const configPath = path.join(HERMES_DIR, 'config.yaml')
    const envPath = path.join(HERMES_DIR, '.env')
    const soulPath = path.join(HERMES_DIR, 'SOUL.md')

    const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : ''
    const soul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf-8') : ''

    // Read .env but redact secret values
    let envVars: { key: string; hasValue: boolean }[] = []
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      envVars = envContent
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .map((line) => {
          const eqIdx = line.indexOf('=')
          return {
            key: line.slice(0, eqIdx).trim(),
            hasValue: line.slice(eqIdx + 1).trim().length > 0,
          }
        })
    }

    res.json({ config, soul, envVars })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as configRouter }
