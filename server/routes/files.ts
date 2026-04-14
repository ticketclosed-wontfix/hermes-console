import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()
const HERMES_ROOT = path.join(os.homedir(), '.hermes')

// Allowed subdirectories — don't expose everything
const ALLOWED_ROOTS = ['skills', 'memory', 'knowledge', 'profiles', 'scripts', 'plans', 'logs']

function safePath(requestedPath: string): string | null {
  const resolved = path.resolve(HERMES_ROOT, requestedPath)
  // Must be within HERMES_ROOT
  if (!resolved.startsWith(HERMES_ROOT + path.sep) && resolved !== HERMES_ROOT) {
    return null
  }
  // Must be within an allowed root (or the HERMES_ROOT itself for listing)
  if (resolved === HERMES_ROOT) return resolved
  const relative = path.relative(HERMES_ROOT, resolved)
  const topDir = relative.split(path.sep)[0]
  if (!ALLOWED_ROOTS.includes(topDir)) return null
  return resolved
}

type TreeEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: TreeEntry[]
}

function buildTree(dirPath: string, relativeTo: string, depth = 0, maxDepth = 3): TreeEntry[] {
  if (depth > maxDepth) return []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .map((entry) => {
        const fullPath = path.join(dirPath, entry.name)
        const relPath = path.relative(relativeTo, fullPath)
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: relPath,
            type: 'directory' as const,
            children: buildTree(fullPath, relativeTo, depth + 1, maxDepth),
          }
        }
        const stat = fs.statSync(fullPath)
        return {
          name: entry.name,
          path: relPath,
          type: 'file' as const,
          size: stat.size,
        }
      })
  } catch {
    return []
  }
}

// GET /api/files — list tree from HERMES_ROOT
router.get('/', (_req, res) => {
  try {
    const roots = ALLOWED_ROOTS.filter((dir) => {
      const fullPath = path.join(HERMES_ROOT, dir)
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()
    }).map((dir) => ({
      name: dir,
      path: dir,
      type: 'directory' as const,
      children: buildTree(path.join(HERMES_ROOT, dir), HERMES_ROOT),
    }))

    res.json({ tree: roots, root: '~/.hermes' })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/files/*filePath — read a file (Express 5 wildcard syntax)
router.get('/*filePath', (req, res) => {
  try {
    // Express 5 + path-to-regexp v8: wildcard param is array of segments
    const segments = req.params.filePath as unknown as string[]
    const requestedPath = Array.isArray(segments) ? segments.join('/') : String(segments || '')
    const resolved = safePath(requestedPath)
    if (!resolved) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      const children = buildTree(resolved, HERMES_ROOT)
      res.json({ type: 'directory', path: requestedPath, children })
      return
    }

    // Cap at 1MB
    if (stat.size > 1_048_576) {
      res.status(413).json({ error: 'File too large (>1MB)' })
      return
    }

    const content = fs.readFileSync(resolved, 'utf-8')
    res.json({
      type: 'file',
      path: requestedPath,
      name: path.basename(resolved),
      size: stat.size,
      content,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as filesRouter }
