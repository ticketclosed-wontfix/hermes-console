import React from 'react';
import { Upload, GitFork, Trash2 } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessions';

interface Session {
  id: string;
  model: string | null;
  source: string;
  message_count: number;
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
  estimated_cost_usd: number | null;
  started_at: number;
  ended_at: number | null;
}

interface MetadataPanelProps {
  session: Session | null;
}

const MetadataPanel: React.FC<MetadataPanelProps> = ({ session }) => {
  const deleteSessionFromStore = useSessionsStore((s) => s.deleteSession);

  if (!session) {
    return (
      <div className="w-[280px] h-screen bg-surface-container-low border-l border-outline-variant/20 flex flex-col shrink-0 items-center justify-center">
        <p className="font-label text-[10px] text-on-surface-variant/50">Select a session</p>
      </div>
    );
  }

  const tokenBreakdown = [
    { label: 'Input', value: session.input_tokens },
    { label: 'Output', value: session.output_tokens },
    { label: 'Cache Read', value: session.cache_read_tokens || 0 },
    { label: 'Reasoning', value: session.reasoning_tokens || 0 },
  ];
  const totalTokens = tokenBreakdown.reduce((s, t) => s + t.value, 0);
  const maxVal = Math.max(...tokenBreakdown.map(t => t.value), 1);

  const handleDelete = async () => {
    if (!confirm('Delete this chat? This cannot be undone.')) return;
    await deleteSessionFromStore(session.id);
  };

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
        <span className="font-label text-[10px] text-on-surface-variant/50 block mb-3">Token Usage</span>
        <div className="space-y-2">
          {tokenBreakdown.filter(t => t.value > 0).map((t) => (
            <div key={t.label}>
              <div className="flex justify-between mb-0.5">
                <span className="font-label text-[9px] text-on-surface-variant/60">{t.label}</span>
                <span className="font-label text-[9px] text-on-surface">{t.value.toLocaleString()}</span>
              </div>
              <div className="h-1 bg-primary/10 rounded-full">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(t.value / maxVal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 pt-2 border-t border-outline-variant/10">
          <span className="font-label text-[10px] text-on-surface-variant/50">Total</span>
          <span className="font-label text-[10px] text-on-surface font-bold">{totalTokens.toLocaleString()}</span>
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
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 font-label text-[10px] text-error/60 hover:text-error transition-colors"
        >
          <Trash2 size={12} /> DELETE
        </button>
      </div>
    </div>
  );
};

export default MetadataPanel;
