import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub streamChat as a real async generator + record calls/args
const streamChatCalls: any[] = []

vi.mock('@/lib/api', () => ({
  fetchSessions: vi.fn(),
  searchSessions: vi.fn(),
  createSession: vi.fn(),
  fetchMessages: vi.fn(),
  streamChat: vi.fn(async function* (content: any, opts: any) {
    streamChatCalls.push({ content, opts })
    yield { type: 'content', data: { text: 'ok' } }
  }),
}))

import { useSessionsStore } from '@/stores/sessions'
import { useChatStore } from '@/stores/chat'
import { createSession, streamChat } from '@/lib/api'

const newSession = {
  id: 'sess-NEW',
  source: 'workspace',
  model: 'hermes-agent',
  title: null,
  started_at: 1,
  ended_at: null,
  end_reason: null,
  user_id: null,
  message_count: 0,
  tool_call_count: 0,
  input_tokens: 0,
  output_tokens: 0,
  estimated_cost_usd: null,
}

describe('chat store — sendMessage ensures an active session lazily', () => {
  beforeEach(() => {
    streamChatCalls.length = 0
    useSessionsStore.setState({
      sessions: [],
      total: 0,
      loading: false,
      error: null,
      activeSessionId: null,
      searchQuery: '',
    })
    useChatStore.setState({
      messages: [],
      loading: false,
      streaming: false,
      error: null,
      abortController: null,
    })
    vi.clearAllMocks()
  })

  it('creates a new session via createSession() when activeSessionId is null', async () => {
    vi.mocked(createSession).mockResolvedValue({ session: newSession } as any)

    await useChatStore.getState().sendMessage('ping', null)

    expect(createSession).toHaveBeenCalledTimes(1)
    expect(streamChat).toHaveBeenCalledTimes(1)
    expect(streamChatCalls[0].opts.sessionId).toBe('sess-NEW')
    expect(useSessionsStore.getState().activeSessionId).toBe('sess-NEW')
  })

  it('does NOT create a session when one is already active', async () => {
    useSessionsStore.setState({
      sessions: [newSession as any],
      activeSessionId: 'sess-NEW',
    })

    await useChatStore.getState().sendMessage('ping', 'sess-NEW')

    expect(createSession).not.toHaveBeenCalled()
    expect(streamChatCalls[0].opts.sessionId).toBe('sess-NEW')
  })

  it('omitting sessionId triggers lazy creation (calls createSession exactly once)', async () => {
    vi.mocked(createSession).mockResolvedValue({ session: newSession } as any)
    await useChatStore.getState().sendMessage('ping')
    expect(createSession).toHaveBeenCalledTimes(1)
  })
})

describe('chat store — attachments flow', () => {
  beforeEach(() => {
    streamChatCalls.length = 0
    useSessionsStore.setState({
      sessions: [newSession as any],
      activeSessionId: 'sess-NEW',
      total: 1,
      loading: false,
      error: null,
      searchQuery: '',
    })
    useChatStore.setState({
      messages: [],
      loading: false,
      streaming: false,
      error: null,
      abortController: null,
    })
    vi.clearAllMocks()
  })

  it('passes a multipart OpenAI-style content array through to streamChat', async () => {
    const parts = [
      { type: 'text' as const, text: 'look at this' },
      {
        type: 'image_url' as const,
        image_url: { url: 'data:image/png;base64,AAAA' },
      },
    ]
    await useChatStore.getState().sendMessage(parts, 'sess-NEW')

    expect(streamChatCalls[0].content).toEqual(parts)
    expect(Array.isArray(streamChatCalls[0].content)).toBe(true)
    const userMsg = useChatStore
      .getState()
      .messages.find((m) => m.role === 'user')
    expect(Array.isArray(userMsg?.content)).toBe(true)
  })
})
