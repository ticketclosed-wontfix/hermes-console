import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { HeaderRow, JsonFallback, safeParse } from './common';

interface ExtractItem {
  url?: string;
  title?: string;
  content?: string;
  error?: string | null;
}

interface WebExtractResult {
  results?: ExtractItem[];
  error?: string | null;
}

interface Props {
  raw: string;
}

const PREVIEW = 300;

function ExtractCard({ item }: { item: ExtractItem }) {
  const [open, setOpen] = useState(false);
  const content = item.content ?? '';
  const needsToggle = content.length > PREVIEW;
  const shown = open || !needsToggle ? content : content.slice(0, PREVIEW) + '…';

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded p-2">
      <button
        type="button"
        className="w-full flex items-start gap-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          {item.title && (
            <div className="font-label text-xs font-bold text-on-surface truncate">
              {item.title}
            </div>
          )}
          {item.url && (
            <div className="font-mono text-[10px] text-on-surface-variant/70 truncate">
              {item.url}
            </div>
          )}
        </div>
        {needsToggle && (
          <ChevronDown
            className={`w-3 h-3 text-on-surface-variant mt-0.5 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>
      {item.error ? (
        <div className="mt-1 font-label text-xs text-error whitespace-pre-wrap">
          {item.error}
        </div>
      ) : (
        content && (
          <div className="mt-1 font-label text-xs text-on-surface-variant whitespace-pre-wrap break-words">
            {shown}
          </div>
        )
      )}
    </div>
  );
}

export default function WebExtractRenderer({ raw }: Props) {
  const parsed = safeParse<WebExtractResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  if (parsed.error && !parsed.results) {
    return (
      <div className="font-label text-xs text-error whitespace-pre-wrap">
        {parsed.error}
      </div>
    );
  }

  const results = parsed.results;
  if (!Array.isArray(results)) return <JsonFallback raw={raw} />;

  return (
    <div>
      <HeaderRow
        left={
          <span className="font-label text-[11px] text-on-surface-variant">
            {results.length} {results.length === 1 ? 'page' : 'pages'}
          </span>
        }
      />
      <div className="space-y-2 max-h-96 overflow-auto">
        {results.length === 0 ? (
          <div className="font-label text-xs opacity-60">(no results)</div>
        ) : (
          results.map((r, i) => <ExtractCard key={i} item={r} />)
        )}
      </div>
    </div>
  );
}
