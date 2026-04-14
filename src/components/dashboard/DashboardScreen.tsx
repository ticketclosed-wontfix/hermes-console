import { useEffect, useState, useMemo } from 'react'
import { Activity, Cpu, MessageSquare, Clock, Zap, RefreshCw } from 'lucide-react'
import { fetchSessions, fetchHealth, type Session, type HealthStatus } from '@/lib/api'

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type StatCardProps = {
  label: string
  value: string
  sub?: string
  icon: typeof Activity
  color: string
}

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50 mb-1">
            {label}
          </div>
          <div className="text-2xl font-bold font-headline text-on-surface tabular-nums">
            {value}
          </div>
          {sub && (
            <div className="font-label text-[10px] text-on-surface-variant/40 mt-0.5">{sub}</div>
          )}
        </div>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
    </div>
  )
}

function ActivityChart({ sessions }: { sessions: Session[] }) {
  const chartData = useMemo(() => {
    const days = 14
    const now = Date.now() / 1000
    const buckets: { label: string; sessions: number; messages: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * 86400
      const dayEnd = now - i * 86400
      const d = new Date(dayEnd * 1000)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const daySessions = sessions.filter(
        (s) => s.started_at >= dayStart && s.started_at < dayEnd,
      )
      buckets.push({
        label,
        sessions: daySessions.length,
        messages: daySessions.reduce((sum, s) => sum + s.message_count, 0),
      })
    }
    return buckets
  }, [sessions])

  const maxMessages = Math.max(1, ...chartData.map((d) => d.messages))

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50">
          Activity — 14 Days
        </h3>
        <div className="flex items-center gap-4 text-[9px] font-label text-on-surface-variant/40">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" /> Sessions
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-tertiary" /> Messages
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-[120px]">
        {chartData.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div
              className="w-full bg-primary/30 rounded-t-sm min-h-[2px] transition-all"
              style={{ height: `${Math.max(2, (day.messages / maxMessages) * 100)}%` }}
              title={`${day.messages} messages`}
            />
            <span className="font-label text-[7px] text-on-surface-variant/30 mt-1">
              {day.label.split(' ')[1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentSessions({ sessions }: { sessions: Session[] }) {
  const recent = sessions.slice(0, 8)

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
      <h3 className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50 mb-3">
        Recent Sessions
      </h3>
      <div className="space-y-1">
        {recent.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface-container-high transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-on-surface truncate">
                {s.title || s.id.slice(0, 12)}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-label text-[9px] text-primary bg-primary/10 px-1 rounded-sm border border-primary/20">
                  {s.model || '?'}
                </span>
                <span className="font-label text-[9px] text-on-surface-variant/40">
                  {s.message_count} msgs
                </span>
              </div>
            </div>
            <span className="font-label text-[9px] text-on-surface-variant/40 shrink-0">
              {timeAgo(s.started_at)}
            </span>
          </div>
        ))}
        {recent.length === 0 && (
          <div className="text-center text-on-surface-variant/40 text-xs py-6">No sessions</div>
        )}
      </div>
    </div>
  )
}

export default function DashboardScreen() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessResult, healthResult] = await Promise.allSettled([
        fetchSessions(200),
        fetchHealth(),
      ])
      if (sessResult.status === 'fulfilled') setSessions(sessResult.value.items)
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const stats = useMemo(() => {
    const totalTokens = sessions.reduce((s, x) => s + x.input_tokens + x.output_tokens, 0)
    const totalCost = sessions.reduce((s, x) => s + (x.estimated_cost_usd || 0), 0)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todaySessions = sessions.filter((s) => s.started_at * 1000 >= todayStart.getTime())
    return {
      total: sessions.length,
      today: todaySessions.length,
      tokens: formatNumber(totalTokens),
      cost: `$${totalCost.toFixed(2)}`,
      toolCalls: sessions.reduce((s, x) => s + x.tool_call_count, 0),
    }
  }, [sessions])

  const gatewayConnected = health?.gateway.status === 'ok'

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0 overflow-y-auto">
      {/* Header */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Activity size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            Dashboard
          </h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${gatewayConnected ? 'bg-tertiary animate-pulse' : 'bg-error'}`}
            />
            <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50">
              {gatewayConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>
        <button
          onClick={loadData}
          className="text-on-surface-variant/50 hover:text-on-surface transition-colors p-1.5 rounded-md hover:bg-surface-container-high"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Total Sessions"
            value={String(stats.total)}
            sub={`${stats.today} today`}
            icon={MessageSquare}
            color="#f2c35b"
          />
          <StatCard
            label="Tokens Used"
            value={stats.tokens}
            icon={Cpu}
            color="#6366f1"
          />
          <StatCard
            label="Tool Calls"
            value={formatNumber(stats.toolCalls)}
            icon={Zap}
            color="#4fe579"
          />
          <StatCard
            label="Est. Cost"
            value={stats.cost}
            icon={Clock}
            color="#f59e0b"
          />
        </div>

        {/* Charts + recent */}
        <div className="grid grid-cols-2 gap-3">
          <ActivityChart sessions={sessions} />
          <RecentSessions sessions={sessions} />
        </div>
      </div>
    </div>
  )
}
