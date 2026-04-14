import { createFileRoute } from '@tanstack/react-router'
import ChatThread from '@/components/chat/ChatThread'
import ChatInput from '@/components/chat/ChatInput'
import MetadataPanel from '@/components/chat/MetadataPanel'
import { useSessionsStore } from '@/stores/sessions'
import { useChatStore } from '@/stores/chat'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({\n  component: ChatPage,
})

function ChatPage() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId)
  const sessions = useSessionsStore((s) => s.sessions)
  const loadHistory = useChatStore((s) => s.loadHistory)
  const clearChat = useChatStore((s) => s.clear)
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null

  useEffect(() => {
    if (activeSessionId) {
      loadHistory(activeSessionId)
    } else {
      clearChat()
    }
  }, [activeSessionId, loadHistory, clearChat])

  return (
    <div className="flex flex-1 h-full min-w-0">
      <main className="flex-1 flex flex-col bg-surface-container-lowest min-w-0">
        <header className="h-14 bg-surface-container-low/80 backdrop-blur-xl border-b border-outline-variant/15 flex items-center px-6 justify-between shrink-0">
          <div className="flex flex-col">
            <h2 className="font-headline font-bold text-sm tracking-tight text-on-surface">
              {activeSession?.title || 'New Session'}
            </h2>
            {activeSession && (
              <div className="flex items-center gap-2">
                <span className="font-label text-[9px] text-primary tracking-widest uppercase">
                  {activeSession.model || 'unknown'}
                </span>
                <span className="w-1 h-1 bg-outline-variant rounded-full" />
                <span className="font-label text-[9px] text-on-surface-variant/40 uppercase">
                  {activeSession.id.slice(0, 12)}
                </span>
              </div>
            )}
          </div>
          <button className="font-label text-[10px] px-3 py-1.5 bg-surface-container-highest hover:bg-surface-bright transition-all flex items-center gap-2 tracking-widest text-on-surface rounded">
            FORK
          </button>
        </header>

        <ChatThread />
        <ChatInput />
      </main>

      <MetadataPanel session={activeSession} />
    </div>
  )
}
