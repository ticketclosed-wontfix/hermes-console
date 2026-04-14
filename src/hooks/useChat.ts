import { useSessionsStore } from '@/stores/sessions';
import { useChatStore } from '@/stores/chat';
import { useCallback } from 'react';

export function useChat() {
  const sessionsStore = useSessionsStore();
  const chatStore = useChatStore();

  const activeSessionId = sessionsStore.activeSessionId;
  const activeSession = sessionsStore.sessions.find(s => s.id === activeSessionId) || null;

  const messages = chatStore.messages;
  const loading = chatStore.loading;
  const streaming = chatStore.streaming;

  const sendMessage = useCallback(async (text: string) => {
    let sessionId = sessionsStore.activeSessionId;

    if (!sessionId) {
      sessionId = 'new-' + Date.now();
      sessionsStore.setActive(sessionId);
    }

    await chatStore.sendMessage(text, sessionId);
    sessionsStore.load();
  }, [sessionsStore, chatStore]);

  const cancelStreaming = chatStore.cancelStreaming;

  const selectSession = useCallback((id: string) => {
    sessionsStore.setActive(id);
    chatStore.loadHistory(id);
  }, [sessionsStore, chatStore]);

  const createNewSession = useCallback(() => {
    sessionsStore.setActive(null);
    chatStore.clear();
  }, [sessionsStore, chatStore]);

  return {
    activeSession,
    messages,
    loading,
    streaming,
    sendMessage,
    cancelStreaming,
    selectSession,
    createNewSession,
  };
}