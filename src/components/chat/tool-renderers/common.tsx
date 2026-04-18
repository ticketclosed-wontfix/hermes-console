import type { ReactNode } from 'react';

/**
 * Shared helpers and tiny primitives for tool-result renderers.
 *
 * Every renderer sticks to the existing Material-style token classes
 * (`bg-surface-container-lowest`, `text-on-surface-variant`, `font-label`,
 *  `text-tertiary`, `text-error`, `border-outline-variant`, etc.).
 * Do not introduce new color tokens here.
 */

/** Safe JSON.parse that never throws. Returns undefined on failure. */
export function safeParse<T = unknown>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Pretty-print a (possibly non-JSON) string with 2-space indent. */
export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Clamp a string to `max` chars, appending an ellipsis if truncated. */
export function truncate(str: string, max = 200): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

/** Render a raw JSON blob (current/legacy behavior). */
export function JsonFallback({ raw }: { raw: string }) {
  return <MonoBlock>{prettyJson(raw)}</MonoBlock>;
}

interface MonoBlockProps {
  children: ReactNode;
  className?: string;
}

/**
 * The standard dark mono pre block used for code/output.
 * Matches the styling previously inlined in ToolCallBlock.tsx.
 */
export function MonoBlock({ children, className = '' }: MonoBlockProps) {
  return (
    <div
      className={`bg-surface-container-lowest p-3 font-label text-xs whitespace-pre-wrap overflow-x-auto overflow-y-auto max-h-96 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

interface ExitCodeBadgeProps {
  code: number;
}

/** Green pill for exit 0, red for anything else. */
export function ExitCodeBadge({ code }: ExitCodeBadgeProps) {
  const ok = code === 0;
  const cls = ok
    ? 'text-tertiary border-tertiary/40'
    : 'text-error border-error/40';
  return (
    <span
      className={`font-label text-[10px] font-bold tracking-tight px-1.5 py-0.5 rounded border ${cls}`}
    >
      exit {code}
    </span>
  );
}

interface PillProps {
  children: ReactNode;
  tone?: 'default' | 'warn';
}

/** Small neutral pill used for flags like "truncated". */
export function Pill({ children, tone = 'default' }: PillProps) {
  const cls =
    tone === 'warn'
      ? 'text-error border-error/40'
      : 'text-on-surface-variant border-outline-variant/40';
  return (
    <span
      className={`font-label text-[10px] font-bold tracking-tight px-1.5 py-0.5 rounded border ${cls}`}
    >
      {children}
    </span>
  );
}

interface HeaderRowProps {
  left: ReactNode;
  right?: ReactNode;
}

/** Flex row used as a renderer sub-header. */
export function HeaderRow({ left, right }: HeaderRowProps) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="flex-1 min-w-0 font-label text-[11px] text-on-surface-variant truncate">
        {left}
      </div>
      {right !== undefined && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** Extract a value from a JSON args blob. Safe; returns undefined on miss. */
export function argValue(args: string | undefined, key: string): string | undefined {
  if (!args) return undefined;
  const parsed = safeParse<Record<string, unknown>>(args);
  if (!parsed) return undefined;
  const v = parsed[key];
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return undefined;
  return String(v);
}
