import React from 'react';
import { Upload, GitFork, Trash2 } from 'lucide-react';

interface Session {
  id: string;
  model: string | null;
  source: string;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number | null;
  started_at: number;
  ended_at: number | null;
}

interface MetadataPanelProps {
  session: Session | null;
}

const MetadataPanel: React.FC<MetadataPanelProps> = ({ session }) => {
  if (!session) {
    return (
      <div className="w-[280px] h-screen bg-surface-container-low border-l border-outline-variant/20 flex flex-col shrink-0 items-center justify-center">
        <p className="font-label text-[10px] text-on-surface-variant/50">Select a session</p>
      </div>
    );
  }

  const tokenValues = [
    session.input_tokens,
    session.output_tokens,
    Math.round(session.input_tokens * 0.5),
    Math.round(session.output_tokens * 0.5),
    session.input_tokens + session.output_tokens
  ];
  const maxTokenValue = Math.max(...tokenValues, 1);

  return (
    <div className="w-[280px] h-screen bg-surface-container-low border-l border-outline-variant/20 flex flex-col shrink-0">
      <div className="p-6 mb-6">
        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">Session_Metadata</h2>
      </div>

      <div className="px-6 space-y-2">
        <div className="flex justify-between">
          <span className="font-label text-[10px] text-on-surface-variant/50">Model</span>
          <span className="font-label text-[10px] text-on-surface font-bold">{session.model || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-label text-[10px] text-on-surface-variant/50">Source</span>
          <span className="font-label text-[10px] text-on-surface font-bold">{session.source}</span>
        </div>
      </div>

      <div className="px-6 mt-6">
        <span className="font-label text-[10px] text-on-surface-variant/50 block mb-2">Token Distribution</span>
        <div className="flex items-end gap-1.5 h-16">
          {tokenValues.map((val, i) => (
            <div key={i} className="relative flex-1 bg-primary/20 h-full">
              <div
                className="absolute bottom-0 w-full bg-primary/80"
                style={{ height: `${(val / maxTokenValue) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-outline-variant/10 py-4 px-6 mt-6">
        <div className="flex justify-between mb-2">
          <span className="font-label text-[10px] text-on-surface-variant/50">Tool Usage</span>
          <span className="font-label text-[10px] text-on-surface font-bold">{session.tool_call_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-label text-[10px] text-on-surface-variant/50">Est. Cost</span>
          <span className="font-label text-[10px] text-primary font-bold">
            {session.estimated_cost_usd !== null ? `$${session.estimated_cost_usd.toFixed(4)}` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="mt-auto p-6 flex flex-col gap-2">
        <button className="flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
          <Upload size={12} /> EXPORT_SESSION
        </button>
        <button className="flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
          <GitFork size={12} /> FORK_SESSION
        </button>
        <button className="flex items-center gap-2 font-label text-[10px] text-error/60">
          <Trash2 size={12} /> DELETE
        </button>
      </div>
    </div>
  );
};

export default MetadataPanel;