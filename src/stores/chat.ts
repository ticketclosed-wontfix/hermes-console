import { create } from 'zustand'
import type { Message } from '@/lib/api'
import { fetchMessages, streamChat } from '@/lib/api'
import { useSessionsStore } from '@/stores/sessions'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type MessageContent = string | ContentPart[]

type ChatMessage = {
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

type ChatState = {
  messages: ChatMessage[]
  loading: boolean
  streaming: boolean
  error: string | null
  abortController: AbortController | null

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

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  streaming: false,
  error: null,
  abortController: null,

  loadHistory: async (sessionId) => {
    // Guard against the lazy-creation race: when sendMessage() creates a
    // session mid-flight, activeSessionId flips to the new id and the route
    // useEffect re-fires loadHistory(). If we wiped messages here we'd drop
    // the user+assistant msgs we just added. Bail if streaming is active OR
    // if we already hold local (non-persisted) messages.
    const cur = get()
    if (cur.streaming) return
    if (cur.messages.some((m) => !m.id.startsWith('db-'))) return
    set({ loading: true, error: null, messages: [] })
    try {
      const data = await fetchMessages(sessionId)
      // Re-check AFTER the async fetch — sendMessage() may have inserted
      // local messages and/or started streaming while fetchMessages was
      // in flight. If so, do NOT overwrite them.
      const now = get()
      if (
        now.streaming ||
        now.messages.some((m) => !m.id.startsWith('db-'))
      ) {
        set({ loading: false })
        return
      }
      set({ messages: data.items.map(dbMessageToChat), loading: false })
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
        set({ error: 'Failed to create session' })
        return
      }
      resolvedId = session.id
    }
    const effectiveSessionId = resolvedId

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
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      error: null,
      abortController: controller,
    }))

    try {
      for await (const event of streamChat(content, {
        sessionId: effectiveSessionId,
        signal: controller.signal,
      })) {
        if (event.type === 'content') {
          set((s) => ({
            messages: s.messages.map((m) => {
              if (m.id !== assistantMsg.id) return m
              const prev = typeof m.content === 'string' ? m.content : ''
              return { ...m, content: prev + (event.data.text as string) }
            }),
          }))
        } else if (event.type === 'reasoning') {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    reasoning: (m.reasoning || '') + (event.data.text as string),
                  }
                : m,
            ),
          }))
        }
      }

      // Mark streaming complete
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
        ),
        streaming: false,
        abortController: null,
      }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        set({ error: String(err), streaming: false, abortController: null })
      }
    }
  },

  cancelStreaming: () => {
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

  clear: () => set({ messages: [], error: null, streaming: false }),
}))
