import { create } from 'zustand'
import type { Session } from '@/lib/api'
import { fetchSessions, searchSessions, createSession } from '@/lib/api'
import { useChatStore } from '@/stores/chat'

type SessionsState = {
  sessions: Session[]
  total: number
  loading: boolean
  error: string | null
  activeSessionId: string | null
  searchQuery: string

  load: () => Promise<void>
  search: (query: string) => Promise<void>
  setActive: (id: string | null) => void
  clearSearch: () => void
  create: () => Promise<Session | null>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  total: 0,
  loading: false,
  error: null,
  activeSessionId: null,
  searchQuery: '',

  load: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchSessions(100)
      set({ sessions: data.items, total: data.total, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query, loading: true })
    try {
      if (!query.trim()) {
        return get().load()
      }
      const data = await searchSessions(query)
      set({ sessions: data.items, total: data.total, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  setActive: (id) => set({ activeSessionId: id }),

  clearSearch: () => {
    set({ searchQuery: '' })
    get().load()
  },

  create: async () => {
    try {
      const { session } = await createSession({ source: 'workspace', model: 'hermes-agent' })
      set((s) => ({
        sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
        total: s.total + 1,
        activeSessionId: session.id,
      }))
      // Clear chat pane for the fresh session
      useChatStore.getState().clear()
      return session
    } catch (err) {
      set({ error: String(err) })
      return null
    }
  },
}))
