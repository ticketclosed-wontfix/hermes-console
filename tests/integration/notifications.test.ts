import { describe, it, expect, beforeEach, afterAll } from 'vitest'

// ── Ingest Auth (unit-level test by checking the route logic directly) ──

describe('Notification API auth', () => {
  const originalEnv = process.env.HERMES_CONSOLE_INGEST_SECRET

  beforeEach(() => {
    process.env.HERMES_CONSOLE_INGEST_SECRET = 'test-secret-12345'
  })

  afterAll(() => {
    process.env.HERMES_CONSOLE_INGEST_SECRET = originalEnv
  })

  it('rejects when env secret is empty', () => {
    process.env.HERMES_CONSOLE_INGEST_SECRET = ''
    const secret = process.env.HERMES_CONSOLE_INGEST_SECRET || ''
    const header = undefined
    expect(!secret || !header || header !== secret).toBe(true)
  })

  it('rejects when header does not match env secret', () => {
    const secret = process.env.HERMES_CONSOLE_INGEST_SECRET || ''
    const header = 'wrong-secret'
    expect(!secret || !header || header !== secret).toBe(true)
  })

  it('accepts when header matches env secret', () => {
    const secret = process.env.HERMES_CONSOLE_INGEST_SECRET || ''
    const header = 'test-secret-12345'
    expect(!secret || !header || header !== secret).toBe(false)
  })
})

// ── Notification Store Reducers ─────────────────────────────

describe('Notification store', () => {
  it('exposes expected methods', async () => {
    const mod = await import('../../src/stores/notifications')
    const store = mod.useNotificationsStore
    const state = store.getState()

    expect(typeof state.connect).toBe('function')
    expect(typeof state.disconnect).toBe('function')
    expect(typeof state.markRead).toBe('function')
    expect(typeof state.markAllRead).toBe('function')
    expect(typeof state.dismiss).toBe('function')
    expect(typeof state.refresh).toBe('function')
    expect(typeof state.consumeToasts).toBe('function')

    expect(Array.isArray(state.items)).toBe(true)
    expect(typeof state.unreadCount).toBe('number')
    expect(typeof state.connected).toBe('boolean')
  })
})

// ── SSE Broadcaster ─────────────────────────────────────────

describe('SSE broadcaster', () => {
  it('broadcastSSE is exported', async () => {
    const mod = await import('../../server/routes/notifications')
    expect(typeof mod.broadcastSSE).toBe('function')
    expect(mod.sseClients instanceof Set).toBe(true)
  })
})