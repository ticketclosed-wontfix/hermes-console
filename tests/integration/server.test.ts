import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import Database from 'better-sqlite3'
import http from 'http'
import { AddressInfo } from 'net'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Point routes at a temp DB BEFORE importing the app.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-itest-'))
const DB_PATH = path.join(tmpDir, 'state.db')
process.env.HERMES_STATE_DB = DB_PATH

// Create schema up-front so the router's `fileMustExist: true` passes.
function initSchema(dbPath: string) {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      user_id TEXT,
      model TEXT,
      model_config TEXT,
      system_prompt TEXT,
      parent_session_id TEXT,
      started_at REAL NOT NULL,
      ended_at REAL,
      end_reason TEXT,
      message_count INTEGER DEFAULT 0,
      tool_call_count INTEGER DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      billing_provider TEXT,
      billing_base_url TEXT,
      billing_mode TEXT,
      estimated_cost_usd REAL,
      actual_cost_usd REAL,
      cost_status TEXT,
      cost_source TEXT,
      pricing_version TEXT,
      title TEXT
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT,
      tool_call_id TEXT,
      tool_calls TEXT,
      tool_name TEXT,
      timestamp REAL NOT NULL,
      token_count INTEGER,
      finish_reason TEXT,
      reasoning TEXT,
      reasoning_details TEXT,
      codex_reasoning_items TEXT
    );
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      content, content=messages, content_rowid=id
    );
    CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `)
  db.close()
}
initSchema(DB_PATH)

// Import AFTER env + DB are set.
const { createApp } = await import('../../server/production.ts')

// Small mock gateway server that records the last Authorization header.
let mockGateway: http.Server
let mockGatewayUrl: string
const recorded: { lastAuth: string | null; hits: number } = {
  lastAuth: null,
  hits: 0,
}

beforeAll(async () => {
  mockGateway = http.createServer((req, res) => {
    recorded.lastAuth = (req.headers['authorization'] as string) || null
    recorded.hits += 1
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      ;(recorded as any).lastBody = body
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: 'chatcmpl-mock',
          choices: [{ message: { role: 'assistant', content: 'pong' } }],
          echo: body,
        }),
      )
    })
  })
  await new Promise<void>((resolve) => mockGateway.listen(0, '127.0.0.1', resolve))
  const addr = mockGateway.address() as AddressInfo
  mockGatewayUrl = `http://127.0.0.1:${addr.port}`
})

afterAll(() => {
  mockGateway?.close()
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {}
})

beforeEach(() => {
  // Wipe sessions rows between tests.
  const db = new Database(DB_PATH)
  db.exec('DELETE FROM messages; DELETE FROM sessions;')
  db.close()
  recorded.lastAuth = null
  recorded.hits = 0
})

const TEST_KEY = 'test-api-key-xyz'

describe('server integration — /api/sessions', () => {
  it('POST /api/sessions creates a row and returns the session', async () => {
    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app)
      .post('/api/sessions')
      .send({ source: 'workspace', model: 'hermes-agent' })
      .expect(200)

    expect(res.body.session).toBeDefined()
    expect(res.body.session.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.session.source).toBe('workspace')

    const db = new Database(DB_PATH, { readonly: true })
    const row = db
      .prepare('SELECT id FROM sessions WHERE id = ?')
      .get(res.body.session.id)
    db.close()
    expect(row).toBeTruthy()
  })

  it('GET /api/sessions lists newly created sessions', async () => {
    const app = createApp({ apiKey: '', skipStatic: true })
    await request(app)
      .post('/api/sessions')
      .send({ source: 'workspace', model: 'hermes-agent', title: 'alpha' })
      .expect(200)
    await request(app)
      .post('/api/sessions')
      .send({ source: 'workspace', model: 'hermes-agent', title: 'beta' })
      .expect(200)

    const res = await request(app).get('/api/sessions').expect(200)
    expect(res.body.total).toBe(2)
    expect(res.body.items).toHaveLength(2)
  })
})

describe('server integration — /api/sessions?kind filter', () => {
  // Seed a representative row per source, then assert each tab filter
  // returns only the expected subset.
  function seedSession(id: string, source: string, startedAt: number, firstUserMsg?: string) {
    const db = new Database(DB_PATH)
    db.prepare(
      `INSERT INTO sessions (id, source, started_at, message_count) VALUES (?, ?, ?, 0)`
    ).run(id, source, startedAt)
    if (firstUserMsg) {
      db.prepare(
        `INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, 'user', ?, ?)`
      ).run(id, firstUserMsg, startedAt + 1)
    }
    db.close()
  }

  it('kind=chats returns CLI/telegram/workspace but not cron/webhook/delegate', async () => {
    seedSession('cli-1', 'cli', 1000)
    seedSession('tg-1', 'telegram', 1001)
    seedSession('ws-1', 'workspace', 1002)
    seedSession('cron-1', 'cron', 1003)
    seedSession('wh-1', 'webhook', 1004, 'GitHub event on foo/bar')
    seedSession('del-1', 'delegate', 1005)

    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app).get('/api/sessions?kind=chats').expect(200)

    const ids = res.body.items.map((s: { id: string }) => s.id).sort()
    expect(ids).toEqual(['cli-1', 'tg-1', 'ws-1'])
    expect(res.body.total).toBe(3)
  })

  it('kind=cron returns only cron sessions', async () => {
    seedSession('cli-1', 'cli', 1000)
    seedSession('cron-1', 'cron', 1001)
    seedSession('cron-2', 'cron', 1002)

    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app).get('/api/sessions?kind=cron').expect(200)

    const ids = res.body.items.map((s: { id: string }) => s.id).sort()
    expect(ids).toEqual(['cron-1', 'cron-2'])
    expect(res.body.total).toBe(2)
  })

  it('kind=agents returns only delegate sessions', async () => {
    seedSession('cli-1', 'cli', 1000)
    seedSession('del-1', 'delegate', 1001)
    seedSession('del-2', 'delegate', 1002)

    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app).get('/api/sessions?kind=agents').expect(200)

    const ids = res.body.items.map((s: { id: string }) => s.id).sort()
    expect(ids).toEqual(['del-1', 'del-2'])
    expect(res.body.total).toBe(2)
  })

  it('kind=github returns only webhook sessions whose first msg mentions GitHub', async () => {
    seedSession('wh-gh', 'webhook', 1000, 'GitHub event on org/repo')
    seedSession('wh-other', 'webhook', 1001, 'Stripe invoice.paid payload')
    seedSession('cli-1', 'cli', 1002, 'hello')

    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app).get('/api/sessions?kind=github').expect(200)

    const ids = res.body.items.map((s: { id: string }) => s.id)
    expect(ids).toEqual(['wh-gh'])
    expect(res.body.total).toBe(1)
  })

  it('kind is ignored if invalid — behaves like no filter', async () => {
    seedSession('cli-1', 'cli', 1000)
    seedSession('cron-1', 'cron', 1001)

    const app = createApp({ apiKey: '', skipStatic: true })
    const res = await request(app).get('/api/sessions?kind=bogus').expect(200)
    expect(res.body.total).toBe(2)
  })
})

describe('server integration — SPA fallback', () => {
  it('unknown non-API GET returns index.html content when static is enabled', async () => {
    const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-dist-'))
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>HERMES_SPA_OK</body></html>')
    try {
      const app = createApp({ apiKey: '', distDir })
      const res = await request(app).get('/some/unknown/route').expect(200)
      expect(res.text).toContain('HERMES_SPA_OK')
    } finally {
      fs.rmSync(distDir, { recursive: true, force: true })
    }
  })
})

describe('server integration — /api is NOT gated by the gateway bearer', () => {
  // Regression: previously a /api auth middleware existed but was dead code
  // (API_KEY was ''), so the browser's same-origin /api calls worked. After
  // fixing the env var name the middleware would have activated and locked
  // the browser out. We removed it entirely — verify /api stays reachable
  // even when a gateway API_KEY is configured.
  it('allows /api/sessions with no auth even when API_KEY is set', async () => {
    const app = createApp({ apiKey: TEST_KEY, skipStatic: true })
    await request(app).get('/api/sessions').expect(200)
  })

  it('allows /api/sessions with an unrelated bearer when API_KEY is set', async () => {
    const app = createApp({ apiKey: TEST_KEY, skipStatic: true })
    await request(app)
      .get('/api/sessions')
      .set('Authorization', 'Bearer whatever')
      .expect(200)
  })

  it('allows /api when API_KEY is empty', async () => {
    const app = createApp({ apiKey: '', skipStatic: true })
    await request(app).get('/api/sessions').expect(200)
  })
})

describe('server integration — gateway proxy forwards the correct auth', () => {
  // THIS IS THE TEST THAT WOULD HAVE CAUGHT THE HERMES_API_KEY vs API_SERVER_KEY BUG.
  // It asserts that whatever API_SERVER_KEY is set in env, THAT exact value flows
  // into the Authorization header forwarded to the upstream gateway.
  it('forwards Bearer API_SERVER_KEY on /v1 proxied requests', async () => {
    const key = 'server-key-from-env-9999'
    // Simulate env-driven config by using opts.apiKey; separately verify the
    // env-based code path too.
    const app = createApp({ apiKey: key, gatewayUrl: mockGatewayUrl, skipStatic: true })

    const res = await request(app)
      .post('/v1/chat/completions')
      .send({ model: 'hermes-agent', messages: [{ role: 'user', content: 'ping' }] })
      .expect(200)

    expect(res.body.choices[0].message.content).toBe('pong')
    expect(recorded.hits).toBe(1)
    expect(recorded.lastAuth).toBe(`Bearer ${key}`)
    // Regression: express.json() consumed the body; without fixRequestBody the
    // upstream receives "" and returns 400/404. Assert body made it through.
    const echoed = JSON.parse((recorded as any).lastBody)
    expect(echoed.messages[0].content).toBe('ping')
  })

  it('env API_SERVER_KEY is read by createApp() when not explicitly passed', async () => {
    // This is the regression test for the actual bug:
    // .env uses API_SERVER_KEY, the server must read that var.
    const prev = process.env.API_SERVER_KEY
    process.env.API_SERVER_KEY = 'env-driven-key-abc'
    try {
      const app = createApp({ gatewayUrl: mockGatewayUrl, skipStatic: true })
      await request(app)
        .post('/v1/chat/completions')
        .send({ model: 'hermes-agent', messages: [{ role: 'user', content: 'ping' }] })
        .expect(200)
      expect(recorded.lastAuth).toBe('Bearer env-driven-key-abc')
    } finally {
      if (prev === undefined) delete process.env.API_SERVER_KEY
      else process.env.API_SERVER_KEY = prev
    }
  })

  it('legacy HERMES_API_KEY is still honored as a fallback', async () => {
    const prevA = process.env.API_SERVER_KEY
    const prevH = process.env.HERMES_API_KEY
    delete process.env.API_SERVER_KEY
    process.env.HERMES_API_KEY = 'legacy-key-123'
    try {
      const app = createApp({ gatewayUrl: mockGatewayUrl, skipStatic: true })
      await request(app)
        .post('/v1/chat/completions')
        .send({ model: 'hermes-agent', messages: [{ role: 'user', content: 'ping' }] })
        .expect(200)
      expect(recorded.lastAuth).toBe('Bearer legacy-key-123')
    } finally {
      if (prevA === undefined) delete process.env.API_SERVER_KEY
      else process.env.API_SERVER_KEY = prevA
      if (prevH === undefined) delete process.env.HERMES_API_KEY
      else process.env.HERMES_API_KEY = prevH
    }
  })
})
