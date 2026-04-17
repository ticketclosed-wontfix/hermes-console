import { useEffect, useMemo } from 'react';
import { Search, Plus, Settings, MessageSquare, LayoutDashboard, Clock, Puzzle, Brain, FolderOpen, Terminal, Download, FileJson, GitFork } from 'lucide-react';
import { useSessionsStore } from '@/stores/sessions';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { exportSession, downloadBlob, forkSession } from '@/lib/api';

type NavItem = { path: '/' | '/dashboard' | '/jobs' | '/skills' | '/memory' | '/files' | '/search' | '/terminal' | '/settings'; label: string; icon: typeof MessageSquare };
const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'CHAT', icon: MessageSquare },
  { path: '/dashboard', label: 'DASH', icon: LayoutDashboard },
  { path: '/jobs', label: 'JOBS', icon: Clock },
  { path: '/skills', label: 'SKILLS', icon: Puzzle },
  { path: '/memory', label: 'MEM', icon: Brain },
  { path: '/files', label: 'FILES', icon: FolderOpen },
  { path: '/search', label: 'FIND', icon: Search },
  { path: '/terminal', label: 'TERM', icon: Terminal },
  { path: '/settings', label: 'CFG', icon: Settings },
];

function getGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 6 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  return 'Older';
}

function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now();
  const diff = now - unixSeconds * 1000;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Sidebar() {
  const { sessions, load, search, setActive, activeSessionId, searchQuery, loading, create } =
    useSessionsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isChat = location.pathname === '/';

  useEffect(() => {
    load();
  }, [load]);

  const handleNewSession = async () => {
    const session = await create();
    if (session && location.pathname !== '/') {
      navigate({ to: '/' });
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, typeof sessions> = {};
    const order = ['Today', 'Yesterday', 'This Week', 'Older'];

    for (const session of sessions) {
      const date = new Date(session.started_at * 1000);
      const label = getGroupLabel(date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(session);
    }

    return order.filter((label) => groups[label]?.length).map((label) => ({
      label,
      items: groups[label],
    }));
  }, [sessions]);

  return (
    <aside className="w-[240px] h-screen bg-surface-container-low border-r border-outline-variant/20 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="font-headline font-black text-primary tracking-tighter text-lg">
          HERMES
        </span>
        <span className="ml-auto text-[9px] font-label tracking-widest uppercase bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
          v0.1
        </span>
      </div>

      {/* Navigation */}
      <nav className="px-3 py-1 flex gap-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = path === '/' ? isChat : location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-on-surface-variant/50 hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <Icon size={14} />
              <span className="font-label text-[8px] tracking-widest uppercase">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Search — chat only */}
      {isChat && (
        <>
          <div className="px-3 py-2">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => search(e.target.value)}
                placeholder="SEARCH SESSIONS"
                className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 font-label text-[10px] tracking-widest uppercase pl-7 pr-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* New Session Button */}
          <div className="px-3 pb-2">
            <button
              onClick={handleNewSession}
              className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-label text-xs font-bold py-2 rounded-md hover:brightness-110 transition-all"
            >
              <Plus size={14} />
              NEW_SESSION
            </button>
          </div>
        </>
      )}

      {/* Session List — chat only */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2">{isChat && (<>

        {loading && sessions.length === 0 && (
          <div className="text-on-surface-variant/40 text-[10px] font-label tracking-widest uppercase text-center py-8">
            Loading...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-on-surface-variant/40 text-[10px] font-label tracking-widest uppercase text-center py-8">
            No sessions
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="text-on-surface-variant/50 font-label text-[9px] tracking-widest uppercase px-2 py-1.5">
              {group.label}
            </div>
            {group.items.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className="group relative mb-0.5"
                >
                  <button
                    onClick={() => setActive(session.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'border-l-2 border-primary bg-surface-container-high text-on-surface'
                        : 'text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="truncate text-xs font-medium leading-tight pr-16">
                      {session.title || `${session.source || 'chat'} session`}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] bg-primary/10 px-1 border border-primary/20 rounded-sm font-label">
                        {session.model}
                      </span>
                      <span className="text-[9px] text-on-surface-variant/50 font-label">
                        {formatRelativeTime(session.started_at)}
                      </span>
                      <span className="text-[9px] text-on-surface-variant/50 font-label">
                        {session.message_count} msgs
                      </span>
                    </div>
                  </button>
                  <div className="absolute right-1.5 top-1.5 hidden group-hover:flex items-center gap-0.5">
                    <button
                      title="Download as Markdown"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const blob = await exportSession(session.id, 'markdown');
                        downloadBlob(blob, `session-${session.id}.md`);
                      }}
                      className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      title="Download as JSON"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const blob = await exportSession(session.id, 'json');
                        downloadBlob(blob, `session-${session.id}.json`);
                      }}
                      className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
                    >
                      <FileJson size={12} />
                    </button>
                    <button
                      title="Fork session"
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Fork returns messages; for now just alert — full integration would set chat store and navigate
                        const result = await forkSession(session.id);
                        alert(`Forked ${result.messages.length} messages from "${result.source_session.title}". Navigate to Chat to continue.`);
                      }}
                      className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors"
                    >
                      <GitFork size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </>)}
      </div>

      {/* Bottom User Section */}
      <div className="border-t border-outline-variant/20 px-3 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-on-surface leading-tight truncate">
            NICK
          </div>
          <div className="text-[9px] text-on-surface-variant/50 font-label tracking-widest uppercase">
            ADMIN
          </div>
        </div>
        <button className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}