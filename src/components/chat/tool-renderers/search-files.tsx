import { HeaderRow, JsonFallback, safeParse, truncate } from './common';

interface SearchMatch {
  file?: string;
  path?: string;
  line?: number;
  line_number?: number;
  text?: string;
  match?: string;
}

interface SearchFilesResult {
  matches?: SearchMatch[];
  files?: string[];
  total_count?: number;
  error?: string | null;
}

interface Props {
  raw: string;
}

export default function SearchFilesRenderer({ raw }: Props) {
  const parsed = safeParse<SearchFilesResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  if (parsed.error) {
    return (
      <div className="font-label text-xs text-error whitespace-pre-wrap">
        {parsed.error}
      </div>
    );
  }

  const matches = Array.isArray(parsed.matches) ? parsed.matches : undefined;
  const files = Array.isArray(parsed.files) ? parsed.files : undefined;

  // file-list mode
  if (!matches && files) {
    const count = parsed.total_count ?? files.length;
    return (
      <div>
        <HeaderRow
          left={
            <span className="font-label text-[11px] text-on-surface-variant">
              {count} {count === 1 ? 'file' : 'files'}
            </span>
          }
        />
        <div className="bg-surface-container-lowest p-3 font-mono text-xs space-y-0.5 max-h-96 overflow-auto">
          {files.length === 0 ? (
            <div className="opacity-60">(no results)</div>
          ) : (
            files.map((f, i) => (
              <div key={i} className="text-on-surface-variant truncate">
                {f}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // match-list mode
  if (matches) {
    const count = parsed.total_count ?? matches.length;
    return (
      <div>
        <HeaderRow
          left={
            <span className="font-label text-[11px] text-on-surface-variant">
              {count} {count === 1 ? 'match' : 'matches'}
            </span>
          }
        />
        <div className="bg-surface-container-lowest p-3 text-xs space-y-1.5 max-h-96 overflow-auto">
          {matches.length === 0 ? (
            <div className="opacity-60 font-label">(no results)</div>
          ) : (
            matches.map((m, i) => {
              const file = m.file ?? m.path ?? '';
              const lineNum = m.line ?? m.line_number;
              const text = m.text ?? m.match ?? '';
              return (
                <div key={i}>
                  <div className="font-mono text-[11px] text-on-surface-variant/80 truncate">
                    {file}
                    {typeof lineNum === 'number' && `:${lineNum}`}
                  </div>
                  {text && (
                    <div className="font-mono text-xs text-on-surface whitespace-pre-wrap break-all">
                      {truncate(text, 200)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return <JsonFallback raw={raw} />;
}
