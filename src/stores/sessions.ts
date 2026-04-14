import { create } from 'zustand'
import type { Session } from '@/lib/api'
import { fetchSessions, searchSessions } from '@/lib/api'

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
}))
