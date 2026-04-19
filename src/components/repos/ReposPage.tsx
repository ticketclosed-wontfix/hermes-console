import { useState, useEffect } from 'react'
import { GitFork, Lock, Archive, Star, Circle } from 'lucide-react'
import { fetchGithubRepos } from '@/lib/api'
import type { GHRepo } from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'

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

export default function ReposPage() {
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchGithubRepos()
      .then((data) => { setRepos(data.repos); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low flex items-center justify-center">
        <span className="text-on-surface-variant/40 text-xs font-label tracking-widest uppercase">Loading repos...</span>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low flex items-center justify-center">
        <span className="text-error text-xs">{error}</span>
      </main>
    )
  }

  return (
    <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low custom-scrollbar">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <GitFork size={20} className="text-primary" />
          <h1 className="font-headline font-black text-lg text-on-surface tracking-tight">
            REPOSITORIES
          </h1>
          <span className="text-[9px] font-label tracking-widest uppercase text-on-surface-variant/40 ml-2">
            {repos.length} repos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {repos.map((repo) => (
            <div
              key={repo.full_name}
              onClick={() => navigate({ to: '/repos/$owner/$repo', params: {
                owner: repo.full_name.split('/')[0],
                repo: repo.name,
              }})}
              className="bg-surface-container border border-outline-variant/15 rounded-md p-4 cursor-pointer hover:border-outline-variant/30 transition-all group"
            >
              <div className="flex items-start gap-2 mb-2">
                <GitFork size={14} className="mt-0.5 shrink-0 text-on-surface-variant/40" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate group-hover:text-primary transition-colors">
                    {repo.name}
                  </div>
                  <div className="text-[9px] text-on-surface-variant/40 font-label">
                    {repo.full_name}
                  </div>
                </div>
              </div>

              {repo.description && (
                <p className="text-[11px] text-on-surface-variant/60 mb-3 line-clamp-2">
                  {repo.description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {repo.private && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded font-label">
                    <Lock size={8} /> Private
                  </span>
                )}
                {repo.archived && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-on-surface-variant/10 text-on-surface-variant/50 px-1.5 py-0.5 rounded font-label">
                    <Archive size={8} /> Archived
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-[9px] text-on-surface-variant/40 font-label">
                  <Circle size={6} className="text-tertiary" />
                  {repo.open_issues_count} open
                </span>
                {repo.stargazers_count > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-on-surface-variant/40 font-label">
                    <Star size={8} /> {repo.stargazers_count}
                  </span>
                )}
              </div>

              <div className="mt-2 text-[9px] text-on-surface-variant/30 font-label">
                Pushed {formatRelative(repo.pushed_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}