// Regression tests for the chat store race condition that caused sent
// messages to disappear from the UI without ever showing a response.
//
// Repro:
// 1. No active session.
// 2. User types + clicks Send.
// 3. sendMessage() calls ensureActiveSession() -> creates session row,
//    setActive(new id) flips activeSessionId.
// 4. The /route/index.tsx useEffect watching activeSessionId fires and
//    calls loadHistory(new_id), which prior to this fix did
//    `set({ messages: [] })` — wiping the user+assistant messages that
//    sendMessage() had just added before the stream started.
// 5. The stream then lands with no assistantMsg in the array to target,
//    so nothing renders. UI: stays empty, silent failure.
//
// Fix: loadHistory() bails when streaming is in progress OR when the
// store already holds local (non-persisted, id !startsWith 'db-')
// messages for the current session.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock the API before importing the store.
vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(async () => ({ items: [], total: 0 })),
  streamChat: vi.fn(),
  fetchSessions: vi.fn(async () => ({ items: [], total: 0 })),
  searchSessions: vi.fn(async () => ({ items: [], total: 0 })),
  createSession: vi.fn(async (input: { source: string; model: string }) => ({
    session: {
      id: 'new-sess-id',
      source: input.source,
      user_id: null,
      model: input.model,
      title: null,
      started_at: Math.floor(Date.now() / 1000),
      ended_at: null,
      end_reason: null,
      message_count: 0,
      tool_call_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: null,
    },
  })),
}))

import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'
import * as api from '@/lib/api'

function resetStores() {
  useChatStore.setState({
    messages: [],
    loading: false,
    streaming: false,
    error: null,
    abortController: null,
  })
  useSessionsStore.setState({
    sessions: [],
    total: 0,
    loading: false,
    error: null,
    activeSessionId: null,
    searchQuery: '',
  })
}

describe('chat store race condition (loadHistory vs sendMessage)', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetStores()
  })

  it('loadHistory bails when streaming is in progress', async () => {
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    fetchMessagesMock.mockResolvedValue({ items: [], total: 0 })

    // Simulate an in-flight stream with a user+assistant message.
    useChatStore.setState({
      streaming: true,
      messages: [
        {
          id: 'user-123',
          role: 'user',
          content: 'hello',
          timestamp: Date.now(),
        },
        {
          id: 'assistant-123',
          role: 'assistant',
          content: 'pa',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ],
    })

    await useChatStore.getState().loadHistory('any-session')

    const { messages, streaming } = useChatStore.getState()
    expect(streaming).toBe(true)
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('hello')
    expect(messages[1].content).toBe('pa')
    expect(fetchMessagesMock).not.toHaveBeenCalled()
  })

  it('loadHistory bails when store already holds local (non-persisted) messages', async () => {
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    fetchMessagesMock.mockResolvedValue({ items: [], total: 0 })

    // Not streaming yet, but local messages are already queued
    // (as happens the moment sendMessage() optimistically inserts them
    // before entering the await on streamChat()).
    useChatStore.setState({
      streaming: false,
      messages: [
        {
          id: 'user-abc',
          role: 'user',
          content: 'queued',
          timestamp: Date.now(),
        },
      ],
    })

    await useChatStore.getState().loadHistory('any-session')

    const { messages } = useChatStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('user-abc')
    expect(fetchMessagesMock).not.toHaveBeenCalled()
  })

  it('loadHistory proceeds when only db-prefixed (persisted) messages exist', async () => {
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    fetchMessagesMock.mockResolvedValue({
      items: [
        {
          id: 7,
          session_id: 's-1',
          role: 'user',
          content: 'from db',
          tool_call_id: null,
          tool_calls: null,
          tool_name: null,
          timestamp: Math.floor(Date.now() / 1000),
          token_count: null,
          finish_reason: null,
          reasoning: null,
        },
      ],
      total: 1,
    })

    useChatStore.setState({
      streaming: false,
      messages: [
        {
          id: 'db-99',
          role: 'user',
          content: 'old persisted',
          timestamp: Date.now(),
        },
      ],
    })

    await useChatStore.getState().loadHistory('s-1')

    expect(fetchMessagesMock).toHaveBeenCalledWith('s-1')
    const { messages } = useChatStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('from db')
    expect(messages[0].id).toBe('db-7')
  })

  it('loadHistory bails AFTER async fetchMessages if sendMessage inserted messages mid-flight', async () => {
    // Real-world scenario: user clicks NEW_SESSION (activeSessionId=null,
    // messages=[]), types, clicks Send. sendMessage() calls
    // ensureActiveSession() which sets activeSessionId. React re-renders,
    // route useEffect fires loadHistory(new_id). fetchMessages() takes
    // network time. In that window, sendMessage() finishes creating the
    // session and inserts user+assistant messages + starts streaming.
    // Naive loadHistory() would then set({messages: []}) (empty fetched
    // result) and wipe everything.
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    let resolveFetch: (v: { items: any[]; total: number }) => void = () => {}
    fetchMessagesMock.mockImplementation(
      () =>
        new Promise((r) => {
          resolveFetch = r
        })
    )

    // Start loadHistory (fetch will hang).
    const histPromise = useChatStore.getState().loadHistory('new-sess')

    // While it hangs, simulate sendMessage inserting messages + starting stream.
    await new Promise((r) => setTimeout(r, 0))
    useChatStore.setState({
      streaming: true,
      messages: [
        {
          id: 'user-xxx',
          role: 'user',
          content: 'mid-race',
          timestamp: Date.now(),
        },
        {
          id: 'assistant-xxx',
          role: 'assistant',
          content: 'pa',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ],
    })

    // Now let the fetch resolve with an empty result (new session, no
    // persisted messages yet).
    resolveFetch({ items: [], total: 0 })
    await histPromise

    const { messages, streaming, loading } = useChatStore.getState()
    expect(streaming).toBe(true)
    expect(loading).toBe(false)
    // User + assistant messages must have survived.
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('mid-race')
    expect(messages[1].content).toBe('pa')
  })

  it('FULL RACE SCENARIO: sendMessage with no active session -> ensureActiveSession -> route useEffect loadHistory -> stream completes, messages survive', async () => {
    // This is the scenario the user reported: click NEW_SESSION, type,
    // send, and nothing appears.
    const streamChatMock = vi.mocked(api.streamChat)
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    fetchMessagesMock.mockResolvedValue({ items: [], total: 0 })

    // Fake SSE stream that yields content chunks.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamChatMock.mockImplementation(async function* (): any {
      yield { type: 'content', data: { text: 'po' } }
      yield { type: 'content', data: { text: 'ng' } }
    })

    const chat = useChatStore.getState()

    // Kick off sendMessage() with no sessionId.
    const sendPromise = chat.sendMessage('hello')

    // While the stream is in-flight, simulate the route useEffect firing
    // loadHistory() because activeSessionId just changed.
    //
    // The race window is extremely short: ensureActiveSession awaits the
    // POST /api/sessions, THEN setState for sessions is applied (which
    // zustand notifies subscribers of synchronously), THEN the store
    // returns and the user/assistant messages are pushed. Our guard must
    // work whether loadHistory fires before OR after the push.
    //
    // We fire it AFTER a microtask to approximate the real timing.
    await new Promise((r) => setTimeout(r, 0))
    const newId = useSessionsStore.getState().activeSessionId
    if (newId) {
      // Don't await -- simulate react effect firing concurrently.
      useChatStore.getState().loadHistory(newId)
    }

    await sendPromise

    const { messages, streaming } = useChatStore.getState()
    expect(streaming).toBe(false)
    // Exactly 2 messages survive: the user msg and the fully-streamed
    // assistant msg with content "pong".
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('hello')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('pong')

    // And fetchMessages was skipped either way (either streaming blocked
    // it, or the local user msg blocked it, or activeSessionId wasn't set
    // at the time of the call).
    //
    // We don't strictly assert call count here because the timing is
    // genuinely nondeterministic; we just assert the end state is correct.
  })
})
