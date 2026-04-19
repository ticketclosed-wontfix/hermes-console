import { useState, useEffect, useCallback } from 'react'
import { useNotificationsStore } from '@/stores/notifications'
import { Bell, Check, Trash2, Filter, Info, AlertTriangle, AlertCircle } from 'lucide-react'
import type { Notification } from '@/stores/notifications'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const severityIcon = { info: Info, warning: AlertTriangle, error: AlertCircle }
const severityColor = { info: 'text-blue-400', warning: 'text-yellow-400', error: 'text-red-400' }

export default function NotificationsPage() {
  const { items, unreadCount, markRead, markAllRead, dismiss, refresh, connected } = useNotificationsStore()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filterUnread, setFilterUnread] = useState(false)
  const [filterSource, setFilterSource] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [offset] = useState(0)

  const doRefresh = useCallback(() => {
    refresh({
      unread: filterUnread || undefined,
      source: filterSource || undefined,
      limit: 50,
      offset,
    })
  }, [refresh, filterUnread, filterSource, offset])

  useEffect(() => { doRefresh() }, [doRefresh])

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((n) => n.id)))
    }
  }

  const handleBulkMarkRead = async () => {
    for (const id of selected) {
      await markRead(id)
    }
    setSelected(new Set())
  }

  const handleBulkDismiss = async () => {
    for (const id of selected) {
      await dismiss(id)
    }
    setSelected(new Set())
  }

  const openUrl = (n: Notification) => {
    if (n.url) {
      if (n.url.startsWith('http')) {
        window.open(n.url, '_blank', 'noopener')
      } else {
        window.location.href = n.url
      }
    }
    if (!n.read_at) markRead(n.id)
  }

  return (
    <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Bell size={20} className="text-primary" />
          <h1 className="font-headline font-black text-lg text-on-surface tracking-tight">
            NOTIFICATIONS
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-[9px] font-label tracking-wider uppercase px-1.5 py-0.5 rounded ${
              connected ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'
            }`}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="text-[9px] font-label tracking-wider uppercase bg-surface-container-high text-on-surface-variant px-2 py-1 rounded hover:bg-surface-container-highest disabled:opacity-30 transition-all"
            >
              Mark all read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter size={12} className="text-on-surface-variant/40" />
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`text-[9px] font-label tracking-wider uppercase px-2 py-1 rounded transition-all ${
              filterUnread
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="text-[9px] font-label tracking-wider uppercase bg-surface-container-high text-on-surface-variant px-2 py-1 rounded outline-none border border-outline-variant/20"
          >
            <option value="">All sources</option>
            <option value="github">GitHub</option>
            <option value="ci">CI</option>
            <option value="alert">Alert</option>
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-[9px] font-label tracking-wider uppercase bg-surface-container-high text-on-surface-variant px-2 py-1 rounded outline-none border border-outline-variant/20"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-label tracking-widest uppercase text-on-surface-variant/50">
              {selected.size} selected
            </span>
            <button
              onClick={handleBulkMarkRead}
              className="flex items-center gap-1 text-[9px] font-label tracking-wider uppercase bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-all"
            >
              <Check size={10} /> Mark read
            </button>
            <button
              onClick={handleBulkDismiss}
              className="flex items-center gap-1 text-[9px] font-label tracking-wider uppercase bg-error/10 text-error px-2 py-1 rounded hover:bg-error/20 transition-all"
            >
              <Trash2 size={10} /> Dismiss
            </button>
          </div>
        )}

        {/* List */}
        <div className="bg-surface-container border border-outline-variant/15 rounded-md overflow-hidden">
          {items.length === 0 ? (
            <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
              No notifications
            </div>
          ) : (
            <>
              {/* Select all header */}
              <div className="flex items-center gap-3 px-3 py-1.5 border-b border-outline-variant/10 bg-surface-container-low/50">
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  className="accent-primary"
                />
                <span className="text-[9px] font-label tracking-widest uppercase text-on-surface-variant/40">
                  {items.length} notifications
                </span>
              </div>

              {items.map((n) => {
                const Icon = severityIcon[n.severity] || Info
                const isUnread = !n.read_at

                return (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors ${
                      isUnread ? 'bg-surface-container/20' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onChange={() => toggleSelect(n.id)}
                      className="accent-primary shrink-0"
                    />
                    <Icon size={14} className={`shrink-0 ${severityColor[n.severity]}`} />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => openUrl(n)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-on-surface truncate">
                          {n.title}
                        </span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      {n.body && (
                        <div className="text-[10px] text-on-surface-variant/50 truncate mt-0.5">
                          {n.body.length > 120 ? n.body.slice(0, 120) + '...' : n.body}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-surface-container-high px-1 rounded font-label text-on-surface-variant/50">
                          {n.source}
                        </span>
                        {n.repo && (
                          <span className="text-[9px] font-label text-on-surface-variant/40">
                            {n.repo}
                          </span>
                        )}
                        <span className="text-[9px] text-on-surface-variant/40 font-label">
                          {formatRelative(n.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isUnread && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/40 hover:text-on-surface transition-colors"
                          title="Mark read"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(n.id)}
                        className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/40 hover:text-error transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </main>
  )
}