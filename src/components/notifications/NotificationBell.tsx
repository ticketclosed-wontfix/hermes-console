import { useState, useRef, useEffect } from 'react'
import { Bell, Check, ExternalLink, Info, AlertTriangle, AlertCircle } from 'lucide-react'
import { useNotificationsStore } from '@/stores/notifications'
import { Link, useNavigate } from '@tanstack/react-router'
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

const severityIcon = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

const severityColor = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
}

function NotificationRow({ n, onMarkRead, onOpen }: {
  n: Notification
  onMarkRead: () => void
  onOpen: () => void
}) {
  const Icon = severityIcon[n.severity] || Info
  const bodyPreview = n.body
    ? n.body.length > 60 ? n.body.slice(0, 60) + '...' : n.body
    : ''
  const isUnread = !n.read_at

  return (
    <div className={`flex items-start gap-2 px-3 py-2 hover:bg-surface-container-high transition-colors ${isUnread ? 'bg-surface-container/30' : ''}`}>
      <Icon size={13} className={`mt-0.5 shrink-0 ${severityColor[n.severity]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-on-surface truncate">{n.title}</div>
        {bodyPreview && (
          <div className="text-[10px] text-on-surface-variant/50 truncate">{bodyPreview}</div>
        )}
        <div className="text-[9px] text-on-surface-variant/40 font-label mt-0.5">
          {formatRelative(n.created_at)}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isUnread && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead() }}
            className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
            title="Mark read"
          >
            <Check size={11} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
          title="Open"
        >
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { items, unreadCount, markRead, markAllRead, refresh } = useNotificationsStore()
  const navigate = useNavigate()

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) refresh({ limit: 20 })
  }, [open, refresh])

  const recent = items.slice(0, 20)

  const handleOpen = (n: Notification) => {
    if (n.url) {
      if (n.url.startsWith('http')) {
        window.open(n.url, '_blank', 'noopener')
      } else {
        navigate({ to: n.url })
      }
    }
    if (!n.read_at) markRead(n.id)
    setOpen(false)
  }

  const badge = unreadCount > 0
    ? unreadCount > 9 ? '9+' : String(unreadCount)
    : ''

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center leading-none px-0.5">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[320px] max-h-[400px] bg-surface-container-low border border-outline-variant/20 rounded-md shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/15">
            <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[9px] font-label tracking-wider uppercase text-primary hover:text-primary-container transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {recent.length === 0 ? (
              <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-8">
                No notifications
              </div>
            ) : (
              recent.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onMarkRead={() => markRead(n.id)}
                  onOpen={() => handleOpen(n)}
                />
              ))
            )}
          </div>

          <div className="border-t border-outline-variant/15 px-3 py-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-[9px] font-label tracking-widest uppercase text-primary hover:text-primary-container transition-colors"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}