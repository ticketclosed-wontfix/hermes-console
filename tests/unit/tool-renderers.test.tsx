import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToolResult } from '@/components/chat/tool-renderers';

describe('renderToolResult dispatcher', () => {
  it('falls back to pretty JSON for unknown tool names', () => {
    const { container } = render(
      renderToolResult('nope_tool', '{"a":1,"b":2}'),
    );
    // Pretty-printed JSON should contain a 2-space indent
    expect(container.textContent).toContain('"a": 1');
    expect(container.textContent).toContain('"b": 2');
  });

  it('falls back when result JSON is malformed', () => {
    const { container } = render(renderToolResult('terminal', 'not-json'));
    // Unparseable strings are rendered verbatim by the fallback.
    expect(container.textContent).toContain('not-json');
  });

  it('terminal: renders $ command from args and exit code badge', () => {
    render(
      renderToolResult(
        'terminal',
        JSON.stringify({ output: 'hello world', exit_code: 0 }),
        JSON.stringify({ command: 'echo hello' }),
      ),
    );
    expect(screen.getByText(/\$ echo hello/)).toBeInTheDocument();
    expect(screen.getByText(/exit 0/)).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('terminal: shows error text in red when present', () => {
    render(
      renderToolResult(
        'terminal',
        JSON.stringify({ output: '', exit_code: 1, error: 'boom' }),
        JSON.stringify({ command: 'false' }),
      ),
    );
    expect(screen.getByText(/exit 1/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('read_file: renders path from args and total_lines', () => {
    render(
      renderToolResult(
        'read_file',
        JSON.stringify({ content: 'line1\nline2', total_lines: 2 }),
        JSON.stringify({ path: '/tmp/foo.txt' }),
      ),
    );
    expect(screen.getByText('/tmp/foo.txt')).toBeInTheDocument();
    expect(screen.getByText('2 lines')).toBeInTheDocument();
  });

  it('read_file: shows [binary file] placeholder for binary results', () => {
    render(
      renderToolResult(
        'read_file',
        JSON.stringify({ content: '', is_binary: true, file_size: 1024 }),
        JSON.stringify({ path: '/tmp/img.png' }),
      ),
    );
    expect(screen.getByText(/binary file, 1024 bytes/)).toBeInTheDocument();
  });

  it('write_file: renders compact success line', () => {
    render(
      renderToolResult(
        'write_file',
        JSON.stringify({ success: true, path: '/tmp/x.txt', bytes_written: 42 }),
      ),
    );
    expect(screen.getByText(/Wrote/)).toBeInTheDocument();
    expect(screen.getByText('42 bytes')).toBeInTheDocument();
    expect(screen.getByText('/tmp/x.txt')).toBeInTheDocument();
  });

  it('patch: color-codes +/- diff lines', () => {
    const diff = '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new\n';
    const { container } = render(
      renderToolResult('patch', JSON.stringify({ diff })),
    );
    // Both the added and removed line should be in the DOM.
    expect(container.textContent).toContain('-old');
    expect(container.textContent).toContain('+new');
  });

  it('search_files: renders match count and file:line format', () => {
    render(
      renderToolResult(
        'search_files',
        JSON.stringify({
          matches: [{ file: 'src/x.ts', line: 10, text: 'hello' }],
          total_count: 1,
        }),
      ),
    );
    expect(screen.getByText('1 match')).toBeInTheDocument();
    expect(screen.getByText('src/x.ts:10')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('search_files: handles files-only shape', () => {
    render(
      renderToolResult(
        'search_files',
        JSON.stringify({ files: ['a.ts', 'b.ts'] }),
      ),
    );
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.getByText('a.ts')).toBeInTheDocument();
    expect(screen.getByText('b.ts')).toBeInTheDocument();
  });

  it('web_search: renders title, url and description', () => {
    render(
      renderToolResult(
        'web_search',
        JSON.stringify({
          data: {
            web: [
              {
                title: 'Example',
                url: 'https://example.com',
                description: 'A description',
              },
            ],
          },
        }),
      ),
    );
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('web_extract: renders title + url and preview content', () => {
    render(
      renderToolResult(
        'web_extract',
        JSON.stringify({
          results: [
            {
              title: 'Hello',
              url: 'https://h.example',
              content: 'body text',
            },
          ],
        }),
      ),
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('https://h.example')).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });

  it('execute_code: labels as Python script and renders stdout', () => {
    render(
      renderToolResult(
        'execute_code',
        JSON.stringify({ stdout: 'hi', exit_code: 0 }),
      ),
    );
    expect(screen.getByText('Python script')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText(/exit 0/)).toBeInTheDocument();
  });
});
