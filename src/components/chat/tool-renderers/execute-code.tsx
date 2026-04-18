import {
  ExitCodeBadge,
  HeaderRow,
  JsonFallback,
  MonoBlock,
  safeParse,
} from './common';

interface ExecuteCodeResult {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error?: string | null;
}

interface Props {
  raw: string;
}

export default function ExecuteCodeRenderer({ raw }: Props) {
  const parsed = safeParse<ExecuteCodeResult>(raw);
  if (!parsed || typeof parsed !== 'object') {
    return <JsonFallback raw={raw} />;
  }

  const stdout = typeof parsed.stdout === 'string' ? parsed.stdout : '';
  const stderr = typeof parsed.stderr === 'string' ? parsed.stderr : '';
  const exitCode =
    typeof parsed.exit_code === 'number' ? parsed.exit_code : undefined;

  return (
    <div>
      <HeaderRow
        left={
          <span className="font-label text-[11px] text-on-surface-variant">
            Python script
          </span>
        }
        right={exitCode !== undefined ? <ExitCodeBadge code={exitCode} /> : undefined}
      />
      {stdout ? (
        <MonoBlock>{stdout}</MonoBlock>
      ) : !stderr && !parsed.error ? (
        <MonoBlock>
          <span className="opacity-50">(no output)</span>
        </MonoBlock>
      ) : null}
      {stderr && (
        <div className="mt-1.5">
          <div className="font-label text-[10px] text-error/80 mb-0.5">stderr</div>
          <MonoBlock className="!text-error">{stderr}</MonoBlock>
        </div>
      )}
      {parsed.error && (
        <div className="mt-1.5 font-label text-xs text-error whitespace-pre-wrap">
          {parsed.error}
        </div>
      )}
    </div>
  );
}
