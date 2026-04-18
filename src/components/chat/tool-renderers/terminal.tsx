import {
  ExitCodeBadge,
  HeaderRow,
  JsonFallback,
  MonoBlock,
  argValue,
  safeParse,
} from './common';

interface TerminalResult {
  output?: string;
  exit_code?: number;
  error?: string | null;
}

interface Props {
  raw: string;
  args?: string;
}

export default function TerminalRenderer({ raw, args }: Props) {
  const parsed = safeParse<TerminalResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  const command = argValue(args, 'command') ?? '';
  const exitCode = typeof parsed.exit_code === 'number' ? parsed.exit_code : undefined;
  const output = typeof parsed.output === 'string' ? parsed.output : '';
  const error = parsed.error ?? null;

  return (
    <div>
      <HeaderRow
        left={
          <span className="font-mono text-xs text-on-surface-variant">
            {command ? <>$ {command}</> : <span className="opacity-60">$</span>}
          </span>
        }
        right={exitCode !== undefined ? <ExitCodeBadge code={exitCode} /> : undefined}
      />
      <MonoBlock>{output || <span className="opacity-50">(no output)</span>}</MonoBlock>
      {error && (
        <div className="mt-1.5 font-label text-xs text-error whitespace-pre-wrap">
          {error}
        </div>
      )}
    </div>
  );
}
