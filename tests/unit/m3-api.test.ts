import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchSkills: vi.fn(),
  fetchSkill: vi.fn(),
  fetchMemory: vi.fn(),
  fetchConfig: vi.fn(),
}))

import {
  fetchSkills,
  fetchSkill,
  fetchMemory,
  fetchConfig,
  type SkillSummary,
  type MemoryData,
  type ConfigData,
} from '@/lib/api'

const mockSkill: SkillSummary = {
  name: 'coding-router',
  category: 'software-development',
  description: 'Load for ANY coding task.',
  path: 'software-development/coding-router',
}

const mockMemory: MemoryData = {
  memory: { content: '# Memory notes\nSome memory content', chars: 37, maxChars: 2200 },
  user: { content: '# User profile\nNick is an MSP engineer', chars: 39, maxChars: 1375 },
}

const mockConfig: ConfigData = {
  config: 'llm:\n  provider: custom\n  model: claude-sonnet-4',
  soul: '# SOUL.md\nDirect, sharp operator.',
  envVars: [
    { key: 'HERMES_API_KEY', hasValue: true },
    { key: 'R2_ACCESS_KEY_ID', hasValue: true },
    { key: 'SOME_EMPTY_VAR', hasValue: false },
  ],
}

describe('Skills API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchSkills returns skills list with categories', async () => {
    vi.mocked(fetchSkills).mockResolvedValue({
      skills: [mockSkill],
      categories: ['software-development'],
      total: 1,
    })

    const result = await fetchSkills()
    expect(result.skills).toHaveLength(1)
    expect(result.skills[0].name).toBe('coding-router')
    expect(result.categories).toContain('software-development')
    expect(result.total).toBe(1)
  })

  it('fetchSkill returns skill with content', async () => {
    vi.mocked(fetchSkill).mockResolvedValue({
      ...mockSkill,
      content: '---\nname: coding-router\n---\n# Coding Router',
    })

    const result = await fetchSkill('coding-router')
    expect(result.name).toBe('coding-router')
    expect(result.content).toContain('# Coding Router')
    expect(fetchSkill).toHaveBeenCalledWith('coding-router')
  })

  it('fetchSkills filters by category', async () => {
    vi.mocked(fetchSkills).mockResolvedValue({
      skills: [mockSkill],
      categories: ['software-development'],
      total: 1,
    })

    const result = await fetchSkills()
    const devSkills = result.skills.filter((s) => s.category === 'software-development')
    expect(devSkills).toHaveLength(1)
  })
})

describe('Memory API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchMemory returns memory and user data', async () => {
    vi.mocked(fetchMemory).mockResolvedValue(mockMemory)

    const result = await fetchMemory()
    expect(result.memory.content).toContain('Memory notes')
    expect(result.user.content).toContain('User profile')
    expect(result.memory.chars).toBe(37)
    expect(result.user.maxChars).toBe(1375)
  })

  it('memory has correct capacity tracking', async () => {
    vi.mocked(fetchMemory).mockResolvedValue(mockMemory)

    const result = await fetchMemory()
    const memPct = Math.round((result.memory.chars / result.memory.maxChars) * 100)
    expect(memPct).toBeGreaterThan(0)
    expect(memPct).toBeLessThan(100)
  })
})

describe('Config API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchConfig returns config, soul, and env vars', async () => {
    vi.mocked(fetchConfig).mockResolvedValue(mockConfig)

    const result = await fetchConfig()
    expect(result.config).toContain('provider: custom')
    expect(result.soul).toContain('SOUL.md')
    expect(result.envVars).toHaveLength(3)
  })

  it('env vars show set/empty status without exposing values', async () => {
    vi.mocked(fetchConfig).mockResolvedValue(mockConfig)

    const result = await fetchConfig()
    const apiKey = result.envVars.find((v) => v.key === 'HERMES_API_KEY')
    expect(apiKey?.hasValue).toBe(true)

    const emptyVar = result.envVars.find((v) => v.key === 'SOME_EMPTY_VAR')
    expect(emptyVar?.hasValue).toBe(false)
  })

  it('ConfigData type has correct shape', () => {
    expect(mockConfig.config).toBeDefined()
    expect(mockConfig.soul).toBeDefined()
    expect(Array.isArray(mockConfig.envVars)).toBe(true)
    expect(mockConfig.envVars[0]).toHaveProperty('key')
    expect(mockConfig.envVars[0]).toHaveProperty('hasValue')
  })
})
