import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'

// Mock @tanstack/react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock API to prevent real calls from stores
vi.mock('@/lib/api', () => ({
  fetchSessions: vi.fn(),
  searchSessions: vi.fn(),
  fetchMessages: vi.fn(),
  streamChat: vi.fn(),
}))

// We need to import the hook after mocks are set up
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { renderHook } from '@testing-library/react'

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  })
  window.dispatchEvent(event)
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useChatStore.setState({
      messages: [],
      loading: false,
      streaming: false,
      error: null,
      abortController: null,
    })
    useSessionsStore.setState({
      sessions: [],
      total: 0,
      loading: false,
      error: null,
      activeSessionId: 'existing-session',
      searchQuery: '',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Ctrl+K navigates to /search', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    fireKey('k', { ctrlKey: true })

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/search' })
    unmount()
  })

  it('Cmd+K navigates to /search (Mac)', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    fireKey('k', { metaKey: true })

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/search' })
    unmount()
  })

  it('Ctrl+N creates new session and navigates to /', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    fireKey('n', { ctrlKey: true })

    expect(useSessionsStore.getState().activeSessionId).toBeNull()
    expect(useChatStore.getState().messages).toEqual([])
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    unmount()
  })

  it('Escape cancels streaming when streaming is active', () => {
    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')
    useChatStore.setState({ streaming: true, abortController: controller })

    const { unmount } = renderHook(() => useKeyboardShortcuts())

    fireKey('Escape')

    expect(abortSpy).toHaveBeenCalled()
    expect(useChatStore.getState().streaming).toBe(false)
    unmount()
  })

  it('Escape blurs focused input when not streaming', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    fireKey('Escape')

    expect(document.activeElement).not.toBe(input)
    document.body.removeChild(input)
    unmount()
  })

  it('does not navigate without modifier key', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts())

    fireKey('k')
    fireKey('n')

    expect(mockNavigate).not.toHaveBeenCalled()
    unmount()
  })
})
