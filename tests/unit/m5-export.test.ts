import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  exportSession: vi.fn(),
  forkSession: vi.fn(),
  downloadBlob: vi.fn(),
}))

import {
  exportSession,
  forkSession,
  downloadBlob,
  type Session,
  type Message,
} from '@/lib/api'

const mockSession: Session = {
  id: 'sess-001',
  source: 'cli',
  user_id: null,
  model: 'claude-sonnet-4',
  title: 'Test Session',
  started_at: 1713100000,
  ended_at: 1713103600,
  end_reason: 'completed',
  message_count: 5,
  tool_call_count: 2,
  input_tokens: 1000,
  output_tokens: 2000,
  estimated_cost_usd: 0.05,
}

const mockMessages: Message[] = [
  {
    id: 1,
    session_id: 'sess-001',
    role: 'user',
    content: 'Hello, help me fix a bug',
    tool_call_id: null,
    tool_calls: null,
    tool_name: null,
    timestamp: 1713100100,
    token_count: 10,
    finish_reason: null,
    reasoning: null,
  },
  {
    id: 2,
    session_id: 'sess-001',
    role: 'assistant',
    content: 'Sure, let me look at the code.',
    tool_call_id: null,
    tool_calls: '[{"name":"read_file","args":{"path":"src/main.ts"}}]',
    tool_name: null,
    timestamp: 1713100200,
    token_count: 50,
    finish_reason: 'stop',
    reasoning: null,
  },
  {
    id: 3,
    session_id: 'sess-001',
    role: 'tool',
    content: 'const x = 1;',
    tool_call_id: 'call_abc',
    tool_calls: null,
    tool_name: 'read_file',
    timestamp: 1713100300,
    token_count: 5,
    finish_reason: null,
    reasoning: null,
  },
]

describe('exportSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls export endpoint with markdown format', async () => {
    const mockBlob = new Blob(['# Test Session'], { type: 'text/markdown' })
    vi.mocked(exportSession).mockResolvedValue(mockBlob)

    const result = await exportSession('sess-001', 'markdown')
    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('text/markdown')
    expect(exportSession).toHaveBeenCalledWith('sess-001', 'markdown')
  })

  it('calls export endpoint with json format', async () => {
    const mockBlob = new Blob([JSON.stringify({ session: mockSession, messages: mockMessages })], {
      type: 'application/json',
    })
    vi.mocked(exportSession).mockResolvedValue(mockBlob)

    const result = await exportSession('sess-001', 'json')
    expect(result).toBeInstanceOf(Blob)

    const text = await result.text()
    const parsed = JSON.parse(text)
    expect(parsed.session.id).toBe('sess-001')
    expect(parsed.messages).toHaveLength(3)
  })

  it('throws on failed export', async () => {
    vi.mocked(exportSession).mockRejectedValue(new Error('Export failed: 404'))

    await expect(exportSession('nonexistent', 'json')).rejects.toThrow('Export failed: 404')
  })
})

describe('forkSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns messages and source session', async () => {
    vi.mocked(forkSession).mockResolvedValue({
      messages: mockMessages,
      source_session: mockSession,
    })

    const result = await forkSession('sess-001')
    expect(result.source_session.id).toBe('sess-001')
    expect(result.source_session.title).toBe('Test Session')
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0].role).toBe('user')
    expect(result.messages[1].role).toBe('assistant')
    expect(result.messages[2].role).toBe('tool')
  })

  it('preserves message order', async () => {
    vi.mocked(forkSession).mockResolvedValue({
      messages: mockMessages,
      source_session: mockSession,
    })

    const result = await forkSession('sess-001')
    for (let i = 1; i < result.messages.length; i++) {
      expect(result.messages[i].timestamp).toBeGreaterThan(result.messages[i - 1].timestamp)
    }
  })

  it('includes tool call metadata', async () => {
    vi.mocked(forkSession).mockResolvedValue({
      messages: mockMessages,
      source_session: mockSession,
    })

    const result = await forkSession('sess-001')
    const toolMsg = result.messages.find((m) => m.role === 'tool')
    expect(toolMsg?.tool_name).toBe('read_file')
    expect(toolMsg?.tool_call_id).toBe('call_abc')
  })
})

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is callable with blob and filename', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' })
    // downloadBlob is mocked, just verify it can be called
    downloadBlob(blob, 'test.txt')
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'test.txt')
  })

  it('accepts markdown blob with .md filename', () => {
    const blob = new Blob(['# Title'], { type: 'text/markdown' })
    downloadBlob(blob, 'session-abc.md')
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'session-abc.md')
  })

  it('accepts json blob with .json filename', () => {
    const blob = new Blob(['{}'], { type: 'application/json' })
    downloadBlob(blob, 'session-abc.json')
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'session-abc.json')
  })
})
