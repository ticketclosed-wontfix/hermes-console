import { useEffect, useRef, useState } from 'react'
import { ListTodo, Plus, Trash2, X, ChevronRight } from 'lucide-react'
import { useTriageStore, type TriageNote } from '@/stores/triage'

// Persistent right-hand triage panel.  Always mounted in the root
// layout; when collapsed it shrinks to a narrow rail with a toggle + the
// current note count so it's still one click away from any screen.
//
// Adding: Enter key or the + button.  Removing: per-item × button.
// State (notes + open/closed) is persisted and synced across windows
// via the triage store.

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function TriageSidebar() {
  const { notes, open, addNote, removeNote, clearAll, setOpen } = useTriageStore()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // When the panel opens, put focus in the input so the user can just
  // start typing — the whole point is "jot it down fast".
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    if (!draft.trim()) return
    addNote(draft)
    setDraft('')
  }

  if (!open) {
    return (
      <aside
        className="w-10 h-screen bg-surface-container-low border-l border-outline-variant/20 flex flex-col items-center py-3 shrink-0"
        aria-label="Triage notes (collapsed)"
      >
        <button
          onClick={() => setOpen(true)}
          title="Open triage notes"
          className="flex flex-col items-center gap-1 p-2 rounded-md text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high transition-colors"
          data-testid="triage-toggle-open"
        >
          <ListTodo size={16} strokeWidth={1.75} />
          <span className="font-label text-[9px] tracking-widest uppercase leading-none">
            TRI
          </span>
          {notes.length > 0 && (
            <span className="mt-1 text-[9px] font-label bg-primary/20 text-primary px-1 rounded-sm">
              {notes.length}
            </span>
          )}
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="w-[260px] h-screen bg-surface-container-low border-l border-outline-variant/20 flex flex-col shrink-0"
      aria-label="Triage notes"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ListTodo size={14} className="text-primary" strokeWidth={2.25} />
        <span className="font-headline font-black text-primary tracking-tighter text-sm">
          TRIAGE
        </span>
        <span className="ml-auto text-[9px] font-label tracking-widest uppercase bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
          {notes.length}
        </span>
        <button
          onClick={() => setOpen(false)}
          title="Collapse triage panel"
          className="text-on-surface-variant/50 hover:text-on-surface transition-colors"
          data-testid="triage-toggle-close"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Quick-add input */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-md pr-1 focus-within:ring-1 focus-within:ring-primary/40">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="JOT IT DOWN"
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase pl-3 py-2 outline-none"
            data-testid="triage-input"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            title="Add note (Enter)"
            className="p-1 rounded text-on-surface-variant/60 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            data-testid="triage-add"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        {notes.length === 0 ? (
          <div className="text-on-surface-variant/40 text-[10px] font-label tracking-widest uppercase text-center py-8">
            No notes yet
          </div>
        ) : (
          notes.map((note: TriageNote) => (
            <div
              key={note.id}
              className="group relative mb-1 px-2.5 py-2 rounded-md text-on-surface-variant/80 hover:bg-surface-container-high transition-colors"
            >
              <div className="text-xs leading-snug pr-6 whitespace-pre-wrap break-words">
                {note.text}
              </div>
              <div className="mt-1 text-[9px] text-on-surface-variant/50 font-label tracking-widest uppercase">
                {formatRelativeTime(note.createdAt)}
              </div>
              <button
                onClick={() => removeNote(note.id)}
                title="Remove note"
                className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
                data-testid={`triage-remove-${note.id}`}
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notes.length > 0 && (
        <div className="border-t border-outline-variant/20 px-3 py-2">
          <button
            onClick={() => {
              if (confirm('Clear all triage notes?')) clearAll()
            }}
            className="w-full flex items-center justify-center gap-1.5 text-on-surface-variant/60 hover:text-on-surface font-label text-[10px] tracking-widest uppercase py-1.5 rounded-md hover:bg-surface-container-high transition-colors"
            data-testid="triage-clear"
          >
            <Trash2 size={12} />
            CLEAR ALL
          </button>
        </div>
      )}
    </aside>
  )
}
