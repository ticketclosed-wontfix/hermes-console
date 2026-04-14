import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, MessageSquare, User, Bot, Wrench, Loader2 } from 'lucide-react'
import { searchMessages, type SearchHit } from '@/lib/api'

interface GroupedSession {
  sessionId: string
  sessionTitle: string | null
  model: string | null
  startedAt: number
  messages: SearchHit[]
}

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const performSearch = useCallback(async (searchQuery: string, searchOffset: number) => {
    if (!searchQuery.trim()) {
      setResults([])
      setTotalCount(0)
      setHasMore(false)
      return
    }

    setLoading(true)
    try {
      const response = await searchMessages(searchQuery, 20, searchOffset)
      const hits = response.items || []
      const total = response.total || 0
      
      if (searchOffset === 0) {
        setResults(hits)
      } else {
        setResults(prev => [...prev, ...hits])
      }
      setTotalCount(total)
      setHasMore(hits.length === 20)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0)
      performSearch(query, 0)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  const groupedResults = useMemo(() => {
    const groups: Record<string, GroupedSession> = {}
    
    results.forEach(hit => {
      if (!groups[hit.session_id]) {
        groups[hit.session_id] = {
          sessionId: hit.session_id,
          sessionTitle: hit.session_title,
          model: hit.model,
          startedAt: hit.started_at,
          messages: []
        }
      }
      groups[hit.session_id].messages.push(hit)
    })
    
    return Object.values(groups).sort((a, b) => b.startedAt - a.startedAt)
  }, [results])

  const handleLoadMore = () => {
    const newOffset = offset + 20
    setOffset(newOffset)
    performSearch(query, newOffset)
  }

  const parseSnippet = (snippet: string) => {
    const parts = snippet.split(/<<|>>/)
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <mark key={index} className="bg-amber-500/30 text-amber-200 rounded px-0.5">
            {part}
          </mark>
        )
      }
      return part
    })
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="w-3 h-3" />
      case 'assistant':
        return <Bot className="w-3 h-3" />
      case 'tool':
        return <Wrench className="w-3 h-3" />
      default:
        return <MessageSquare className="w-3 h-3" />
    }
  }

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-500/10 text-blue-400'
      case 'assistant':
        return 'bg-emerald-500/10 text-emerald-400'
      case 'tool':
        return 'bg-amber-500/10 text-amber-400'
      default:
        return 'bg-surface-container-low text-on-surface-variant'
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest p-6">
      <div className="max-w-3xl mx-auto">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all sessions..."
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-12 pr-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {loading && results.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {!loading && query === '' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50">
            <Search className="w-12 h-12 mb-4" />
            <p className="text-lg">Search your conversation history</p>
          </div>
        )}

        {!loading && query !== '' && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant/50">
            <p className="text-lg">No results found</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/50">
                {totalCount} results
              </span>
            </div>

            {groupedResults.map((group) => (
              <div key={group.sessionId} className="bg-surface-container-low border border-outline-variant/20 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest/50">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-on-surface">
                      {group.sessionTitle || 'Untitled Session'}
                    </h3>
                    {group.model && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {group.model}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant/50">
                    {formatDate(group.startedAt)}
                  </span>
                </div>

                <div className="divide-y divide-outline-variant/20">
                  {group.messages.map((hit) => (
                    <div key={hit.message_id} className="px-4 py-3 hover:bg-surface-container-lowest/50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(hit.role)}`}>
                          {getRoleIcon(hit.role)}
                          <span className="capitalize">{hit.role}</span>
                        </span>
                        <span className="text-xs text-on-surface-variant/50">
                          {formatDate(hit.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface leading-relaxed">
                        {parseSnippet(hit.snippet)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm text-on-surface hover:bg-surface-container-lowest transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}