// Regression tests for enrichToolNames() — a render-time workaround for a
// hermes-agent gateway bug where role='tool' rows persist with empty/NULL
// tool_name. Without enrichment the ToolCallBlock dispatcher can't pick a
// per-tool renderer (TerminalRenderer, WebSearchRenderer, …) and falls
// through to raw JSON.
//
// Enrichment derives toolName from the preceding assistant message's
// tool_calls JSON array. Match strategy:
//   1. By tool_call_id when present on BOTH sides (DB rows).
//   2. Positional fallback — Nth tool row after an assistant maps to the
//      Nth {name} entry in that assistant's tool_calls array.

import { describe, it, expect } from 'vitest'
import { enrichToolNames, type ChatMessage } from '@/stores/chat'

function mkAssistant(
  id: string,
  calls: Array<{ id?: string; name: string; args?: unknown }>,
): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    timestamp: 0,
    toolCalls: JSON.stringify(
      calls.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        name: c.name,
        arguments: JSON.stringify(c.args ?? {}),
      })),
    ),
  }
}

function mkTool(id: string, toolCallId: string | null, content = '{}'): ChatMessage {
  return {
    id,
    role: 'tool',
    content,
    timestamp: 0,
    toolCallId,
  }
}

describe('enrichToolNames', () => {
  it('matches by tool_call_id when present on both sides', () => {
    const msgs: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 0 },
      mkAssistant('a1', [
        { id: 'call_a', name: 'terminal' },
        { id: 'call_b', name: 'web_search' },
      ]),
      mkTool('t1', 'call_b'),
      mkTool('t2', 'call_a'),
    ]
    const out = enrichToolNames(msgs)
    expect(out[2].toolName).toBe('web_search')
    expect(out[3].toolName).toBe('terminal')
  })

  it('falls back to positional match when tool_call_id is missing', () => {
    const msgs: ChatMessage[] = [
      mkAssistant('a1', [
        { name: 'terminal' },
        { name: 'read_file' },
        { name: 'patch' },
      ]),
      mkTool('t1', null),
      mkTool('t2', null),
      mkTool('t3', null),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('terminal')
    expect(out[2].toolName).toBe('read_file')
    expect(out[3].toolName).toBe('patch')
  })

  it('handles a mixed case — some ids match, some fall to positional', () => {
    const msgs: ChatMessage[] = [
      mkAssistant('a1', [
        { id: 'call_x', name: 'terminal' },
        { name: 'web_search' }, // no id
      ]),
      mkTool('t1', null),         // no id on tool side either -> positional (0 -> terminal)
      mkTool('t2', 'call_x'),     // id match -> terminal (even though already consumed positionally)
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('terminal')   // positional 0
    expect(out[2].toolName).toBe('terminal')   // id match wins
  })

  it('gracefully skips tool rows with no preceding assistant', () => {
    const msgs: ChatMessage[] = [
      mkTool('t1', null),
      { id: 'u1', role: 'user', content: 'hi', timestamp: 0 },
      mkTool('t2', 'call_orphan'),
    ]
    const out = enrichToolNames(msgs)
    expect(out[0].toolName).toBeUndefined()
    expect(out[2].toolName).toBeUndefined()
  })

  it('preserves already-populated toolName (no overwrite)', () => {
    const msgs: ChatMessage[] = [
      mkAssistant('a1', [{ id: 'call_a', name: 'terminal' }]),
      { ...mkTool('t1', 'call_a'), toolName: 'preset-name' },
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('preset-name')
  })

  it('advances the positional cursor even past already-populated rows', () => {
    // If a tool row already has toolName, the cursor must still tick so
    // subsequent positional matches line up with the right tool_calls entry.
    const msgs: ChatMessage[] = [
      mkAssistant('a1', [
        { name: 'terminal' },
        { name: 'read_file' },
      ]),
      { ...mkTool('t1', null), toolName: 'already-set' },
      mkTool('t2', null),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('already-set')
    expect(out[2].toolName).toBe('read_file')
  })

  it('returns the same array reference when nothing changes (no-op)', () => {
    const msgs: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 0 },
      { id: 'a1', role: 'assistant', content: 'hello', timestamp: 0 },
    ]
    const out = enrichToolNames(msgs)
    expect(out).toBe(msgs)
  })

  it('survives malformed tool_calls JSON without throwing', () => {
    const msgs: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        timestamp: 0,
        toolCalls: 'not valid json{',
      },
      mkTool('t1', null),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBeUndefined()
  })

  it('handles multiple assistant turns and resets the positional cursor', () => {
    const msgs: ChatMessage[] = [
      mkAssistant('a1', [{ name: 'terminal' }]),
      mkTool('t1', null),
      mkAssistant('a2', [{ name: 'web_search' }, { name: 'read_file' }]),
      mkTool('t2', null),
      mkTool('t3', null),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('terminal')
    expect(out[3].toolName).toBe('web_search')
    expect(out[4].toolName).toBe('read_file')
  })

  it('parses the OpenAI-function shape stored by the hermes gateway', () => {
    // Actual DB shape as of 2026-04-19:
    //   [{"id":"toolu_X","type":"function","function":{"name":"terminal","arguments":"..."}}]
    const msgs: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        timestamp: 0,
        toolCalls: JSON.stringify([
          {
            id: 'toolu_X',
            type: 'function',
            function: { name: 'terminal', arguments: '{}' },
          },
          {
            id: 'toolu_Y',
            type: 'function',
            function: { name: 'read_file', arguments: '{}' },
          },
        ]),
      },
      mkTool('t1', 'toolu_Y'),
      mkTool('t2', 'toolu_X'),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('read_file')
    expect(out[2].toolName).toBe('terminal')
  })

  it('positional fallback also works with OpenAI-function shape', () => {
    const msgs: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        timestamp: 0,
        toolCalls: JSON.stringify([
          { type: 'function', function: { name: 'web_search', arguments: '{}' } },
          { type: 'function', function: { name: 'patch', arguments: '{}' } },
        ]),
      },
      mkTool('t1', null),
      mkTool('t2', null),
    ]
    const out = enrichToolNames(msgs)
    expect(out[1].toolName).toBe('web_search')
    expect(out[2].toolName).toBe('patch')
  })
})
