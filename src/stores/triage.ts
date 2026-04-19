import { create } from 'zustand'

// Persistent triage / todo notes.
//
// Scope: quick jot-down list for things the user wants to remember while
// working. Not tied to a session, kept across reloads AND synchronised
// across every open tab/window via BroadcastChannel so the user sees the
// same list no matter which console they type into.
//
// Storage: localStorage (single origin, small payload — plenty for a
// triage list).  If localStorage is unavailable (SSR, private mode edge
// cases) the store still works in memory.

export type TriageNote = {
  id: string
  text: string
  createdAt: number // unix millis
}

export type TriageState = {
  notes: TriageNote[]
  open: boolean

  addNote: (text: string) => void
  removeNote: (id: string) => void
  clearAll: () => void
  setOpen: (open: boolean) => void
  toggleOpen: () => void
}

const STORAGE_KEY = 'hermes-console:triage:v1'
const OPEN_KEY = 'hermes-console:triage-open:v1'
const CHANNEL_NAME = 'hermes-console:triage'

type BroadcastMsg =
  | { type: 'notes'; notes: TriageNote[] }
  | { type: 'open'; open: boolean }

function readNotes(): TriageNote[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Minimal shape validation — drop anything malformed rather than blow up.
    return parsed.filter(
      (n): n is TriageNote =>
        n && typeof n.id === 'string' && typeof n.text === 'string' && typeof n.createdAt === 'number',
    )
  } catch {
    return []
  }
}

function readOpen(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeNotes(notes: TriageNote[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    // Quota or access errors — ignore, we still keep in-memory state.
  }
}

function writeOpen(open: boolean) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

// Lazily-constructed BroadcastChannel. `null` when the API isn't available
// (older browsers / test envs).  We also suppress echoing of our own
// posts by tracking whether the current mutation came from a remote event.
let channel: BroadcastChannel | null = null
let applyingRemote = false

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = null
  }
  return channel
}

function broadcast(msg: BroadcastMsg) {
  if (applyingRemote) return
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage(msg)
  } catch {
    // ignore
  }
}

function genId(): string {
  // crypto.randomUUID is available in all modern browsers we target (React
  // 19 + Vite 8) but fall back just in case.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export const useTriageStore = create<TriageState>((set, get) => ({
  notes: readNotes(),
  open: readOpen(),

  addNote: (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const note: TriageNote = {
      id: genId(),
      text: trimmed,
      createdAt: Date.now(),
    }
    // Newest first — matches how a triage list is normally scanned.
    const notes = [note, ...get().notes]
    set({ notes })
    writeNotes(notes)
    broadcast({ type: 'notes', notes })
  },

  removeNote: (id: string) => {
    const notes = get().notes.filter((n) => n.id !== id)
    set({ notes })
    writeNotes(notes)
    broadcast({ type: 'notes', notes })
  },

  clearAll: () => {
    set({ notes: [] })
    writeNotes([])
    broadcast({ type: 'notes', notes: [] })
  },

  setOpen: (open: boolean) => {
    set({ open })
    writeOpen(open)
    broadcast({ type: 'open', open })
  },

  toggleOpen: () => {
    const open = !get().open
    set({ open })
    writeOpen(open)
    broadcast({ type: 'open', open })
  },
}))

// Wire up cross-window sync. We do this at module load so every window
// that imports the store joins the channel automatically.
if (typeof window !== 'undefined') {
  const ch = getChannel()
  if (ch) {
    ch.onmessage = (ev: MessageEvent<BroadcastMsg>) => {
      const msg = ev.data
      if (!msg || typeof msg !== 'object') return
      applyingRemote = true
      try {
        if (msg.type === 'notes' && Array.isArray(msg.notes)) {
          useTriageStore.setState({ notes: msg.notes })
          writeNotes(msg.notes)
        } else if (msg.type === 'open' && typeof msg.open === 'boolean') {
          useTriageStore.setState({ open: msg.open })
          writeOpen(msg.open)
        }
      } finally {
        applyingRemote = false
      }
    }
  }

  // Fallback sync path for browsers without BroadcastChannel: listen for
  // the `storage` event, which fires in *other* tabs when localStorage is
  // mutated. Harmless to run alongside BroadcastChannel.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      useTriageStore.setState({ notes: readNotes() })
    } else if (e.key === OPEN_KEY) {
      useTriageStore.setState({ open: readOpen() })
    }
  })
}
