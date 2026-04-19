import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { GitFork, Lock, Archive, ExternalLink, Circle, GitPullRequest, AlertCircle } from 'lucide-react'
import { fetchGithubIssues, fetchGithubPulls, type GHRepo } from '@/lib/api'
import { fetchGithubRepos } from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'
import type { GHIssue, GHPull } from '@/lib/api'

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

const ciStateColor: Record<string, string> = {
  success: 'text-tertiary',
  failure: 'text-error',
  pending: 'text-yellow-400',
  neutral: 'text-on-surface-variant/40',
}

type Tab = 'issues' | 'pulls'

export default function RepoDetailPage() {
  const { owner, repo } = useParams({ strict: false }) as { owner: string; repo: string }
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('issues')
  const [repoInfo, setRepoInfo] = useState<GHRepo | null>(null)
  const [issues, setIssues] = useState<GHIssue[]>([])
  const [pulls, setPulls] = useState<GHPull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Load repo info from cached repos list
    fetchGithubRepos()
      .then((data) => {
        const found = data.repos.find((r) => r.full_name === `${owner}/${repo}`)
        setRepoInfo(found || null)
      })
      .catch(() => {})

    if (tab === 'issues') {
      fetchGithubIssues(owner, repo)
        .then((data) => { setIssues(data.issues); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      fetchGithubPulls(owner, repo)
        .then((data) => { setPulls(data.pulls); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [owner, repo, tab])

  const fullName = `${owner}/${repo}`
  const githubUrl = `https://github.com/${fullName}`

  return (
    <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low custom-scrollbar">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <GitFork size={20} className="text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="font-headline font-black text-lg text-on-surface tracking-tight">
              {repo}
            </h1>
            <div className="text-xs text-on-surface-variant/60">{fullName}</div>
            {repoInfo?.description && (
              <p className="text-[11px] text-on-surface-variant/50 mt-1">
                {repoInfo.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {repoInfo?.private && (
              <span className="flex items-center gap-0.5 text-[9px] bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded font-label">
                <Lock size={8} /> Private
              </span>
            )}
            {repoInfo?.archived && (
              <span className="flex items-center gap-0.5 text-[9px] bg-on-surface-variant/10 text-on-surface-variant/50 px-1.5 py-0.5 rounded font-label">
                <Archive size={8} /> Archived
              </span>
            )}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-[9px] font-label tracking-wider uppercase bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-all"
            >
              <ExternalLink size={10} /> GitHub
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-outline-variant/15">
          <button
            onClick={() => setTab('issues')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-label tracking-wider uppercase border-b-2 transition-colors ${
              tab === 'issues'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant/40 hover:text-on-surface-variant'
            }`}
          >
            <AlertCircle size={12} /> Issues ({issues.length})
          </button>
          <button
            onClick={() => setTab('pulls')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-label tracking-wider uppercase border-b-2 transition-colors ${
              tab === 'pulls'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant/40 hover:text-on-surface-variant'
            }`}
          >
            <GitPullRequest size={12} /> Pull Requests ({pulls.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
            Loading...
          </div>
        ) : tab === 'issues' ? (
          <div className="bg-surface-container border border-outline-variant/15 rounded-md overflow-hidden">
            {issues.length === 0 ? (
              <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
                No open issues
              </div>
            ) : (
              issues.map((issue) => (
                <a
                  key={issue.number}
                  href={`${githubUrl}/issues/${issue.number}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors"
                >
                  <AlertCircle size={13} className="text-tertiary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-on-surface truncate">
                      <span className="text-on-surface-variant/40">#{issue.number}</span>{' '}
                      {issue.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-on-surface-variant/40 font-label">
                        {issue.user}
                      </span>
                      <span className="text-[9px] text-on-surface-variant/30 font-label">
                        {issue.comments} comments
                      </span>
                      <span className="text-[9px] text-on-surface-variant/30 font-label">
                        {formatRelative(issue.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="text-[8px] bg-surface-container-high text-on-surface-variant/60 px-1.5 py-0.5 rounded font-label"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="bg-surface-container border border-outline-variant/15 rounded-md overflow-hidden">
            {pulls.length === 0 ? (
              <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
                No open pull requests
              </div>
            ) : (
              pulls.map((pr) => {
                const ciColor = ciStateColor[pr.ci_state || ''] || 'text-on-surface-variant/30'
                return (
                  <div
                    key={pr.number}
                    onClick={() => navigate({
                      to: '/repos/$owner/$repo/pulls/$num',
                      params: { owner, repo, num: String(pr.number) },
                    })}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <GitPullRequest size={13} className={pr.draft ? 'text-on-surface-variant/30' : 'text-tertiary'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-on-surface truncate">
                        <span className="text-on-surface-variant/40">#{pr.number}</span>{' '}
                        {pr.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-on-surface-variant/40 font-label">
                          {pr.user}
                        </span>
                        <span className="text-[9px] text-on-surface-variant/30 font-label">
                          {pr.head} → {pr.base}
                        </span>
                        <span className="text-[9px] text-on-surface-variant/30 font-label">
                          {formatRelative(pr.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pr.draft && (
                        <span className="text-[8px] bg-on-surface-variant/10 text-on-surface-variant/40 px-1.5 py-0.5 rounded font-label">
                          Draft
                        </span>
                      )}
                      {pr.labels.map((label) => (
                        <span
                          key={label}
                          className="text-[8px] bg-surface-container-high text-on-surface-variant/60 px-1.5 py-0.5 rounded font-label"
                        >
                          {label}
                        </span>
                      ))}
                      <Circle size={8} className={ciColor} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </main>
  )
}