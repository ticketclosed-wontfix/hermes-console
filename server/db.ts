import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'

const DB_PATH =
  process.env.HERMES_STATE_DB || path.join(os.homedir(), '.hermes', 'state.db')

// Singleton for migrations (write-mode, creates DB if missing)
let _migrateDb: Database.Database | null = null

function getMigrateDb(): Database.Database {
  if (!_migrateDb) {
    _migrateDb = new Database(DB_PATH)
    _migrateDb.pragma('journal_mode = WAL')
  }
  return _migrateDb
}

/** Run all pending migrations. Safe to call idempotently. */
export function runMigrations() {
  const db = getMigrateDb()

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      repo TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      url TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      metadata TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT,
      dismissed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL;
  `)

  console.log('[hermes-console] migrations applied')
}

/** Return a read-only connection to state.db. Caller must close(). */
export function getDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true })
}

/** Return a read-write connection to state.db. Caller must close(). */
export function getWriteDb(): Database.Database {
  return new Database(DB_PATH, { fileMustExist: true })
}

/** Generate and log the ingest secret if missing. Returns the value. */
export function ensureIngestSecret(): string {
  const envVal = process.env.HERMES_CONSOLE_INGEST_SECRET
  if (envVal) return envVal
  const generated = randomBytes(32).toString('hex')
  console.warn(
    `[hermes-console] WARNING: HERMES_CONSOLE_INGEST_SECRET not set. ` +
    `Generated ephemeral secret (will change on restart). ` +
    `Set this in .env for the gateway to use the ingest endpoint.`
  )
  return generated
}