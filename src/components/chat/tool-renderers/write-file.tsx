import { Check, AlertCircle } from 'lucide-react';
import { JsonFallback, argValue, safeParse } from './common';

interface WriteFileResult {
  success?: boolean;
  path?: string;
  bytes_written?: number;
  error?: string | null;
}

interface Props {
  raw: string;
  args?: string;
}

export default function WriteFileRenderer({ raw, args }: Props) {
  const parsed = safeParse<WriteFileResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  const path = parsed.path ?? argValue(args, 'path');
  const bytes =
    typeof parsed.bytes_written === 'number'
      ? parsed.bytes_written
      : argValue(args, 'content')?.length;

  // Error path
  if (parsed.error || parsed.success === false) {
    return (
      <div className="flex items-start gap-1.5 font-label text-xs text-error">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="whitespace-pre-wrap break-all">
          {parsed.error ?? 'write_file failed'}
          {path && <span className="opacity-80"> — {path}</span>}
        </span>
      </div>
    );
  }

  // Need at least a path to produce the compact success line.
  if (!path) return <JsonFallback raw={raw} />;

  return (
    <div className="flex items-center gap-1.5 font-label text-xs text-on-surface-variant">
      <Check className="w-3.5 h-3.5 shrink-0 text-tertiary" />
      <span className="truncate">
        Wrote{' '}
        {typeof bytes === 'number' ? (
          <span className="text-on-surface">{bytes} bytes</span>
        ) : (
          <span className="opacity-70">content</span>
        )}{' '}
        to <span className="font-mono text-on-surface">{path}</span>
      </span>
    </div>
  );
}
