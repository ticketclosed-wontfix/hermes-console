import { HeaderRow, JsonFallback, safeParse } from './common';

interface WebHit {
  url?: string;
  title?: string;
  description?: string;
}

interface WebSearchResult {
  data?: { web?: WebHit[] };
  error?: string | null;
}

interface Props {
  raw: string;
}

export default function WebSearchRenderer({ raw }: Props) {
  const parsed = safeParse<WebSearchResult>(raw);
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

  const hits = parsed.data?.web;
  if (!Array.isArray(hits)) return <JsonFallback raw={raw} />;

  return (
    <div>
      <HeaderRow
        left={
          <span className="font-label text-[11px] text-on-surface-variant">
            {hits.length} {hits.length === 1 ? 'result' : 'results'}
          </span>
        }
      />
      <div className="space-y-2 max-h-96 overflow-auto">
        {hits.length === 0 ? (
          <div className="font-label text-xs opacity-60">(no results)</div>
        ) : (
          hits.map((h, i) => (
            <div
              key={i}
              className="bg-surface-container-lowest border border-outline-variant/10 rounded p-2"
            >
              {h.title && (
                <div className="font-label text-xs font-bold text-on-surface truncate">
                  {h.title}
                </div>
              )}
              {h.url && (
                <div className="font-mono text-[10px] text-on-surface-variant/70 truncate">
                  {h.url}
                </div>
              )}
              {h.description && (
                <div
                  className="font-label text-xs text-on-surface-variant mt-1 overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {h.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
