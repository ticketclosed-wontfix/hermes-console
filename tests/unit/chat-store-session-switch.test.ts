// Regression tests for the session-switch-during-streaming bug.
//
// Repro the bug was covering:
// 1. User sends a message in session A -> stream starts, messages go to the
//    single top-level {messages, streaming} fields of the chat store.
// 2. User clicks session B in the sidebar. The route effect fires
//    loadHistory(B), which (in the old code) either early-returned because
//    streaming=true (leaving the UI showing A's content despite the sidebar
//    highlighting B), or wiped A's messages mid-flight.
// 3. User switches back to A. The in-flight stream's tokens are GONE — no
//    live resume.
//
// Fix: the chat store now keeps per-session buckets. Top-level fields mirror
// the bucket for the currently-viewed session only. Background streams in
// other sessions continue to write into their bucket. Switching sessions is
// a pure client-side view swap — no server-side cancellation, no data loss.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

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
    activeSessionId: null,
    messages: [],
    loading: false,
    streaming: false,
    error: null,
    abortController: null,
    sessionBuckets: new Map(),
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

describe('chat store — setActiveSession view swap', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
  })
  afterEach(() => resetStores())

  it('snapshots outgoing top-level state into sessionBuckets on switch away', () => {
    useChatStore.setState({
      activeSessionId: 'A',
      messages: [{ id: 'user-1', role: 'user', content: 'hi', timestamp: 1 }],
      streaming: true,
    })

    useChatStore.getState().setActiveSession('B')

    const { activeSessionId, messages, streaming, sessionBuckets } =
      useChatStore.getState()
    expect(activeSessionId).toBe('B')
    // B had nothing → top-level is empty
    expect(messages).toEqual([])
    expect(streaming).toBe(false)
    // A was snapshotted
    const snapA = sessionBuckets.get('A')
    expect(snapA).toBeDefined()
    expect(snapA!.messages).toHaveLength(1)
    expect(snapA!.streaming).toBe(true)
  })

  it('hydrates top-level from an existing bucket on switch back', () => {
    const buckets = new Map()
    buckets.set('A', {
      messages: [{ id: 'user-1', role: 'user', content: 'hi', timestamp: 1 }],
      loading: false,
      streaming: true,
      error: null,
      abortController: null,
    })
    useChatStore.setState({
      activeSessionId: 'B',
      messages: [],
      streaming: false,
      sessionBuckets: buckets,
    })

    useChatStore.getState().setActiveSession('A')

    const { activeSessionId, messages, streaming, sessionBuckets } =
      useChatStore.getState()
    expect(activeSessionId).toBe('A')
    expect(messages).toHaveLength(1)
    expect(streaming).toBe(true)
    // Bucket was popped — top-level is the source of truth now
    expect(sessionBuckets.has('A')).toBe(false)
  })

  it('switching to null (NEW_SESSION / draft) empties top-level but preserves other buckets', () => {
    useChatStore.setState({
      activeSessionId: 'A',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'mid-stream...',
          timestamp: 1,
          isStreaming: true,
        },
      ],
      streaming: true,
    })

    useChatStore.getState().setActiveSession(null)

    const { activeSessionId, messages, streaming, sessionBuckets } =
      useChatStore.getState()
    expect(activeSessionId).toBeNull()
    expect(messages).toEqual([])
    expect(streaming).toBe(false)
    // A's bucket has the still-streaming state
    expect(sessionBuckets.get('A')?.streaming).toBe(true)
    expect(sessionBuckets.get('A')?.messages).toHaveLength(1)
  })

  it('switch to same id is a no-op (does not clear top-level)', () => {
    useChatStore.setState({
      activeSessionId: 'A',
      messages: [{ id: 'user-1', role: 'user', content: 'hi', timestamp: 1 }],
    })
    useChatStore.getState().setActiveSession('A')
    expect(useChatStore.getState().messages).toHaveLength(1)
  })
})

describe('chat store — session-switch during active stream (THE BUG)', () => {
  beforeEach(() => {
    resetStores()
    vi.clearAllMocks()
  })
  afterEach(() => resetStores())

  it('stream started in A continues writing to A bucket after switching to B, and resumes live on switch back', async () => {
    const streamChatMock = vi.mocked(api.streamChat)
    const fetchMessagesMock = vi.mocked(api.fetchMessages)
    fetchMessagesMock.mockResolvedValue({ items: [], total: 0 })

    // Gated async generator: each yield waits for an external resolver so
    // the test can interleave session-switch actions between chunks.
    const gates: Array<() => void> = []
    const waits: Array<Promise<void>> = []
    for (let i = 0; i < 5; i++) {
      waits.push(
        new Promise<void>((resolve) => {
          gates.push(resolve)
        }),
      )
    }
    function openGate(n: number) {
      gates[n]()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamChatMock.mockImplementation(async function* (): any {
      await waits[0]
      yield { type: 'content', data: { text: 'he' } }
      await waits[1]
      yield { type: 'content', data: { text: 'llo' } }
      await waits[2]
      yield { type: 'content', data: { text: ' world' } }
      await waits[3]
      // done
    })

    // Pretend session A is already active in both stores.
    useSessionsStore.setState({
      sessions: [
        {
          id: 'A',
          source: 'workspace',
          user_id: null,
          model: 'hermes-agent',
          title: null,
          started_at: 1,
          ended_at: null,
          end_reason: null,
          message_count: 0,
          tool_call_count: 0,
          input_tokens: 0,
          output_tokens: 0,
          estimated_cost_usd: null,
        } as any,
      ],
      total: 1,
      activeSessionId: 'A',
    })
    useChatStore.setState({ activeSessionId: 'A' })

    const sendPromise = useChatStore.getState().sendMessage('start', 'A')

    // Let sendMessage push user+assistant messages + start iterating.
    await new Promise((r) => setTimeout(r, 0))

    let state = useChatStore.getState()
    const assistantMsgId = state.messages.find((m) => m.role === 'assistant')!
      .id

    // Release first chunk.
    openGate(0)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    state = useChatStore.getState()
    expect(state.messages.find((m) => m.id === assistantMsgId)?.content).toBe(
      'he',
    )
    expect(state.streaming).toBe(true)

    // *** Switch to B mid-stream. ***
    useChatStore.getState().setActiveSession('B')
    state = useChatStore.getState()
    expect(state.activeSessionId).toBe('B')
    expect(state.messages).toEqual([])
    expect(state.streaming).toBe(false)
    expect(state.sessionBuckets.get('A')?.streaming).toBe(true)

    // Release second chunk while user views B.
    openGate(1)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    state = useChatStore.getState()
    // B view untouched
    expect(state.messages).toEqual([])
    // A's bucket received the new token
    expect(
      state.sessionBuckets
        .get('A')
        ?.messages.find((m) => m.id === assistantMsgId)?.content,
    ).toBe('hello')

    // *** Switch back to A. ***
    useChatStore.getState().setActiveSession('A')
    state = useChatStore.getState()
    expect(state.activeSessionId).toBe('A')
    expect(state.streaming).toBe(true)
    expect(
      state.messages.find((m) => m.id === assistantMsgId)?.content,
    ).toBe('hello')

    // Release third chunk — goes straight to top-level now.
    openGate(2)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    state = useChatStore.getState()
    expect(
      state.messages.find((m) => m.id === assistantMsgId)?.content,
    ).toBe('hello world')

    // Close the stream.
    openGate(3)
    await sendPromise

    state = useChatStore.getState()
    expect(state.streaming).toBe(false)
    expect(
      state.messages.find((m) => m.id === assistantMsgId)?.isStreaming,
    ).toBe(false)
  })

  it('switching to a still-streaming session that has NO bucket yet (just a fresh switch-back) pulls the bucket correctly', () => {
    // Simulate: stream started in A, user switched to B. Bucket for A holds
    // the streaming state. Now user clicks A again.
    const buckets = new Map()
    buckets.set('A', {
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'partial response so far',
          timestamp: 1,
          isStreaming: true,
        },
      ],
      loading: false,
      streaming: true,
      error: null,
      abortController: new AbortController(),
    })
    useChatStore.setState({
      activeSessionId: 'B',
      messages: [],
      streaming: false,
      sessionBuckets: buckets,
    })

    useChatStore.getState().setActiveSession('A')

    const state = useChatStore.getState()
    expect(state.activeSessionId).toBe('A')
    expect(state.streaming).toBe(true)
    expect(state.messages[0].content).toBe('partial response so far')
    // The abortController is preserved — cancelStreaming (Escape) would now
    // affect this stream, but the user had to switch back first.
    expect(state.abortController).not.toBeNull()
  })
})
