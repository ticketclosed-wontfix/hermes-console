import { Router } from 'express'

const router = Router()

// In-memory cache with TTL
type CacheEntry<T> = { data: T; expiresAt: number }

function createCache<T>(ttlMs: number) {
  let cache: CacheEntry<T> | null = null
  return {
    get(): T | null {
      if (cache && Date.now() < cache.expiresAt) return cache.data
      cache = null
      return null
    },
    set(data: T) {
      cache = { data, expiresAt: Date.now() + ttlMs }
    },
  }
}

const GH_TOKEN = () =>
  process.env.HERMES_GITHUB_TOKEN || process.env.GH_TOKEN || ''

async function ghFetch(path: string, token: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

// ──────────────────────────────────────────────────
// GET /api/github/repos
// ──────────────────────────────────────────────────
const reposCache = createCache<unknown[]>(5 * 60 * 1000) // 5 min

router.get('/repos', async (_req, res) => {
  const token = GH_TOKEN()
  if (!token) {
    res.status(500).json({ error: 'HERMES_GITHUB_TOKEN not set' })
    return
  }

  const cached = reposCache.get()
  if (cached) {
    res.json({ repos: cached })
    return
  }

  try {
    // Fetch all repos for the authenticated user (handles pagination)
    const allRepos: unknown[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const ghRes = await ghFetch(
        `/user/repos?per_page=100&sort=pushed&page=${page}&type=all`,
        token,
      )
      if (!ghRes.ok) {
        const body = await ghRes.text()
        res.status(ghRes.status).json({ error: `GitHub API error: ${body}` })
        return
      }
      const batch = (await ghRes.json()) as unknown[]
      allRepos.push(...batch)
      hasMore = batch.length === 100
      page++
    }

    // Shape the data
    const repos = allRepos.map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      archived: r.archived,
      description: r.description || '',
      stargazers_count: r.stargazers_count,
      open_issues_count: r.open_issues_count,
      pushed_at: r.pushed_at,
      default_branch: r.default_branch,
    }))

    reposCache.set(repos)
    res.json({ repos })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────
// GET /api/github/repos/:owner/:repo/issues
// ──────────────────────────────────────────────────
router.get('/repos/:owner/:repo/issues', async (req, res) => {
  const token = GH_TOKEN()
  if (!token) {
    res.status(500).json({ error: 'HERMES_GITHUB_TOKEN not set' })
    return
  }

  const { owner, repo } = req.params
  const state = (req.query.state as string) || 'open'
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  try {
    // GitHub conflates issues and PRs in the issues endpoint.
    // Fetch issues and filter out PRs (those have a pull_request field).
    const ghRes = await ghFetch(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}&sort=updated`,
      token,
    )
    if (!ghRes.ok) {
      const body = await ghRes.text()
      res.status(ghRes.status).json({ error: `GitHub API error: ${body}` })
      return
    }

    const all = (await ghRes.json()) as any[]
    // Exclude PRs
    const issues = all
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: i.user?.login || '',
        created_at: i.created_at,
        updated_at: i.updated_at,
        labels: (i.labels || []).map((l: any) =>
          typeof l === 'string' ? l : l.name,
        ),
        comments: i.comments,
      }))

    res.json({ issues })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────
// GET /api/github/repos/:owner/:repo/pulls
// ──────────────────────────────────────────────────
router.get('/repos/:owner/:repo/pulls', async (req, res) => {
  const token = GH_TOKEN()
  if (!token) {
    res.status(500).json({ error: 'HERMES_GITHUB_TOKEN not set' })
    return
  }

  const { owner, repo } = req.params
  const state = (req.query.state as string) || 'open'
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  try {
    const ghRes = await ghFetch(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}&sort=updated`,
      token,
    )
    if (!ghRes.ok) {
      const body = await ghRes.text()
      res.status(ghRes.status).json({ error: `GitHub API error: ${body}` })
      return
    }

    const pulls = (await ghRes.json()) as any[]

    const shaped = pulls.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      draft: p.draft || false,
      user: p.user?.login || '',
      created_at: p.created_at,
      updated_at: p.updated_at,
      labels: (p.labels || []).map((l: any) =>
        typeof l === 'string' ? l : l.name,
      ),
      head: p.head?.ref || '',
      base: p.base?.ref || '',
      mergeable_state: p.mergeable_state ?? null,
      // ci_state is aggregated on demand (expensive), set to null here
      ci_state: null as string | null,
    }))

    res.json({ pulls: shaped })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ──────────────────────────────────────────────────
// GET /api/github/repos/:owner/:repo/pulls/:num/checks
// ──────────────────────────────────────────────────
router.get('/repos/:owner/:repo/pulls/:num/checks', async (req, res) => {
  const token = GH_TOKEN()
  if (!token) {
    res.status(500).json({ error: 'HERMES_GITHUB_TOKEN not set' })
    return
  }

  const { owner, repo, num } = req.params

  try {
    // First get the PR to find the head SHA
    const prRes = await ghFetch(
      `/repos/${owner}/${repo}/pulls/${num}`,
      token,
    )
    if (!prRes.ok) {
      const body = await prRes.text()
      res.status(prRes.status).json({ error: `GitHub API error: ${body}` })
      return
    }
    const pr = (await prRes.json()) as any
    const headSha = pr.head?.sha
    if (!headSha) {
      res.json({ overall: null, checks: [] })
      return
    }

    // Fetch check suites + check runs via the combined status endpoint
    // (works with fine-grained PATs that have checks read scope)
    const checksRes = await ghFetch(
      `/repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100`,
      token,
    )

    if (!checksRes.ok) {
      // Fall back to combined status (older API)
      const statusRes = await ghFetch(
        `/repos/${owner}/${repo}/commits/${headSha}/status`,
        token,
      )
      if (!statusRes.ok) {
        res.json({ overall: null, checks: [] })
        return
      }
      const status = (await statusRes.json()) as any
      const checks = (status.statuses || []).map((s: any) => ({
        name: s.context,
        status: s.state === 'success' ? 'completed' : s.state === 'failure' ? 'completed' : 'queued',
        conclusion: s.state,
        url: s.target_url || null,
      }))

      const overall = deriveOverallFromConclusions(checks.map((c: any) => c.conclusion))
      res.json({ overall, checks })
      return
    }

    const checksData = (await checksRes.json()) as any
    const checks = (checksData.check_runs || []).map((cr: any) => ({
      name: cr.name,
      status: cr.status,
      conclusion: cr.conclusion,
      url: cr.html_url || cr.details_url || null,
    }))

    const overall = deriveOverall(checks)
    res.json({ overall, checks })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

function deriveOverall(
  checks: { status: string; conclusion: string | null }[],
): 'success' | 'failure' | 'pending' | 'neutral' | null {
  if (checks.length === 0) return null
  const conclusions = checks.map((c) => c.conclusion)
  if (conclusions.some((c) => c === 'failure' || c === 'timed_out' || c === 'cancelled'))
    return 'failure'
  if (conclusions.some((c) => c === null && checks.find((ch) => ch.status === 'in_progress' || ch.status === 'queued')))
    return 'pending'
  if (conclusions.every((c) => c === 'success'))
    return 'success'
  if (conclusions.some((c) => c === 'skipped' || c === 'neutral'))
    return 'neutral'
  return 'pending'
}

function deriveOverallFromConclusions(
  conclusions: (string | null)[],
): 'success' | 'failure' | 'pending' | 'neutral' | null {
  if (conclusions.length === 0) return null
  if (conclusions.some((c) => c === 'failure' || c === 'error'))
    return 'failure'
  if (conclusions.some((c) => c === 'pending'))
    return 'pending'
  if (conclusions.every((c) => c === 'success'))
    return 'success'
  return 'neutral'
}

export { router as githubRouter }