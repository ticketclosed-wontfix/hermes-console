import { useEffect, useState, useMemo } from 'react'
import {
  Clock,
  Play,
  Pause,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import {
  fetchJobs,
  pauseJob,
  resumeJob,
  triggerJob,
  deleteJob,
  type Job,
} from '@/lib/api'
import CreateJobDialog from './CreateJobDialog'
import EditJobDialog from './EditJobDialog'

function formatNextRun(nextRun?: string | null): string {
  if (!nextRun) return '---'
  try {
    const d = new Date(nextRun)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    if (diffMs < 0) return 'overdue'
    if (diffMs < 60_000) return 'in < 1m'
    if (diffMs < 3_600_000) return `in ${Math.round(diffMs / 60_000)}m`
    if (diffMs < 86_400_000) return `in ${Math.round(diffMs / 3_600_000)}h`
    return d.toLocaleDateString()
  } catch {
    return nextRun
  }
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function StatusDot({ status }: { status: string | null }) {
  if (status === 'ok')
    return <CheckCircle size={12} className="text-tertiary" />
  if (status === 'error')
    return <XCircle size={12} className="text-error" />
  return <AlertCircle size={12} className="text-on-surface-variant/40" />
}

function JobCard({
  job,
  onRefresh,
  onEdit,
}: {
  job: Job
  onRefresh: () => void
  onEdit: (job: Job) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const isPaused = job.state === 'paused' || !job.enabled

  const action = async (fn: () => Promise<unknown>) => {
    setActing(true)
    try {
      await fn()
      onRefresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <div
      className={`bg-surface-container-low border border-outline-variant/15 rounded-lg p-4 transition-opacity ${isPaused ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPaused ? 'bg-on-surface-variant/30' : 'bg-tertiary'
              }`}
            />
            <h3 className="text-sm font-medium text-on-surface truncate">
              {job.name || '(unnamed)'}
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant/50 line-clamp-2 mb-2 ml-4">
            {job.prompt}
          </p>
          <div className="flex flex-wrap items-center gap-3 ml-4 text-[10px] font-label text-on-surface-variant/40">
            <span className="bg-surface-container-high px-1.5 py-0.5 rounded">
              {job.schedule_display || 'custom'}
            </span>
            <span>Next: {formatNextRun(job.next_run_at)}</span>
            <span>Last: {formatTimestamp(job.last_run_at)}</span>
            <StatusDot status={job.last_status} />
            {job.skills.length > 0 && (
              <span>
                {job.skills.length} skill{job.skills.length !== 1 ? 's' : ''}
              </span>
            )}
            {job.repeat.times !== null && (
              <span>
                {job.repeat.completed}/{job.repeat.times} runs
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => action(() => triggerJob(job.id))}
            disabled={acting}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            title="Run now"
          >
            <Play size={14} className="text-primary" />
          </button>
          <button
            onClick={() =>
              action(() => (isPaused ? resumeJob(job.id) : pauseJob(job.id)))
            }
            disabled={acting}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Play size={14} className="text-on-surface-variant/50" />
            ) : (
              <Pause size={14} className="text-on-surface-variant/50" />
            )}
          </button>
          <button
            onClick={() => onEdit(job)}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            title="Edit"
          >
            <Edit size={14} className="text-on-surface-variant/50" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            title="Details"
          >
            {expanded ? (
              <ChevronUp size={14} className="text-on-surface-variant/50" />
            ) : (
              <ChevronDown size={14} className="text-on-surface-variant/50" />
            )}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete job "${job.name}"?`)) {
                action(() => deleteJob(job.id))
              }
            }}
            disabled={acting}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            title="Delete"
          >
            <Trash2 size={14} className="text-error" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-outline-variant/15 ml-4 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                ID
              </span>
              <div className="font-label text-on-surface/70">{job.id}</div>
            </div>
            <div>
              <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                State
              </span>
              <div className="text-on-surface/70">{job.state}</div>
            </div>
            <div>
              <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                Created
              </span>
              <div className="text-on-surface/70">{formatTimestamp(job.created_at)}</div>
            </div>
            <div>
              <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                Deliver
              </span>
              <div className="text-on-surface/70 truncate">{job.deliver || '---'}</div>
            </div>
            {job.model && (
              <div>
                <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                  Model
                </span>
                <div className="text-on-surface/70">{job.model}</div>
              </div>
            )}
          </div>
          {job.skills.length > 0 && (
            <div>
              <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
                Skills
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {job.skills.map((s) => (
                  <span
                    key={s}
                    className="font-label text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {job.last_error && (
            <div>
              <span className="font-label text-[9px] text-error/70 tracking-widest uppercase">
                Last Error
              </span>
              <div className="text-error/80 font-label text-[11px] bg-error/5 rounded p-2 mt-0.5">
                {job.last_error}
              </div>
            </div>
          )}
          <div>
            <span className="font-label text-[9px] text-on-surface-variant/40 tracking-widest uppercase">
              Full Prompt
            </span>
            <pre className="text-on-surface/60 font-label text-[11px] bg-surface-container-high rounded p-2 mt-0.5 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {job.prompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)

  const loadJobs = async () => {
    setLoading(true)
    try {
      const result = await fetchJobs()
      setJobs(result.jobs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs
    const q = search.toLowerCase()
    return jobs.filter(
      (j) =>
        j.name?.toLowerCase().includes(q) || j.prompt?.toLowerCase().includes(q),
    )
  }, [jobs, search])

  return (
    <div className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
      {/* Header */}
      <div className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-primary" />
          <h1 className="font-headline font-bold text-sm tracking-tight text-on-surface">
            Jobs
          </h1>
          <span className="font-label text-[9px] tracking-widest uppercase text-on-surface-variant/40">
            ({jobs.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobs}
            className="p-1.5 rounded-md hover:bg-surface-container-high transition-colors text-on-surface-variant/50 hover:text-on-surface"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-label text-[10px] font-bold px-3 py-1.5 rounded-md hover:brightness-110 transition-all tracking-widest uppercase"
          >
            <Plus size={12} />
            NEW JOB
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-2 border-b border-outline-variant/15">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH JOBS"
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase pl-7 pr-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
        {loading && jobs.length === 0 && (
          <div className="flex items-center justify-center py-12 text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase">
            Loading jobs...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant/40">
            <Clock size={32} className="mb-3 opacity-40" />
            <span className="font-label text-xs tracking-widest uppercase">
              No scheduled jobs
            </span>
            <span className="font-label text-[10px] mt-1">Create one to get started</span>
          </div>
        )}
        {filtered.map((job) => (
          <JobCard key={job.id} job={job} onRefresh={loadJobs} onEdit={setEditingJob} />
        ))}
      </div>

      {showCreate && (
        <CreateJobDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            loadJobs()
          }}
        />
      )}

      {editingJob && (
        <EditJobDialog
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={() => {
            setEditingJob(null)
            loadJobs()
          }}
        />
      )}
    </div>
  )
}
