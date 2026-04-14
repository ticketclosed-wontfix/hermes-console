import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the API module
vi.mock('@/lib/api', () => ({
  fetchJobs: vi.fn(),
  pauseJob: vi.fn(),
  resumeJob: vi.fn(),
  triggerJob: vi.fn(),
  deleteJob: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))

import {
  fetchJobs,
  pauseJob,
  resumeJob,
  triggerJob,
  deleteJob,
  createJob,
  updateJob,
  type Job,
} from '@/lib/api'

const mockJob: Job = {
  id: 'job-1',
  name: 'Test Job',
  prompt: 'Do something useful',
  skills: ['daily-open-loop-sweep'],
  model: null,
  provider: null,
  schedule: { kind: 'cron', expr: '0 9 * * *', display: '0 9 * * *' },
  schedule_display: '0 9 * * *',
  repeat: { times: null, completed: 5 },
  enabled: true,
  state: 'scheduled',
  paused_at: null,
  created_at: '2026-04-05T01:41:41.233402+13:00',
  next_run_at: '2026-04-15T09:00:00+12:00',
  last_run_at: '2026-04-14T09:04:44.989497+12:00',
  last_status: 'ok',
  last_error: null,
  deliver: 'telegram:-1003513821944:3',
}

describe('Jobs API functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchJobs returns jobs list', async () => {
    vi.mocked(fetchJobs).mockResolvedValue({ jobs: [mockJob] })

    const result = await fetchJobs()
    expect(result.jobs).toHaveLength(1)
    expect(result.jobs[0].id).toBe('job-1')
    expect(result.jobs[0].name).toBe('Test Job')
  })

  it('pauseJob sends correct id', async () => {
    vi.mocked(pauseJob).mockResolvedValue({ ok: true })

    const result = await pauseJob('job-1')
    expect(result.ok).toBe(true)
    expect(pauseJob).toHaveBeenCalledWith('job-1')
  })

  it('resumeJob sends correct id', async () => {
    vi.mocked(resumeJob).mockResolvedValue({ ok: true })

    const result = await resumeJob('job-1')
    expect(result.ok).toBe(true)
    expect(resumeJob).toHaveBeenCalledWith('job-1')
  })

  it('triggerJob sends correct id', async () => {
    vi.mocked(triggerJob).mockResolvedValue({ ok: true })

    const result = await triggerJob('job-1')
    expect(result.ok).toBe(true)
    expect(triggerJob).toHaveBeenCalledWith('job-1')
  })

  it('deleteJob sends correct id', async () => {
    vi.mocked(deleteJob).mockResolvedValue({ ok: true })

    const result = await deleteJob('job-1')
    expect(result.ok).toBe(true)
    expect(deleteJob).toHaveBeenCalledWith('job-1')
  })

  it('createJob sends correct payload', async () => {
    vi.mocked(createJob).mockResolvedValue({ job: { ...mockJob, id: 'new-job' } })

    const input = {
      name: 'New Job',
      schedule: 'every 2h',
      prompt: 'Check stuff',
      skills: ['skill-a'],
    }
    const result = await createJob(input)
    expect(result.job.id).toBe('new-job')
    expect(createJob).toHaveBeenCalledWith(input)
  })

  it('updateJob sends id and updates', async () => {
    vi.mocked(updateJob).mockResolvedValue({ job: { ...mockJob, name: 'Updated' } })

    const updates = { name: 'Updated', schedule: '0 10 * * *' }
    const result = await updateJob('job-1', updates)
    expect(result.job.name).toBe('Updated')
    expect(updateJob).toHaveBeenCalledWith('job-1', updates)
  })

  it('Job type has correct shape', () => {
    expect(mockJob.schedule.kind).toBe('cron')
    expect(mockJob.skills).toContain('daily-open-loop-sweep')
    expect(mockJob.repeat.completed).toBe(5)
    expect(mockJob.enabled).toBe(true)
  })
})
