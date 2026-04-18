import {
  HeaderRow,
  JsonFallback,
  MonoBlock,
  Pill,
  argValue,
  safeParse,
} from './common';

interface ReadFileResult {
  content?: string;
  total_lines?: number;
  file_size?: number;
  truncated?: boolean;
  is_binary?: boolean;
  is_image?: boolean;
  error?: string | null;
}

interface Props {
  raw: string;
  args?: string;
}

export default function ReadFileRenderer({ raw, args }: Props) {
  const parsed = safeParse<ReadFileResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  const path = argValue(args, 'path') ?? '';
  const totalLines = parsed.total_lines;
  const isBinary = parsed.is_binary === true || parsed.is_image === true;
  const fileSize = parsed.file_size;
  const content = typeof parsed.content === 'string' ? parsed.content : '';

  const right = (
    <div className="flex items-center gap-1.5">
      {parsed.truncated && <Pill tone="warn">truncated</Pill>}
      {typeof totalLines === 'number' && (
        <span className="font-label text-[10px] text-on-surface-variant/70">
          {totalLines} lines
        </span>
      )}
    </div>
  );

  return (
    <div>
      <HeaderRow
        left={
          <span className="font-mono text-xs text-on-surface-variant truncate">
            {path || '(unknown path)'}
          </span>
        }
        right={right}
      />
      {parsed.error ? (
        <div className="font-label text-xs text-error whitespace-pre-wrap">
          {parsed.error}
        </div>
      ) : isBinary ? (
        <MonoBlock>
          <span className="opacity-70">
            [binary file{typeof fileSize === 'number' ? `, ${fileSize} bytes` : ''}]
          </span>
        </MonoBlock>
      ) : (
        <MonoBlock>{content}</MonoBlock>
      )}
    </div>
  );
}
