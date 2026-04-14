const API_BASE = '/api'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${path}: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

// ── Types ──────────────────────────────────────────────

export type Session = {
  id: string
  source: string
  user_id: string | null
  model: string | null
  title: string | null
  started_at: number
  ended_at: number | null
  end_reason: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number | null
}

export type Message = {
  id: number
  session_id: string
  role: string
  content: string | null
  tool_call_id: string | null
  tool_calls: string | null
  tool_name: string | null
  timestamp: number
  token_count: number | null
  finish_reason: string | null
  reasoning: string | null
}

export type HealthStatus = {
  workspace: { status: string }
  gateway: { status: string; platform?: string; url: string }
}

export type SkillSummary = {
  name: string
  category: string | null
  description: string
  path: string
}

export type MemoryData = {
  memory: { content: string; chars: number; maxChars: number }
  user: { content: string; chars: number; maxChars: number }
}

// ── API calls ──────────────────────────────────────────

export async function fetchSessions(limit = 50, offset = 0) {
  return apiFetch<{ items: Session[]; total: number }>(
    `/sessions?limit=${limit}&offset=${offset}`,
  )
}

export async function fetchSession(id: string) {
  return apiFetch<{ session: Session }>(`/sessions/${id}`)
}

export async function fetchMessages(sessionId: string) {
  return apiFetch<{ items: Message[]; total: number }>(
    `/sessions/${sessionId}/messages`,
  )
}

export async function searchSessions(query: string, limit = 20) {
  return apiFetch<{ items: Session[]; total: number }>(
    `/sessions?q=${encodeURIComponent(query)}&limit=${limit}`,
  )
}

export async function fetchHealth() {
  return apiFetch<HealthStatus>('/health')
}

export async function fetchSkills() {
  return apiFetch<{ skills: SkillSummary[]; categories: string[]; total: number }>(
    '/skills',
  )
}

export async function fetchSkill(name: string) {
  return apiFetch<SkillSummary & { content: string }>(
    `/skills/${encodeURIComponent(name)}`,
  )
}

export async function fetchMemory() {
  return apiFetch<MemoryData>('/memory')
}

// ── Config types + API ──────────────────────────────────

export type ConfigData = {
  config: string
  soul: string
  envVars: { key: string; hasValue: boolean }[]
}

export async function fetchConfig() {
  return apiFetch<ConfigData>('/config')
}

// ── Jobs types + API ────────────────────────────────────

export type Job = {
  id: string
  name: string | null
  prompt: string
  skills: string[]
  model: string | null
  provider: string | null
  schedule: { kind: string; expr: string; display: string }
  schedule_display: string
  repeat: { times: number | null; completed: number }
  enabled: boolean
  state: string
  paused_at: string | null
  created_at: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
  deliver: string | null
}

export async function fetchJobs() {
  return apiFetch<{ jobs: Job[] }>('/jobs')
}

export async function pauseJob(id: string) {
  return apiFetch<{ ok: boolean }>(`/jobs/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'pause' }),
  })
}

export async function resumeJob(id: string) {
  return apiFetch<{ ok: boolean }>(`/jobs/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'resume' }),
  })
}

export async function triggerJob(id: string) {
  return apiFetch<{ ok: boolean }>(`/jobs/${id}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'run' }),
  })
}

export async function deleteJob(id: string) {
  return apiFetch<{ ok: boolean }>(`/jobs/${id}`, { method: 'DELETE' })
}

export async function createJob(input: {
  name: string
  schedule: string
  prompt: string
  skills?: string[]
  deliver?: string
}) {
  return apiFetch<{ job: Job }>('/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateJob(
  id: string,
  updates: { name?: string; schedule?: string; prompt?: string; skills?: string[]; deliver?: string },
) {
  return apiFetch<{ job: Job }>(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

// ── Files types + API ───────────────────────────────────

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: FileEntry[]
}

export type FileContent = {
  type: 'file'
  path: string
  name: string
  size: number
  content: string
}

export async function fetchFileTree() {
  return apiFetch<{ tree: FileEntry[]; root: string }>('/files')
}

export async function fetchFile(filePath: string) {
  return apiFetch<FileContent>(`/files/${filePath}`)
}

// ── Search types + API ──────────────────────────────────

export type SearchHit = {
  session_id: string
  session_title: string | null
  model: string | null
  started_at: number
  message_id: number
  role: string
  snippet: string
  timestamp: number
}

export async function searchMessages(query: string, limit = 20, offset = 0) {
  return apiFetch<{ items: SearchHit[]; total: number; query: string }>(
    `/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
  )
}

// ── Export / Fork / Download ────────────────────────────

export async function exportSession(id: string, format: 'markdown' | 'json'): Promise<Blob> {
  const res = await fetch(`${API_BASE}/sessions/${id}/export?format=${format}`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function forkSession(id: string) {
  return apiFetch<{ messages: Message[]; source_session: Session }>(
    `/sessions/${id}/fork`, { method: 'POST' }
  )
}

// ── SSE streaming chat ─────────────────────────────────

export type ChatStreamEvent = {
  type: string
  data: Record<string, unknown>
}

export async function* streamChat(
  message: string,
  opts: {
    model?: string
    sessionId?: string
    signal?: AbortSignal
  } = {},
): AsyncGenerator<ChatStreamEvent> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.sessionId) {
    headers['X-Hermes-Session-Id'] = opts.sessionId
  }

  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model || 'hermes-agent',
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chat stream: ${res.status} ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

      for (const line of rawEvent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const parsed = JSON.parse(payload)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) {
            yield { type: 'content', data: { text: delta.content } }
          }
          if (delta?.reasoning || delta?.reasoning_content) {
            yield {
              type: 'reasoning',
              data: { text: delta.reasoning || delta.reasoning_content },
            }
          }
          if (delta?.tool_calls) {
            yield { type: 'tool_calls', data: { tool_calls: delta.tool_calls } }
          }
        } catch {
          // skip malformed JSON
        }
      }

      boundary = buffer.indexOf('\n\n')
    }
  }
}
