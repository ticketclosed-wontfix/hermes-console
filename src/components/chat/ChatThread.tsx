import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import ToolCallBlock from './ToolCallBlock';
import ThinkingBlock from './ThinkingBlock';
import MarkdownContent from './MarkdownContent';

function formatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatThread() {
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse text-sm">
          Loading messages...
        </p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">
          Start a conversation
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
      {messages.map((msg) => {
        if (msg.role === 'user') {
          const parts = Array.isArray(msg.content)
            ? msg.content
            : [{ type: 'text' as const, text: msg.content }];
          return (
            <div key={msg.id} className="flex justify-end ml-12">
              <div className="bg-surface-container-low border-l-2 border-primary p-4 max-w-2xl rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-on-surface-variant">
                    User
                  </span>
                  <span className="text-xs text-on-surface-variant/60">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="text-on-surface text-sm space-y-2">
                  {parts.map((part: any, i: number) => {
                    if (part?.type === 'image_url' && part.image_url?.url) {
                      return (
                        <img
                          key={i}
                          src={part.image_url.url}
                          alt="attachment"
                          className="max-w-xs rounded border border-outline-variant/20"
                        />
                      );
                    }
                    const text =
                      typeof part === 'string'
                        ? part
                        : part?.type === 'text'
                          ? part.text || ''
                          : '';
                    if (!text) return null;
                    return <MarkdownContent key={i} content={text} />;
                  })}
                </div>
              </div>
            </div>
          );
        }

        if (msg.role === 'assistant') {
          const assistantText =
            typeof msg.content === 'string' ? msg.content : '';
          return (
            <div key={msg.id} className="flex gap-4 mr-12">
              <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-on-surface-variant">
                    Assistant
                  </span>
                  <span className="text-xs text-on-surface-variant/60">
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                {msg.reasoning && (
                  <ThinkingBlock content={msg.reasoning} />
                )}
                {msg.toolCalls && (
                  <ToolCallBlock toolCalls={msg.toolCalls} />
                )}
                {assistantText && (
                  <MarkdownContent content={assistantText} />
                )}
              </div>
            </div>
          );
        }

        if (msg.role === 'tool') {
          const toolText =
            typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          return (
            <div key={msg.id} className="ml-12">
              <ToolCallBlock
                toolCalls={null}
                toolResult={toolText}
                toolName={msg.toolName}
              />
            </div>
          );
        }

        return null;
      })}
      <div ref={bottomRef} />
    </div>
  );
}