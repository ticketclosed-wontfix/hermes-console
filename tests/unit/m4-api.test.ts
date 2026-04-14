import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchFileTree: vi.fn(),
  fetchFile: vi.fn(),
  searchMessages: vi.fn(),
}))

import {
  fetchFileTree,
  fetchFile,
  searchMessages,
  type FileEntry,
  type FileContent,
  type SearchHit,
} from '@/lib/api'

const mockTree: FileEntry[] = [
  {
    name: 'skills',
    path: 'skills',
    type: 'directory',
    children: [
      {
        name: 'coding-router',
        path: 'skills/coding-router',
        type: 'directory',
        children: [
          { name: 'SKILL.md', path: 'skills/coding-router/SKILL.md', type: 'file', size: 4500 },
        ],
      },
    ],
  },
  {
    name: 'memory',
    path: 'memory',
    type: 'directory',
    children: [
      { name: 'note1.md', path: 'memory/note1.md', type: 'file', size: 200 },
    ],
  },
]

const mockFile: FileContent = {
  type: 'file',
  path: 'skills/coding-router/SKILL.md',
  name: 'SKILL.md',
  size: 4500,
  content: '---\nname: coding-router\n---\n# Coding Router\nSome content here.',
}

const mockSearchHits: SearchHit[] = [
  {
    session_id: 'abc-123',
    session_title: 'Fix the bug',
    model: 'claude-sonnet-4',
    started_at: 1713100000,
    message_id: 42,
    role: 'assistant',
    snippet: 'I found the <<bug>> in the code',
    timestamp: 1713100500,
  },
  {
    session_id: 'abc-123',
    session_title: 'Fix the bug',
    model: 'claude-sonnet-4',
    started_at: 1713100000,
    message_id: 43,
    role: 'user',
    snippet: 'Can you fix this <<bug>> please',
    timestamp: 1713100600,
  },
  {
    session_id: 'def-456',
    session_title: 'Deploy pipeline',
    model: 'claude-opus-4-6',
    started_at: 1713200000,
    message_id: 99,
    role: 'assistant',
    snippet: 'The deployment <<pipeline>> is ready',
    timestamp: 1713200100,
  },
]

describe('Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchFileTree returns tree with allowed directories', async () => {
    vi.mocked(fetchFileTree).mockResolvedValue({ tree: mockTree, root: '~/.hermes' })

    const result = await fetchFileTree()
    expect(result.root).toBe('~/.hermes')
    expect(result.tree).toHaveLength(2)
    expect(result.tree[0].name).toBe('skills')
    expect(result.tree[0].type).toBe('directory')
    expect(result.tree[0].children).toHaveLength(1)
  })

  it('fetchFileTree contains nested file entries', async () => {
    vi.mocked(fetchFileTree).mockResolvedValue({ tree: mockTree, root: '~/.hermes' })

    const result = await fetchFileTree()
    const skillDir = result.tree[0].children![0]
    expect(skillDir.name).toBe('coding-router')
    const skillFile = skillDir.children![0]
    expect(skillFile.name).toBe('SKILL.md')
    expect(skillFile.type).toBe('file')
    expect(skillFile.size).toBe(4500)
  })

  it('fetchFile returns file content with metadata', async () => {
    vi.mocked(fetchFile).mockResolvedValue(mockFile)

    const result = await fetchFile('skills/coding-router/SKILL.md')
    expect(result.name).toBe('SKILL.md')
    expect(result.content).toContain('# Coding Router')
    expect(result.size).toBe(4500)
    expect(fetchFile).toHaveBeenCalledWith('skills/coding-router/SKILL.md')
  })

  it('FileEntry type has correct shape for directories', () => {
    const dir = mockTree[0]
    expect(dir.type).toBe('directory')
    expect(Array.isArray(dir.children)).toBe(true)
    expect(dir.size).toBeUndefined()
  })

  it('FileEntry type has correct shape for files', () => {
    const file = mockTree[0].children![0].children![0]
    expect(file.type).toBe('file')
    expect(file.size).toBeDefined()
    expect(file.children).toBeUndefined()
  })
})

describe('Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searchMessages returns hits grouped by session', async () => {
    vi.mocked(searchMessages).mockResolvedValue({
      items: mockSearchHits,
      total: 3,
      query: 'bug',
    })

    const result = await searchMessages('bug')
    expect(result.total).toBe(3)
    expect(result.items).toHaveLength(3)
    expect(result.query).toBe('bug')
  })

  it('search hits contain session context', async () => {
    vi.mocked(searchMessages).mockResolvedValue({
      items: mockSearchHits,
      total: 3,
      query: 'bug',
    })

    const result = await searchMessages('bug')
    const hit = result.items[0]
    expect(hit.session_id).toBe('abc-123')
    expect(hit.session_title).toBe('Fix the bug')
    expect(hit.model).toBe('claude-sonnet-4')
    expect(hit.role).toBe('assistant')
    expect(hit.snippet).toContain('<<bug>>')
  })

  it('search hits span multiple sessions', async () => {
    vi.mocked(searchMessages).mockResolvedValue({
      items: mockSearchHits,
      total: 3,
      query: 'bug',
    })

    const result = await searchMessages('bug')
    const sessionIds = new Set(result.items.map((h) => h.session_id))
    expect(sessionIds.size).toBe(2)
  })

  it('searchMessages passes limit and offset', async () => {
    vi.mocked(searchMessages).mockResolvedValue({
      items: [],
      total: 0,
      query: 'test',
    })

    await searchMessages('test', 10, 5)
    expect(searchMessages).toHaveBeenCalledWith('test', 10, 5)
  })

  it('SearchHit type has all required fields', () => {
    const hit = mockSearchHits[0]
    expect(hit).toHaveProperty('session_id')
    expect(hit).toHaveProperty('session_title')
    expect(hit).toHaveProperty('model')
    expect(hit).toHaveProperty('started_at')
    expect(hit).toHaveProperty('message_id')
    expect(hit).toHaveProperty('role')
    expect(hit).toHaveProperty('snippet')
    expect(hit).toHaveProperty('timestamp')
  })
})
