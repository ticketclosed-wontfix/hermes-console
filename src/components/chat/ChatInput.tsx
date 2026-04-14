import { useState, useCallback, useRef, useEffect } from 'react';
import { Paperclip, Code2, Send, Square } from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import { useSessionsStore } from '@/stores/sessions';

export default function ChatInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, streaming, cancelStreaming } = useChatStore();
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !activeSessionId) return;
    sendMessage(trimmed, activeSessionId);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, activeSessionId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        if (!streaming) {
          handleSend();
        }
      }
    },
    [handleSend, streaming]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    []
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  }, [text]);

  return (
    <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/15 max-w-4xl mx-auto">
      {/* Status Bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="font-label text-[9px] text-on-surface-variant">
            Connected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Attach file"
          >
            <Paperclip size={14} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Code block"
          >
            <Code2 size={14} />
          </button>
        </div>
      </div>

      {/* Textarea Area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="ASK ANYTHING... ( / FOR COMMANDS )"
          rows={3}
          className="w-full h-24 resize-none bg-surface-container-lowest border border-outline-variant/20 p-4 pb-12 font-label text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-outline-variant/40 transition-colors"
        />

        {/* Bottom-right controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <button
            type="button"
            className="bg-surface-container-high font-label text-[10px] text-on-surface-variant px-2.5 py-1 rounded hover:bg-surface-container-highest transition-colors"
          >
            GPT-4o
          </button>

          {streaming ? (
            <button
              type="button"
              onClick={cancelStreaming}
              className="bg-primary text-on-primary p-2 rounded transition-colors hover:bg-primary/90"
              aria-label="Cancel streaming"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || !activeSessionId}
              className="bg-primary text-on-primary p-2 rounded transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}