import { describe, it, expect, beforeEach, vi } from 'vitest'

// We reset the module between tests so the store's module-level
// BroadcastChannel bootstrap (and its initial localStorage read) re-runs
// with a clean slate.
async function freshStore() {
  vi.resetModules()
  const mod = await import('@/stores/triage')
  return mod
}

describe('useTriageStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts empty when localStorage has no data', async () => {
    const { useTriageStore } = await freshStore()
    const state = useTriageStore.getState()
    expect(state.notes).toEqual([])
    expect(state.open).toBe(false)
  })

  it('adds a note with trimmed text and a timestamp', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('  review PR #42  ')
    const { notes } = useTriageStore.getState()
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe('review PR #42')
    expect(typeof notes[0].id).toBe('string')
    expect(notes[0].id.length).toBeGreaterThan(0)
    expect(typeof notes[0].createdAt).toBe('number')
  })

  it('ignores empty or whitespace-only notes', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('')
    useTriageStore.getState().addNote('   ')
    expect(useTriageStore.getState().notes).toEqual([])
  })

  it('prepends newest notes first', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('first')
    useTriageStore.getState().addNote('second')
    const texts = useTriageStore.getState().notes.map((n) => n.text)
    expect(texts).toEqual(['second', 'first'])
  })

  it('removes a note by id', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('keep me')
    useTriageStore.getState().addNote('delete me')
    const target = useTriageStore.getState().notes.find((n) => n.text === 'delete me')!
    useTriageStore.getState().removeNote(target.id)
    const remaining = useTriageStore.getState().notes.map((n) => n.text)
    expect(remaining).toEqual(['keep me'])
  })

  it('clearAll empties the list', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('a')
    useTriageStore.getState().addNote('b')
    useTriageStore.getState().clearAll()
    expect(useTriageStore.getState().notes).toEqual([])
  })

  it('toggles open state', async () => {
    const { useTriageStore } = await freshStore()
    expect(useTriageStore.getState().open).toBe(false)
    useTriageStore.getState().toggleOpen()
    expect(useTriageStore.getState().open).toBe(true)
    useTriageStore.getState().toggleOpen()
    expect(useTriageStore.getState().open).toBe(false)
  })

  it('persists notes to localStorage and restores them on reload', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().addNote('remember me')

    // Simulate a page reload: re-import the module with the same
    // localStorage. The new store instance should rehydrate.
    const { useTriageStore: reloaded } = await freshStore()
    const notes = reloaded.getState().notes
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe('remember me')
  })

  it('persists open state across reloads', async () => {
    const { useTriageStore } = await freshStore()
    useTriageStore.getState().setOpen(true)

    const { useTriageStore: reloaded } = await freshStore()
    expect(reloaded.getState().open).toBe(true)
  })

  it('drops malformed entries during rehydration without throwing', async () => {
    localStorage.setItem(
      'hermes-console:triage:v1',
      JSON.stringify([
        { id: 'ok', text: 'valid', createdAt: 123 },
        { id: 42, text: 'bad id' },
        null,
        'not an object',
      ]),
    )
    const { useTriageStore } = await freshStore()
    const notes = useTriageStore.getState().notes
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe('valid')
  })

  it('tolerates corrupt JSON in localStorage', async () => {
    localStorage.setItem('hermes-console:triage:v1', '{not json')
    const { useTriageStore } = await freshStore()
    expect(useTriageStore.getState().notes).toEqual([])
  })
})
