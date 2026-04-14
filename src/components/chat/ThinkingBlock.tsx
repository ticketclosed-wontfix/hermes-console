import React from 'react';

interface ThinkingBlockProps {
  content: string;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content }) => {
  return (
    <details className="group border border-outline-variant/10 bg-surface-container-low/50 rounded">
      <summary className="flex items-center gap-2 p-2 cursor-pointer list-none select-none hover:bg-surface-container-high transition-colors">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-on-surface-variant transition-transform group-open:rotate-90"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-label text-[10px] text-on-surface-variant italic">
          Thinking process...
        </span>
      </summary>
      <div className="px-8 pb-3 text-xs text-on-surface-variant/60 font-label leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </details>
  );
};

export default ThinkingBlock;