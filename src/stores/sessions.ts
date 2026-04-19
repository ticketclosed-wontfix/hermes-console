import { create } from 'zustand'
import type { Session, SessionKind } from '@/lib/api'
import { fetchSessions, searchSessions, createSession, deleteSession } from '@/lib/api'

type SessionsState = {
  sessions: Session[]
  total: number
  loading: boolean
  error: string | null
  activeSessionId: string | null
  searchQuery: string
  // Which sidebar tab is active — filters the list without hitting a
  // different endpoint.  Default "chats" so existing behaviour is
  // preserved on first load (cron/webhook noise stays out of the
  // primary view).
  activeKind: SessionKind

  load: () => Promise<void>
  search: (query: string) => Promise<void>
  setActive: (id: string | null) => void
  setKind: (kind: SessionKind) => Promise<void>
  clearSearch: () => void

  // Lazy: clears UI state only. No server call.
  startNew: () => void

  // Ensures there's a real persisted session id, creating one only if necessary.
  // Called by chat store right before sending the first message.
  ensureActiveSession: (opts?: { model?: string }) => Promise<Session | null>

  // Delete a session and its messages from the server, then remove from local state.
  deleteSession: (id: string) => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  total: 0,
  loading: false,
  error: null,
  activeSessionId: null,
  searchQuery: '',
  activeKind: 'chats',

  load: async () => {
    set({ loading: true, error: null })
    try {
      const { activeKind, searchQuery } = get()
      const data = searchQuery.trim()
        ? await searchSessions(searchQuery, 100, activeKind)
        : await fetchSessions(100, 0, activeKind)
      set({ sessions: data.items, total: data.total, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query, loading: true })
    try {
      const { activeKind } = get()
      if (!query.trim()) {
        return get().load()
      }
      const data = await searchSessions(query, 20, activeKind)
      set({ sessions: data.items, total: data.total, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  setActive: (id) => set({ activeSessionId: id }),

  setKind: async (kind) => {
    if (get().activeKind === kind) return
    set({ activeKind: kind })
    return get().load()
  },

  clearSearch: () => {
    set({ searchQuery: '' })
    get().load()
  },

  // Lazy new-session: no DB row, no network call. The chat pane will show the
  // empty state and the first sendMessage() will create the row via
  // ensureActiveSession().
  //
  // NOTE: we deliberately do NOT clear the chat store's messages here. If a
  // background stream is still running in the previous session, the chat
  // store's setActiveSession(null) (fired by the route effect on
  // activeSessionId change) will snapshot the outgoing session into a
  // per-session bucket so the stream can keep landing there. Calling clear()
  // here would destroy that bucket's contents.
  startNew: () => {
    set({ activeSessionId: null, error: null })
  },

  ensureActiveSession: async (opts = {}) => {
    const { activeSessionId, sessions } = get()
    if (activeSessionId) {
      const existing = sessions.find((s) => s.id === activeSessionId)
      if (existing) return existing
    }
    try {
      const { session } = await createSession({
        source: 'workspace',
        model: opts.model || 'hermes-agent',
      })
      set((s) => ({
        sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
        total: s.total + 1,
        activeSessionId: session.id,
      }))
      return session
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },

  deleteSession: async (id: string) => {
    try {
      await deleteSession(id)
      set((s) => ({
        sessions: s.sessions.filter((x) => x.id !== id),
        total: Math.max(0, s.total - 1),
        activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      }))
    } catch (err) {
      set({ error: String(err) })
    }
  },
}))
