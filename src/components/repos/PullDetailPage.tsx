import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { GitPullRequest, ExternalLink, Circle, Check, XCircle, Clock, MinusCircle } from 'lucide-react'
import { fetchGithubPulls, fetchGithubChecks } from '@/lib/api'
import type { GHCheck } from '@/lib/api'

const statusIcon: Record<string, typeof Check> = {
  completed: Check,
  in_progress: Clock,
  queued: Clock,
  waiting: Clock,
  pending: Clock,
  neutral: MinusCircle,
}
const conclusionIcon: Record<string, typeof Check> = {
  success: Check,
  failure: XCircle,
  timed_out: XCircle,
  cancelled: MinusCircle,
  skipped: MinusCircle,
  neutral: MinusCircle,
}
const conclusionColor: Record<string, string> = {
  success: 'text-tertiary',
  failure: 'text-error',
  timed_out: 'text-error',
  cancelled: 'text-on-surface-variant/40',
  skipped: 'text-on-surface-variant/40',
  neutral: 'text-on-surface-variant/40',
  pending: 'text-yellow-400',
}

export default function PullDetailPage() {
  const { owner, repo, num } = useParams({ strict: false }) as { owner: string; repo: string; num: string }
  const prNum = parseInt(num, 10)
  const [pull, setPull] = useState<{
    number: number; title: string; state: string; draft: boolean;
    user: string; head: string; base: string; labels: string[];
    mergeable_state?: string; ci_state?: string;
  } | null>(null)
  const [checks, setChecks] = useState<{ overall: string | null; checks: GHCheck[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchGithubPulls(owner, repo)
      .then((data) => {
        const found = data.pulls.find((p) => p.number === prNum)
        if (found) {
          setPull({
            number: found.number,
            title: found.title,
            state: found.state,
            draft: found.draft,
            user: found.user,
            head: found.head,
            base: found.base,
            labels: found.labels,
            ci_state: found.ci_state ?? undefined,
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetchGithubChecks(owner, repo, prNum)
      .then(setChecks)
      .catch(() => setChecks(null))
  }, [owner, repo, prNum])

  const githubUrl = `https://github.com/${owner}/${repo}/pull/${prNum}`
  const overallState = checks?.overall || pull?.ci_state || null

  return (
    <main className="flex-1 h-screen overflow-y-auto bg-surface-container-low custom-scrollbar">
      <div className="max-w-3xl mx-auto p-6">
        {loading ? (
          <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
            Loading...
          </div>
        ) : !pull ? (
          <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-12">
            PR #{prNum} not found
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <GitPullRequest size={20} className="text-tertiary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="font-headline font-black text-lg text-on-surface tracking-tight">
                  #{pull.number} {pull.title}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[9px] font-label px-1.5 py-0.5 rounded ${
                    pull.state === 'open' ? 'bg-tertiary/15 text-tertiary' :
                    pull.state === 'merged' ? 'bg-purple-400/15 text-purple-400' :
                    'bg-on-surface-variant/10 text-on-surface-variant/50'
                  }`}>
                    {pull.state.toUpperCase()}
                  </span>
                  {pull.draft && (
                    <span className="text-[9px] font-label bg-on-surface-variant/10 text-on-surface-variant/50 px-1.5 py-0.5 rounded">
                      DRAFT
                    </span>
                  )}
                  <span className="text-[9px] text-on-surface-variant/40 font-label">
                    by {pull.user}
                  </span>
                  <span className="text-[9px] text-on-surface-variant/30 font-label">
                    {pull.head} → {pull.base}
                  </span>
                </div>
                {pull.labels.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {pull.labels.map((label) => (
                      <span
                        key={label}
                        className="text-[8px] bg-surface-container-high text-on-surface-variant/60 px-1.5 py-0.5 rounded font-label"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-[9px] font-label tracking-wider uppercase bg-primary text-on-primary px-3 py-1.5 rounded hover:bg-primary/80 transition-all shrink-0"
              >
                <ExternalLink size={10} /> Open in GitHub
              </a>
            </div>

            {/* CI Checks */}
            <div className="mb-4">
              <h2 className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/50 mb-2">
                CI Checks
                {overallState && (
                  <span className="ml-2">
                    <Circle
                      size={8}
                      className={`inline ${
                        overallState === 'success' ? 'text-tertiary' :
                        overallState === 'failure' ? 'text-error' :
                        overallState === 'pending' ? 'text-yellow-400' :
                        'text-on-surface-variant/40'
                      }`}
                    />
                    {' '}{overallState.toUpperCase()}
                  </span>
                )}
              </h2>
              <div className="bg-surface-container border border-outline-variant/15 rounded-md overflow-hidden">
                {!checks || checks.checks.length === 0 ? (
                  <div className="text-on-surface-variant/30 text-[10px] font-label tracking-widest uppercase text-center py-6">
                    No checks data
                  </div>
                ) : (
                  checks.checks.map((check, i) => {
                    const ConclIcon = conclusionIcon[check.conclusion || ''] || MinusCircle
                    const StatusIcon = statusIcon[check.status] || Clock
                    const color = check.conclusion
                      ? (conclusionColor[check.conclusion] || 'text-on-surface-variant/40')
                      : 'text-yellow-400'
                    const Icon = check.conclusion ? ConclIcon : StatusIcon

                    return (
                      <div
                        key={`${check.name}-${i}`}
                        className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-b-0"
                      >
                        <Icon size={14} className={color} />
                        <span className="text-xs text-on-surface flex-1 min-w-0 truncate">
                          {check.name}
                        </span>
                        <span className="text-[9px] font-label text-on-surface-variant/40 shrink-0">
                          {check.conclusion || check.status}
                        </span>
                        {check.url && (
                          <a
                            href={check.url}
                            target="_blank"
                            rel="noopener"
                            className="text-on-surface-variant/30 hover:text-on-surface transition-colors shrink-0"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-surface-container border border-outline-variant/10 rounded-md p-4 text-[11px] text-on-surface-variant/50">
              <p>This is a read-only view. To review code, leave comments, or merge this PR, use GitHub.</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}