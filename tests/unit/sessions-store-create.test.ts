import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the API module — startNew() MUST NOT call any of these
vi.mock('@/lib/api', () => ({
  fetchSessions: vi.fn(),
  searchSessions: vi.fn(),
  createSession: vi.fn(),
}))

import { useSessionsStore } from '@/stores/sessions'
import { useChatStore } from '@/stores/chat'
import { createSession, fetchSessions, searchSessions } from '@/lib/api'

describe('sessions store — startNew() is lazy', () => {
  beforeEach(() => {
    useSessionsStore.setState({
      sessions: [],
      total: 0,
      loading: false,
      error: null,
      activeSessionId: 'old-session-id',
      searchQuery: '',
    })
    useChatStore.setState({
      activeSessionId: 'old-session-id',
      messages: [
        { id: 'old-1', role: 'user', content: 'hi', timestamp: 1 },
      ] as any,
      loading: false,
      streaming: false,
      error: null,
      abortController: null,
      sessionBuckets: new Map(),
    })
    vi.clearAllMocks()
  })

  it('startNew() does NOT call createSession (no server call, no DB row)', () => {
    useSessionsStore.getState().startNew()
    expect(createSession).not.toHaveBeenCalled()
    expect(fetchSessions).not.toHaveBeenCalled()
    expect(searchSessions).not.toHaveBeenCalled()
  })

  it('startNew() clears activeSessionId and the route effect swaps chat view to empty', () => {
    useSessionsStore.getState().startNew()
    expect(useSessionsStore.getState().activeSessionId).toBeNull()
    // startNew() no longer directly clears the chat store — the route
    // effect does, by calling setActiveSession(null) after activeSessionId
    // flips. This preserves background streams in the prev session (their
    // state is snapshotted into a per-session bucket instead of wiped).
    // Simulate the route effect here:
    useChatStore.getState().setActiveSession(null)
    expect(useChatStore.getState().messages).toHaveLength(0)
  })

  it('clicking startNew() 20 times still makes zero API calls', () => {
    for (let i = 0; i < 20; i++) {
      useSessionsStore.getState().startNew()
    }
    expect(createSession).not.toHaveBeenCalled()
  })

  it('ensureActiveSession() returns existing session without creating when active', async () => {
    useSessionsStore.setState({
      sessions: [
        {
          id: 'existing-abc',
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
        } as any,
      ],
      activeSessionId: 'existing-abc',
      total: 1,
    })
    const s = await useSessionsStore.getState().ensureActiveSession()
    expect(createSession).not.toHaveBeenCalled()
    expect(s?.id).toBe('existing-abc')
  })

  it('ensureActiveSession() creates a session when activeSessionId is null', async () => {
    useSessionsStore.setState({ activeSessionId: null })
    vi.mocked(createSession).mockResolvedValue({
      session: {
        id: 'new-xyz',
        source: 'workspace',
        model: 'hermes-agent',
        title: null,
        started_at: 2,
        ended_at: null,
        end_reason: null,
        user_id: null,
        message_count: 0,
        tool_call_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: null,
      },
    } as any)
    const s = await useSessionsStore.getState().ensureActiveSession()
    expect(createSession).toHaveBeenCalledTimes(1)
    expect(s?.id).toBe('new-xyz')
    expect(useSessionsStore.getState().activeSessionId).toBe('new-xyz')
  })
})
