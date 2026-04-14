import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()
const SKILLS_DIR = path.join(os.homedir(), '.hermes', 'skills')

type SkillSummary = {
  name: string
  category: string | null
  description: string
  path: string
}

function parseSkillFrontmatter(content: string): { description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { description: '' }
  const descMatch = match[1].match(/description:\s*>?\s*\n?\s*(.+?)(?:\n\S|\n---)/s)
  return { description: descMatch?.[1]?.trim() || '' }
}

function scanSkills(dir: string, category: string | null = null): SkillSummary[] {
  const results: SkillSummary[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      const skillFile = path.join(fullPath, 'SKILL.md')
      if (fs.existsSync(skillFile)) {
        try {
          const content = fs.readFileSync(skillFile, 'utf-8')
          const { description } = parseSkillFrontmatter(content)
          results.push({
            name: entry.name,
            category,
            description,
            path: path.relative(SKILLS_DIR, fullPath),
          })
        } catch {
          // skip unreadable skill files
        }
      } else {
        // It's a category directory
        results.push(...scanSkills(fullPath, entry.name))
      }
    }
  }
  return results
}

// GET /api/skills — list all skills
router.get('/', (_req, res) => {
  try {
    const skills = scanSkills(SKILLS_DIR)
    const categories = [...new Set(skills.map(s => s.category).filter(Boolean))]
    res.json({ skills, categories, total: skills.length })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/skills/:name — get skill content
router.get('/:name', (req, res) => {
  try {
    const skills = scanSkills(SKILLS_DIR)
    const skill = skills.find(s => s.name === req.params.name)
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' })
      return
    }
    const skillFile = path.join(SKILLS_DIR, skill.path, 'SKILL.md')
    const content = fs.readFileSync(skillFile, 'utf-8')
    res.json({ ...skill, content })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export { router as skillsRouter }
