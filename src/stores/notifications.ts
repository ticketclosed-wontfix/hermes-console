import { create } from 'zustand'

export type Notification = {
  id: number
  source: string
  repo: string | null
  kind: string
  title: string
  body: string | null
  url: string | null
  severity: 'info' | 'warning' | 'error'
  metadata: string | null
  created_at: string
  read_at: string | null
  dismissed_at: string | null
}

type NotificationsState = {
  items: Notification[]
  unreadCount: number
  connected: boolean
  _sse: EventSource | null
  _reconnectTimer: ReturnType<typeof setTimeout> | null
  _reconnectAttempt: number
  _channel: BroadcastChannel | null
  _pendingToasts: Notification[]

  connect: () => void
  disconnect: () => void
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  dismiss: (id: number) => Promise<void>
  refresh: (opts?: { limit?: number; offset?: number; unread?: boolean; repo?: string; kind?: string; source?: string }) => Promise<void>
  consumeToasts: () => Notification[]
}

const SSE_URL = '/api/notifications/stream'
const MAX_RECONNECT_ATTEMPTS = 10

function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000)
}

function setupBroadcastChannel(set: (partial: Partial<NotificationsState> | ((s: NotificationsState) => Partial<NotificationsState>)) => void): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null

  const channel = new BroadcastChannel('hermes-notifications')
  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type: string; id?: number; count?: number }
    if (msg.type === 'read' && msg.id != null) {
      set((s: NotificationsState) => ({
        items: s.items.map((n) =>
          n.id === msg.id ? { ...n, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } else if (msg.type === 'mark-all-read') {
      set((s: NotificationsState) => ({
        items: s.items.map((n) =>
          n.read_at ? n : { ...n, read_at: new Date().toISOString() }
        ),
        unreadCount: 0,
      }))
    } else if (msg.type === 'dismiss' && msg.id != null) {
      set((s: NotificationsState) => ({
        items: s.items.filter((n) => n.id !== msg.id),
        unreadCount: s.items.find((n) => n.id === msg.id && !n.read_at)
          ? Math.max(0, s.unreadCount - 1)
          : s.unreadCount,
      }))
    } else if (msg.type === 'unread-count' && msg.count != null) {
      set({ unreadCount: msg.count })
    }
  }
  return channel
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  connected: false,
  _sse: null,
  _reconnectTimer: null,
  _reconnectAttempt: 0,
  _channel: null,
  _pendingToasts: [],

  connect: () => {
    const state = get()
    if (state._sse) return

    // Set up BroadcastChannel for cross-tab dedupe
    if (!state._channel) {
      const channel = setupBroadcastChannel(set)
      if (channel) set({ _channel: channel })
    }

    const sse = new EventSource(SSE_URL)

    sse.onopen = () => {
      set({ connected: true, _reconnectAttempt: 0 })
    }

    sse.addEventListener('unread_count', (e: Event) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { count: number }
        set({ unreadCount: data.count })
      } catch { /* ignore */ }
    })

    sse.addEventListener('notification', (e: Event) => {
      try {
        const notification = JSON.parse((e as MessageEvent).data) as Notification
        set((s: NotificationsState) => ({
          items: [notification, ...s.items].slice(0, 500),
          unreadCount: s.unreadCount + 1,
          _pendingToasts: [...s._pendingToasts, notification],
        }))
      } catch { /* ignore */ }
    })

    sse.onerror = () => {
      set({ connected: false })
      sse.close()
      set({ _sse: null })

      const currentState = get()
      if (currentState._reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = getReconnectDelay(currentState._reconnectAttempt)
        const timer = setTimeout(() => {
          set((s: NotificationsState) => ({ _reconnectAttempt: s._reconnectAttempt + 1 }))
          get().connect()
        }, delay)
        set({ _reconnectTimer: timer })
      }
    }

    set({ _sse: sse })
  },

  disconnect: () => {
    const state = get()
    if (state._sse) {
      state._sse.close()
    }
    if (state._reconnectTimer) {
      clearTimeout(state._reconnectTimer)
    }
    if (state._channel) {
      state._channel.close()
    }
    set({
      connected: false,
      _sse: null,
      _reconnectTimer: null,
      _channel: null,
      _reconnectAttempt: 0,
    })
  },

  markRead: async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      set((s: NotificationsState) => ({
        items: s.items.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
      const channel = get()._channel
      if (channel) channel.postMessage({ type: 'read', id })
    } catch { /* ignore */ }
  },

  markAllRead: async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      const data = await res.json() as { count: number }
      void data
      set((s: NotificationsState) => ({
        items: s.items.map((n) =>
          n.read_at ? n : { ...n, read_at: new Date().toISOString() }
        ),
        unreadCount: 0,
      }))
      const channel = get()._channel
      if (channel) channel.postMessage({ type: 'mark-all-read' })
    } catch { /* ignore */ }
  },

  dismiss: async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      set((s: NotificationsState) => {
        const wasUnread = s.items.find((n) => n.id === id && !n.read_at)
        return {
          items: s.items.filter((n) => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
        }
      })
      const channel = get()._channel
      if (channel) channel.postMessage({ type: 'dismiss', id })
    } catch { /* ignore */ }
  },

  refresh: async (opts: { limit?: number; offset?: number; unread?: boolean; repo?: string; kind?: string; source?: string } = {}) => {
    try {
      const params = new URLSearchParams()
      if (opts.limit) params.set('limit', String(opts.limit))
      if (opts.offset) params.set('offset', String(opts.offset))
      if (opts.unread) params.set('unread', 'true')
      if (opts.repo) params.set('repo', opts.repo)
      if (opts.kind) params.set('kind', opts.kind)
      if (opts.source) params.set('source', opts.source)
      const qs = params.toString()
      const res = await fetch(`/api/notifications?${qs}`)
      const data = await res.json() as { items: Notification[]; total: number; unread_count: number }
      set({ items: data.items, unreadCount: data.unread_count })
    } catch { /* ignore */ }
  },

  consumeToasts: () => {
    const toasts = get()._pendingToasts
    if (toasts.length > 0) {
      set({ _pendingToasts: [] })
    }
    return toasts
  },
}))