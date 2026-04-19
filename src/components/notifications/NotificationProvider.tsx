import { useEffect, useState, useCallback } from 'react'
import { useNotificationsStore } from '@/stores/notifications'
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { Notification } from '@/stores/notifications'

// ── Toast ───────────────────────────────────────────────

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

const severityColors = {
  info: 'border-l-blue-400 bg-blue-400/5',
  warning: 'border-l-yellow-400 bg-yellow-400/5',
  error: 'border-l-red-400 bg-red-400/5',
}

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

type ToastItemProps = {
  notification: Notification
  onClose: () => void
}

function ToastItem({ notification, onClose }: ToastItemProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  // Auto-dismiss after 8s (paused on hover)
  useEffect(() => {
    if (hovered) return
    const timer = setTimeout(onClose, 8000)
    return () => clearTimeout(timer)
  }, [hovered, onClose])

  const Icon = severityIcons[notification.severity] || Info

  const handleClick = () => {
    if (notification.url) {
      // External link (GitHub) opens in new tab; internal routes navigate
      if (notification.url.startsWith('http')) {
        window.open(notification.url, '_blank', 'noopener')
      } else {
        navigate({ to: notification.url })
      }
    }
    onClose()
  }

  const bodyPreview =
    notification.body
      ? notification.body.length > 80
        ? notification.body.slice(0, 80) + '...'
        : notification.body
      : ''

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`border-l-2 ${severityColors[notification.severity]} glass-panel rounded-sm shadow-lg px-3 py-2.5 min-w-[280px] max-w-[360px] cursor-pointer transition-all`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 shrink-0 opacity-60" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-on-surface truncate">
            {notification.title}
          </div>
          {bodyPreview && (
            <div className="text-[10px] text-on-surface-variant/60 truncate mt-0.5">
              {bodyPreview}
            </div>
          )}
          <div className="text-[9px] text-on-surface-variant/40 font-label mt-1">
            {formatRelative(notification.created_at)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="shrink-0 text-on-surface-variant/40 hover:text-on-surface transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// ── ToastStack ──────────────────────────────────────────

function ToastStack() {
  const [visibleToasts, setVisibleToasts] = useState<Notification[]>([])
  const consumeToasts = useNotificationsStore((s) => s.consumeToasts)

  // Poll for new toasts every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      const newToasts = consumeToasts()
      if (newToasts.length > 0) {
        setVisibleToasts((prev) => [...newToasts, ...prev].slice(0, 5))
      }
    }, 500)
    return () => clearInterval(interval)
  }, [consumeToasts])

  const removeToast = useCallback((id: number) => {
    setVisibleToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (visibleToasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {visibleToasts.map((t) => (
        <ToastItem
          key={t.id}
          notification={t}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </div>
  )
}

// ── NotificationProvider ────────────────────────────────

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const connect = useNotificationsStore((s) => s.connect)
  const disconnect = useNotificationsStore((s) => s.disconnect)

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return (
    <>
      <ToastStack />
      {children}
    </>
  )
}