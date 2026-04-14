import { useEffect, useState } from 'react'
import { Settings, RefreshCw, Key, FileText, Ghost } from 'lucide-react'
import { fetchConfig, type ConfigData } from '@/lib/api'

export default function SettingsScreen() {
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'config' | 'soul' | 'env'>('config')

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await fetchConfig()
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const tabs = [
    { id: 'config' as const, label: 'CONFIG.YAML', icon: FileText },
    { id: 'soul' as const, label: 'SOUL.MD', icon: Ghost },
    { id: 'env' as const, label: 'ENV VARS', icon: Key },
  ]

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
      {/* Header */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Settings size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            Settings
          </h1>
        </div>
        <button
          onClick={loadConfig}
          className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant/50 hover:text-on-surface"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-outline-variant/15 flex gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-label text-[10px] tracking-widest uppercase transition-colors ${
              activeTab === id
                ? 'bg-primary/15 text-primary'
                : 'text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
        {loading && !data && (
          <div className="flex items-center justify-center py-12 text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase">
            Loading config...
          </div>
        )}

        {data && activeTab === 'config' && (
          <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
            <pre className="text-xs text-on-surface/70 font-label leading-relaxed whitespace-pre-wrap break-words">
              {data.config || '(no config.yaml found)'}
            </pre>
          </div>
        )}

        {data && activeTab === 'soul' && (
          <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
            <pre className="text-xs text-on-surface/70 font-label leading-relaxed whitespace-pre-wrap break-words">
              {data.soul || '(no SOUL.md found)'}
            </pre>
          </div>
        )}

        {data && activeTab === 'env' && (
          <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/15">
                  <th className="text-left px-4 py-2 font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40">
                    Variable
                  </th>
                  <th className="text-left px-4 py-2 font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.envVars.map((v) => (
                  <tr
                    key={v.key}
                    className="border-b border-outline-variant/10 last:border-0"
                  >
                    <td className="px-4 py-2 font-label text-on-surface/70">{v.key}</td>
                    <td className="px-4 py-2">
                      {v.hasValue ? (
                        <span className="font-label text-[9px] tracking-widest uppercase text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded">
                          SET
                        </span>
                      ) : (
                        <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/30 bg-surface-container-high px-1.5 py-0.5 rounded">
                          EMPTY
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
