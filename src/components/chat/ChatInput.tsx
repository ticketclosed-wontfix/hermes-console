import { useState, useCallback, useRef, useEffect } from 'react';
import { Paperclip, Code2, Send, Square, X } from 'lucide-react';
import { useChatStore, type ContentPart } from '@/stores/chat';
import { useSessionsStore } from '@/stores/sessions';

type Attachment = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
};

function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || `pasted-${Date.now()}.${(file.type.split('/')[1] || 'png')}`,
        dataUrl: String(reader.result),
        mimeType: file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ChatInput() {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, streaming, cancelStreaming } = useChatStore();
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeModel = sessions.find((s: any) => s.id === activeSessionId)?.model || 'hermes-agent';

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    // Lazy session: pass null when no active session — chat store will create
    // one via sessions.ensureActiveSession() before actually streaming.
    const sid = activeSessionId ?? null;

    if (attachments.length > 0) {
      const parts: ContentPart[] = [];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      for (const att of attachments) {
        parts.push({ type: 'image_url', image_url: { url: att.dataUrl } });
      }
      sendMessage(parts, sid);
    } else {
      sendMessage(trimmed, sid);
    }

    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, attachments, activeSessionId, sendMessage]);

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

  const ingestFiles = useCallback(async (files: FileList | File[] | null | undefined) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    const next = await Promise.all(arr.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...next]);
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await ingestFiles(e.target.files);
      // reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [ingestFiles]
  );

  const handlePaperclip = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        await ingestFiles(files);
      }
    },
    [ingestFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      await ingestFiles(e.dataTransfer.files);
    },
    [ingestFiles]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  const sendDisabled = !text.trim() && attachments.length === 0;

  return (
    <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/15">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

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
            onClick={handlePaperclip}
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

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/20 rounded p-1.5 pr-2"
            >
              <img
                src={att.dataUrl}
                alt={att.name}
                className="w-12 h-12 object-cover rounded"
              />
              <span className="font-label text-[10px] text-on-surface-variant truncate max-w-[120px]">
                {att.name}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                aria-label={`Remove ${att.name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea Area */}
      <div
        className={`relative ${isDragging ? 'ring-2 ring-primary/60 rounded' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="ASK ANYTHING... ( / FOR COMMANDS )"
          rows={3}
          className="w-full resize-none bg-surface-container-lowest border border-outline-variant/20 p-4 pb-12 font-label text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-outline-variant/40 transition-colors"
        />

        {/* Bottom-right controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <button
            type="button"
            className="bg-surface-container-high font-label text-[10px] text-on-surface-variant px-2.5 py-1 rounded hover:bg-surface-container-highest transition-colors"
          >
            {activeModel}
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
              disabled={sendDisabled}
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
