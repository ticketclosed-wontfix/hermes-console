import { JsonFallback, MonoBlock, safeParse } from './common';

interface PatchResult {
  diff?: string;
  patch?: string;
  error?: string | null;
}

interface Props {
  raw: string;
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'text-on-surface-variant/70';
  }
  if (line.startsWith('@@')) return 'text-on-surface-variant/80';
  if (line.startsWith('+')) return 'text-tertiary';
  if (line.startsWith('-')) return 'text-error';
  return 'text-on-surface-variant';
}

export default function PatchRenderer({ raw }: Props) {
  const parsed = safeParse<PatchResult>(raw);
  const diff =
    parsed && typeof parsed === 'object'
      ? parsed.diff ?? parsed.patch
      : undefined;

  if (!diff || typeof diff !== 'string') {
    return <JsonFallback raw={raw} />;
  }

  const lines = diff.split('\n');

  return (
    <div>
      {parsed?.error && (
        <div className="mb-1.5 font-label text-xs text-error whitespace-pre-wrap">
          {parsed.error}
        </div>
      )}
      <MonoBlock>
        {lines.map((line, i) => (
          <div key={i} className={lineClass(line)}>
            {line || '\u00A0'}
          </div>
        ))}
      </MonoBlock>
    </div>
  );
}
