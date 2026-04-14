import { useEffect, useState } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { fetchMemory, type MemoryData } from '@/lib/api'

function MemoryCard({
  title,
  content,
  chars,
  maxChars,
}: {
  title: string
  content: string
  chars: number
  maxChars: number
}) {
  const pct = Math.round((chars / maxChars) * 100)
  const barColor =
    pct > 90 ? 'bg-error' : pct > 75 ? 'bg-primary' : 'bg-tertiary'

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15">
        <h3 className="font-headline font-bold text-sm text-on-surface">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40">
            {chars} / {maxChars} CHARS
          </span>
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/60">
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-1 bg-surface-container-high">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="p-4 max-h-[calc(50vh-80px)] overflow-y-auto custom-scrollbar">
        <pre className="text-xs text-on-surface/70 font-label leading-relaxed whitespace-pre-wrap break-words">
          {content || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export default function MemoryScreen() {
  const [data, setData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMemory = async () => {
    setLoading(true)
    try {
      const result = await fetchMemory()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMemory()
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
      {/* Header */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Brain size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            Memory
          </h1>
        </div>
        <button
          onClick={loadMemory}
          className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant/50 hover:text-on-surface"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
        {loading && !data && (
          <div className="flex items-center justify-center py-12 text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase">
            Loading memory...
          </div>
        )}
        {data && (
          <>
            <MemoryCard
              title="MEMORY.md"
              content={data.memory.content}
              chars={data.memory.chars}
              maxChars={data.memory.maxChars}
            />
            <MemoryCard
              title="USER.md"
              content={data.user.content}
              chars={data.user.chars}
              maxChars={data.user.maxChars}
            />
          </>
        )}
      </div>
    </div>
  )
}
