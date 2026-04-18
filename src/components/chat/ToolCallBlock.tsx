import { useState } from 'react';
import { Terminal, Globe, FileText, Code, Wrench, ChevronDown } from 'lucide-react';
import { renderToolResult } from './tool-renderers';

interface ToolCallBlockProps {
  toolCalls: string | null;
  toolResult?: string | null;
  toolName?: string | null;
}

function getToolIcon(name: string | null | undefined) {
  if (!name) return Wrench;
  if (name === 'terminal') return Terminal;
  if (name === 'web_search') return Globe;
  if (name === 'read_file' || name === 'write_file') return FileText;
  if (name === 'execute_code') return Code;
  return Wrench;
}

function getFirstLine(args: string): string {
  try {
    const parsed = JSON.parse(args);
    const str = JSON.stringify(parsed);
    return str.split('\n')[0];
  } catch {
    return args.split('\n')[0];
  }
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export default function ToolCallBlock({ toolCalls, toolResult, toolName }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (!toolCalls && toolResult) {
    const Icon = getToolIcon(toolName);
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/10 rounded p-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="w-3 h-3 text-on-surface-variant" />
          <span className="font-label text-[10px] font-bold tracking-tight text-on-surface-variant">
            {toolName || 'tool'}
          </span>
        </div>
        {renderToolResult(toolName, toolResult)}
      </div>
    );
  }

  let parsedCalls: Array<{ name?: string; arguments?: string }> = [];
  try {
    if (toolCalls) {
      const parsed = JSON.parse(toolCalls);
      parsedCalls = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch {
    parsedCalls = [];
  }

  if (parsedCalls.length === 0) return null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/10 rounded p-2 space-y-2">
      {parsedCalls.map((call, index) => {
        const Icon = getToolIcon(call.name);
        const firstLine = call.arguments ? getFirstLine(call.arguments) : '';
        const formattedArgs = call.arguments ? formatJson(call.arguments) : '';

        return (
          <div key={index}>
            <button
              className="w-full flex items-center gap-1.5 text-left"
              onClick={() => setExpanded(!expanded)}
            >
              <Icon className="w-3 h-3 text-on-surface-variant shrink-0" />
              <span className="font-label text-[10px] font-bold tracking-tight text-on-surface-variant">
                {call.name || 'tool'}
              </span>
              {!expanded && (
                <span className="text-on-surface-variant/40 text-[10px] truncate">
                  {firstLine}
                </span>
              )}
              <ChevronDown
                className={`w-3 h-3 text-on-surface-variant ml-auto shrink-0 transition-transform ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                <div className="bg-surface-container-lowest p-3 font-label text-xs whitespace-pre-wrap overflow-x-auto overflow-y-auto max-h-96">
                  {formattedArgs}
                </div>
                {index === 0 && toolResult && (
                  <div>{renderToolResult(call.name, toolResult, call.arguments)}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
