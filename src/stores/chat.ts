import { create } from 'zustand'
import type { Message } from '@/lib/api'
import { fetchMessages, streamChat } from '@/lib/api'
import { useSessionsStore } from '@/stores/sessions'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type MessageContent = string | ContentPart[]

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: MessageContent
  timestamp: number
  toolCalls?: string | null
  toolCallId?: string | null
  toolName?: string | null
  reasoning?: string | null
  isStreaming?: boolean
}

// Per-session chat slice. Every session the user has *touched this tab-life*
// has one of these. The currently-viewed session's slice is also mirrored to
// the top level of the store so existing components (ChatThread, ChatInput,
// useChat) can keep reading `state.messages` / `state.streaming` unchanged.
export type SessionChatState = {
  messages: ChatMessage[]
  loading: boolean
  streaming: boolean
  error: string | null
  abortController: AbortController | null
}

function emptyBucket(): SessionChatState {
  return {
    messages: [],
    loading: false,
    streaming: false,
    error: null,
    abortController: null,
  }
}

type ChatState = SessionChatState & {
  // Currently-viewed session id. The top-level fields above mirror the
  // bucket for this id. Set by the route useEffect on session change.
  // `null` means "draft / New Session" (no DB row yet).
  activeSessionId: string | null

  // Per-session state for sessions the user is NOT currently viewing but
  // which still have live background streams (or held history). A session
  // only appears here after the user switches AWAY from it while it had
  // non-empty state. Switching BACK pulls the bucket back to top level.
  sessionBuckets: Map<string, SessionChatState>

  // View switch. Snapshots the current top-level into sessionBuckets for
  // the previous activeSessionId, then hydrates top-level from the target
  // bucket (or empties it). Does NOT cancel any background stream — those
  // continue writing into their bucket via writeToSession().
  setActiveSession: (id: string | null) => void

  loadHistory: (sessionId: string) => Promise<void>
  // sessionId is optional. If missing or null, a new session is created lazily
  // via sessions store's ensureActiveSession() — this is where the DB row first
  // appears. Clicking NEW_SESSION 20 times does NOT create 20 rows.
  sendMessage: (content: MessageContent, sessionId?: string | null) => Promise<void>
  cancelStreaming: () => void
  clear: () => void
}

function dbMessageToChat(m: Message): ChatMessage {
  return {
    id: `db-${m.id}`,
    role: m.role as ChatMessage['role'],
    content: m.content || '',
    timestamp: m.timestamp * 1000,
    toolCalls: m.tool_calls,
    toolCallId: m.tool_call_id,
    toolName: m.tool_name,
    reasoning: m.reasoning,
  }
}

// --------------------------------------------------------------------------
// Tool-name enrichment
//
// The hermes-agent gateway persists role='tool' rows with an empty/NULL
// `tool_name` column — 100% of rows across every source as of 2026-04-19.
// That's an upstream gateway bug; Nick's not fixing it there. Per-tool
// renderers in ToolCallBlock dispatch on toolName, so with empty names
// every tool result falls through to JsonFallback (raw JSON).
//
// Workaround: derive toolName on tool rows from the preceding assistant
// row's `toolCalls` JSON. Matches by tool_call_id first; falls back to
// positional match (Nth tool row under an assistant matches Nth entry in
// its tool_calls array). Render-time only — DB is untouched.
//
// TWO assistant toolCalls shapes exist in the wild:
//
//  A. Flat shape (produced by the live stream tool_started handler and by
//     some legacy gateway paths):
//       [{"id":"call_abc","name":"terminal","arguments":"{...}"}]
//
//  B. OpenAI-function shape (what the hermes gateway actually persists
//     to state.db as of 2026-04-19):
//       [{"id":"toolu_...", "type":"function",
//         "function":{"name":"terminal","arguments":"{...}"}}]
//
// parseToolCalls() flattens both into ParsedToolCall.
//
// Safe to call multiple times: already-populated toolName is preserved.
// --------------------------------------------------------------------------
type ParsedToolCall = { id?: string | null; name?: string | null }

function parseToolCalls(raw: string | null | undefined): ParsedToolCall[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: ParsedToolCall[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      const id =
        (typeof e.id === 'string' && e.id) ||
        (typeof e.call_id === 'string' && (e.call_id as string)) ||
        null
      // Flat shape: {name}. OpenAI-function shape: {function:{name}}.
      let name: string | null = null
      if (typeof e.name === 'string' && e.name) name = e.name
      else if (
        e.function &&
        typeof e.function === 'object' &&
        typeof (e.function as Record<string, unknown>).name === 'string'
      ) {
        name = (e.function as Record<string, string>).name
      }
      out.push({ id, name })
    }
    return out
  } catch {
    return []
  }
}

export function enrichToolNames(messages: ChatMessage[]): ChatMessage[] {
  // First pass: build id -> name map from every assistant row's tool_calls.
  const nameById = new Map<string, string>()
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.toolCalls) continue
    for (const tc of parseToolCalls(m.toolCalls)) {
      if (tc?.id && typeof tc.name === 'string' && tc.name) {
        nameById.set(tc.id, tc.name)
      }
    }
  }

  // Second pass: walk messages in order. Track the most recent assistant
  // tool_calls list and a counter of how many tool rows have been attributed
  // to it — for positional fallback when ids aren't available.
  let currentCalls: ParsedToolCall[] = []
  let toolCursor = 0
  let didChange = false
  const out = messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls) {
      currentCalls = parseToolCalls(m.toolCalls)
      toolCursor = 0
      return m
    }
    if (m.role !== 'tool') return m
    if (m.toolName) {
      // Already populated (live-streamed synthetic rows, or a future day
      // when the gateway is fixed) — advance the positional cursor anyway
      // so later siblings still line up.
      toolCursor += 1
      return m
    }
    let derived: string | null = null
    if (m.toolCallId && nameById.has(m.toolCallId)) {
      derived = nameById.get(m.toolCallId) ?? null
    } else if (currentCalls.length > 0 && toolCursor < currentCalls.length) {
      const candidate = currentCalls[toolCursor]
      if (candidate && typeof candidate.name === 'string') {
        derived = candidate.name
      }
    }
    toolCursor += 1
    if (!derived) return m
    didChange = true
    return { ...m, toolName: derived }
  })
  return didChange ? out : messages
}

export const useChatStore = create<ChatState>((set, get) => {
  // ---------------------------------------------------------------------
  // Bucket routing: a stream for a given turn writes into the active view
  // (top-level) if its session is still being viewed; otherwise it writes
  // into sessionBuckets[sessionId] so the server-side stream can keep
  // flowing without touching what the user currently sees. Switching back
  // rehydrates the bucket to the top level.
  // ---------------------------------------------------------------------
  function writeToSession(
    sessionId: string | null,
    updater: (s: SessionChatState) => Partial<SessionChatState>,
  ) {
    set((state) => {
      const isActive = state.activeSessionId === sessionId
      if (isActive) {
        // Mutating the active view — also mirror into sessionBuckets so
        // the snapshot stays fresh for any future switch-away.
        const cur: SessionChatState = {
          messages: state.messages,
          loading: state.loading,
          streaming: state.streaming,
          error: state.error,
          abortController: state.abortController,
        }
        const patch = updater(cur)
        return patch as Partial<ChatState>
      }
      // Stream for a session the user is no longer viewing — update its
      // bucket without touching the top level at all.
      if (sessionId == null) {
        // Writing to the "draft / null" bucket while viewing something
        // else: this happens when a turn kicked off before ensureActiveSession
        // resolved the id. Extremely narrow window — treat as active since
        // by the time the stream lands, activeSessionId should match.
        return {}
      }
      const nextBuckets = new Map(state.sessionBuckets)
      const existing = nextBuckets.get(sessionId) ?? emptyBucket()
      const patch = updater(existing)
      nextBuckets.set(sessionId, { ...existing, ...patch })
      return { sessionBuckets: nextBuckets }
    })
  }

  return {
    // Top-level mirror of the active bucket.
    messages: [],
    loading: false,
    streaming: false,
    error: null,
    abortController: null,

    activeSessionId: null,
    sessionBuckets: new Map<string, SessionChatState>(),

    setActiveSession: (id) => {
      const state = get()
      if (state.activeSessionId === id) return

      // Snapshot the outgoing session's top-level view into its bucket.
      const prevId = state.activeSessionId
      const outgoing: SessionChatState = {
        messages: state.messages,
        loading: state.loading,
        streaming: state.streaming,
        error: state.error,
        abortController: state.abortController,
      }

      const nextBuckets = new Map(state.sessionBuckets)

      // Only persist buckets that are worth persisting: either currently
      // streaming, or holding messages. Empty/idle top-level state doesn't
      // need a bucket — lets sessions that were never touched stay out of
      // the map entirely.
      if (prevId != null) {
        if (outgoing.streaming || outgoing.messages.length > 0) {
          nextBuckets.set(prevId, outgoing)
        } else {
          nextBuckets.delete(prevId)
        }
      }

      // Hydrate from the incoming bucket (if any).
      const incoming =
        id != null ? nextBuckets.get(id) ?? null : null
      // Pop the bucket now that it's becoming the active view — avoids
      // accidental double-writes (top-level + bucket).
      if (id != null && incoming) {
        nextBuckets.delete(id)
      }

      const projection: SessionChatState = incoming ?? emptyBucket()

      set({
        activeSessionId: id,
        sessionBuckets: nextBuckets,
        ...projection,
      })
    },

    loadHistory: async (sessionId) => {
      // Guard against the lazy-creation race: when sendMessage() creates a
      // session mid-flight, activeSessionId flips to the new id and the route
      // useEffect re-fires loadHistory(). If we wiped messages here we'd drop
      // the user+assistant msgs we just added. Bail if streaming is active OR
      // if we already hold local (non-persisted) messages.
      //
      // NOTE: guards operate on the CURRENT top-level view. If the incoming
      // sessionId doesn't match the active view (caller raced), bail —
      // setActiveSession is responsible for swapping state, not loadHistory.
      const cur = get()
      if (cur.activeSessionId != null && cur.activeSessionId !== sessionId) {
        return
      }
      if (cur.streaming) return
      if (cur.messages.some((m) => !m.id.startsWith('db-'))) return
      set({ loading: true, error: null, messages: [] })
      try {
        const data = await fetchMessages(sessionId)
        // Re-check AFTER the async fetch — sendMessage() may have inserted
        // local messages and/or started streaming while fetchMessages was
        // in flight. If so, do NOT overwrite them. Also bail if the user
        // switched away mid-fetch.
        const now = get()
        if (now.activeSessionId != null && now.activeSessionId !== sessionId) {
          set({ loading: false })
          return
        }
        if (
          now.streaming ||
          now.messages.some((m) => !m.id.startsWith('db-'))
        ) {
          set({ loading: false })
          return
        }
        set({ messages: enrichToolNames(data.items.map(dbMessageToChat)), loading: false })
      } catch (err) {
        set({ error: String(err), loading: false })
      }
    },

    sendMessage: async (content, sessionId) => {
      // Lazy session resolution: if no sessionId was passed, ask the sessions
      // store to ensure/create one NOW. This is the only path that creates a
      // workspace session row.
      let resolvedId: string | null = sessionId ?? null
      if (!resolvedId) {
        const session = await useSessionsStore
          .getState()
          .ensureActiveSession()
        if (!session) {
          // Error lives on the currently-viewed session (the draft view).
          writeToSession(get().activeSessionId, () => ({
            error: 'Failed to create session',
          }))
          return
        }
        resolvedId = session.id
      }
      const turnSessionId = resolvedId

      // If chat store doesn't yet know about this session as active and the
      // user is currently viewing "draft" (null), adopt it as active so the
      // first tokens land in the visible top-level view — not a bucket.
      const initialState = get()
      if (
        initialState.activeSessionId == null &&
        useSessionsStore.getState().activeSessionId === turnSessionId
      ) {
        // The sessions store has already set activeSessionId to the new id
        // (ensureActiveSession did this). Pull chat's view into sync now so
        // the user sees the stream. No snapshot needed: the outgoing view
        // is the empty draft, which we discard.
        set({ activeSessionId: turnSessionId })
      }

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }

      const controller = new AbortController()
      writeToSession(turnSessionId, (cur) => ({
        messages: [...cur.messages, userMsg, assistantMsg],
        streaming: true,
        error: null,
        abortController: controller,
      }))

      try {
        for await (const event of streamChat(content, {
          sessionId: turnSessionId,
          signal: controller.signal,
        })) {
          if (event.type === 'content') {
            writeToSession(turnSessionId, (cur) => ({
              messages: cur.messages.map((m) => {
                if (m.id !== assistantMsg.id) return m
                const prev = typeof m.content === 'string' ? m.content : ''
                return { ...m, content: prev + (event.data.text as string) }
              }),
            }))
          } else if (event.type === 'reasoning') {
            writeToSession(turnSessionId, (cur) => ({
              messages: cur.messages.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      reasoning: (m.reasoning || '') + (event.data.text as string),
                    }
                  : m,
              ),
            }))
          } else if (event.type === 'tool_started') {
            // Live tool call card. Mirror the DB render shape:
            //   assistant row with toolCalls JSON populated (no content)
            //   (tool result row is inserted by tool_completed, or backfilled
            //    from DB after streaming completes — see finally block)
            const toolName = (event.data.tool_name as string | null) || 'tool'
            const preview = (event.data.preview as string | null) || ''
            const args = event.data.args as Record<string, unknown> | null
            const callId =
              (event.data.call_id as string | null) ||
              `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            // ToolCallBlock parses toolCalls as JSON array of {name, arguments}
            // where arguments is itself a JSON string.
            const argsJson = JSON.stringify(args ?? (preview ? { preview } : {}))
            const toolCallsJson = JSON.stringify([
              { name: toolName, arguments: argsJson },
            ])
            const toolCallMsgId = `local-toolcall-${callId}`
            writeToSession(turnSessionId, (cur) => {
              // Insert the assistant-tool-call row BEFORE the currently streaming
              // assistant placeholder so the thread renders in natural order:
              //   user → [toolcall row]+ → assistant final
              const idx = cur.messages.findIndex((m) => m.id === assistantMsg.id)
              if (idx < 0) return {}
              // Dedupe — if we already inserted this call id, skip.
              if (cur.messages.some((m) => m.id === toolCallMsgId)) return {}
              const row: ChatMessage = {
                id: toolCallMsgId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                toolCalls: toolCallsJson,
                toolCallId: callId,
                toolName,
              }
              const next = [...cur.messages]
              next.splice(idx, 0, row)
              return { messages: next }
            })
          } else if (event.type === 'tool_completed') {
            // The /v1/chat/completions endpoint does NOT currently stream
            // tool.completed, but /v1/runs does. Handle it if it arrives.
            // Real tool output (role='tool' with full content) is backfilled
            // from state.db in the finally block — this just flips status.
            const toolName = (event.data.tool_name as string | null) || 'tool'
            const callId = (event.data.call_id as string | null) || null
            const resultRaw = event.data.result
            const resultText =
              typeof resultRaw === 'string'
                ? resultRaw
                : resultRaw != null
                  ? JSON.stringify(resultRaw)
                  : `(completed${event.data.duration ? ` in ${event.data.duration}s` : ''})`
            const toolResultMsgId = `local-toolresult-${callId || `${toolName}-${Date.now()}`}`
            writeToSession(turnSessionId, (cur) => {
              if (cur.messages.some((m) => m.id === toolResultMsgId)) return {}
              const idx = cur.messages.findIndex((m) => m.id === assistantMsg.id)
              const row: ChatMessage = {
                id: toolResultMsgId,
                role: 'tool',
                content: resultText,
                timestamp: Date.now(),
                toolCallId: callId,
                toolName,
              }
              const next = [...cur.messages]
              if (idx < 0) next.push(row)
              else next.splice(idx, 0, row)
              return { messages: next }
            })
          }
        }

        // Mark streaming complete
        writeToSession(turnSessionId, (cur) => ({
          messages: cur.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
          ),
          streaming: false,
          abortController: null,
        }))

        // Backfill from DB: the /v1/chat/completions endpoint does not stream
        // tool result content (only tool.started progress markers), and the
        // placeholder tool rows we inserted live have synthetic arguments.
        // Replace local turn with authoritative DB state now that streaming
        // is done. Guards in loadHistory() prevented this during streaming.
        try {
          const data = await fetchMessages(turnSessionId)
          // Sanity check: only replace if DB actually has this turn persisted.
          // (If persistence lags, keep our local messages.)
          if (data.items.length > 0) {
            writeToSession(turnSessionId, () => ({
              messages: enrichToolNames(data.items.map(dbMessageToChat)),
            }))
          }
        } catch {
          // DB backfill is a best-effort enhancement; keep local state on error.
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          writeToSession(turnSessionId, () => ({
            error: String(err),
            streaming: false,
            abortController: null,
          }))
        }
      }
    },

    cancelStreaming: () => {
      // Only cancels the CURRENTLY-VIEWED session's stream. Background
      // streams in other sessions remain untouched. This matches the
      // Escape-key UX (cancel what I'm looking at) and the Stop button
      // in ChatInput (which is rendered only for the active view).
      const { abortController } = get()
      abortController?.abort()
      set((s) => ({
        streaming: false,
        abortController: null,
        messages: s.messages.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m,
        ),
      }))
    },

    clear: () => {
      // Clears the currently-viewed session's view. Background streams in
      // other sessions remain untouched — their buckets stay intact. This
      // is what NEW_SESSION / Ctrl+N should do: reset the draft view to
      // empty without killing anything running elsewhere.
      set({ messages: [], error: null, streaming: false, abortController: null })
    },
  }
})
