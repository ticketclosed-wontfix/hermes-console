import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionsStore } from '@/stores/sessions'

// Mock the API module
vi.mock('@/lib/api', () => ({
  fetchSessions: vi.fn(),
  searchSessions: vi.fn(),
  createSession: vi.fn(),
}))

import { fetchSessions, searchSessions } from '@/lib/api'

const mockSessions = [
  {
    id: 'sess-1',
    source: 'cli',
    user_id: null,
    model: 'claude-opus-4-6',
    title: 'Test Session One',
    started_at: 1700000000,
    ended_at: null,
    end_reason: null,
    message_count: 10,
    tool_call_count: 3,
    input_tokens: 5000,
    output_tokens: 2000,
    estimated_cost_usd: 0.05,
  },
  {
    id: 'sess-2',
    source: 'telegram',
    user_id: null,
    model: 'glm-5.1',
    title: 'Test Session Two',
    started_at: 1699999000,
    ended_at: 1700000000,
    end_reason: 'completed',
    message_count: 5,
    tool_call_count: 1,
    input_tokens: 2000,
    output_tokens: 1000,
    estimated_cost_usd: 0.02,
  },
]

describe('useSessionsStore', () => {
  beforeEach(() => {
    // Reset store state
    useSessionsStore.setState({
      sessions: [],
      total: 0,
      loading: false,
      error: null,
      activeSessionId: null,
      searchQuery: '',
    })
    vi.clearAllMocks()
  })

  it('starts with empty state', () => {
    const state = useSessionsStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.total).toBe(0)
    expect(state.loading).toBe(false)
    expect(state.activeSessionId).toBeNull()
  })

  it('loads sessions from API', async () => {
    vi.mocked(fetchSessions).mockResolvedValue({
      items: mockSessions,
      total: 2,
    })

    await useSessionsStore.getState().load()

    const state = useSessionsStore.getState()
    expect(state.sessions).toHaveLength(2)
    expect(state.total).toBe(2)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(fetchSessions).toHaveBeenCalledWith(100)
  })

  it('handles load errors', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'))

    await useSessionsStore.getState().load()

    const state = useSessionsStore.getState()
    expect(state.error).toContain('Network error')
    expect(state.loading).toBe(false)
  })

  it('searches sessions', async () => {
    vi.mocked(searchSessions).mockResolvedValue({
      items: [mockSessions[0]],
      total: 1,
    })

    await useSessionsStore.getState().search('Test One')

    const state = useSessionsStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.searchQuery).toBe('Test One')
    expect(searchSessions).toHaveBeenCalledWith('Test One')
  })

  it('sets active session', () => {
    useSessionsStore.getState().setActive('sess-1')
    expect(useSessionsStore.getState().activeSessionId).toBe('sess-1')

    useSessionsStore.getState().setActive(null)
    expect(useSessionsStore.getState().activeSessionId).toBeNull()
  })
})
