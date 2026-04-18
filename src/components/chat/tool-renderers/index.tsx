import type { JSX } from 'react';
import { JsonFallback } from './common';
import TerminalRenderer from './terminal';
import ReadFileRenderer from './read-file';
import WriteFileRenderer from './write-file';
import PatchRenderer from './patch';
import SearchFilesRenderer from './search-files';
import WebSearchRenderer from './web-search';
import WebExtractRenderer from './web-extract';
import ExecuteCodeRenderer from './execute-code';

/**
 * Dispatch a tool result to its dedicated renderer, falling back to
 * pretty-printed JSON when the tool is unknown or the result shape is
 * malformed.
 *
 * `args` is the JSON-encoded arguments string for the *same* tool call
 * (some renderers — e.g. terminal, read_file — need it to show context
 * that isn't present in the result payload).
 */
export function renderToolResult(
  toolName: string | null | undefined,
  rawResult: string,
  args?: string,
): JSX.Element {
  // Defensive: every renderer must survive malformed input. They each
  // return <JsonFallback/> on parse failure, but we still guard here in
  // case a renderer itself throws for any reason (e.g. unexpected
  // non-object top-level JSON).
  try {
    switch (toolName) {
      case 'terminal':
        return <TerminalRenderer raw={rawResult} args={args} />;
      case 'read_file':
        return <ReadFileRenderer raw={rawResult} args={args} />;
      case 'write_file':
        return <WriteFileRenderer raw={rawResult} args={args} />;
      case 'patch':
        return <PatchRenderer raw={rawResult} />;
      case 'search_files':
        return <SearchFilesRenderer raw={rawResult} />;
      case 'web_search':
        return <WebSearchRenderer raw={rawResult} />;
      case 'web_extract':
        return <WebExtractRenderer raw={rawResult} />;
      case 'execute_code':
        return <ExecuteCodeRenderer raw={rawResult} />;
      default:
        return <JsonFallback raw={rawResult} />;
    }
  } catch {
    return <JsonFallback raw={rawResult} />;
  }
}
