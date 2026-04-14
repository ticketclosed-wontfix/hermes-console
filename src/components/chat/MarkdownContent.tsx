import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  return (
    <div className="prose text-sm text-on-surface leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-headline font-bold text-lg mt-6 mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-headline font-bold text-base mt-5 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-headline font-bold text-sm mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-headline font-bold text-sm mt-3 mb-1">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-on-surface leading-relaxed mb-3 last:mb-0">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            if (isInline) {
              return (
                <code className="font-label text-primary bg-primary/5 px-1 rounded text-xs">
                  {children}
                </code>
              );
            }

            return (
              <code className={className}>{children}</code>
            );
          },
          pre: ({ children }) => {
            const codeChild = React.Children.toArray(children).find(
              (child): child is React.ReactElement<any> =>
                React.isValidElement(child) && (child as React.ReactElement<any>).type === 'code'
            );

            let language = '';
            if (codeChild) {
              const codeClassName = (codeChild.props as any)?.className || '';
              const match = /language-(\w+)/.exec(codeClassName);
              language = match ? match[1] : '';
            }

            return (
              <div className="my-3 rounded overflow-hidden border border-outline-variant/10">
                {language && (
                  <div className="flex justify-between px-3 py-1.5 bg-surface-container-low border-b border-outline-variant/10">
                    <span className="font-label text-[9px] text-on-surface-variant uppercase tracking-widest">
                      {language}
                    </span>
                  </div>
                )}
                <div className="bg-surface-container-lowest p-4 overflow-x-auto">
                  <pre className="font-label text-xs m-0 whitespace-pre">{children}</pre>
                </div>
              </div>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 mb-3">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-3">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-on-surface leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-primary/30 pl-4 my-3 text-on-surface-variant italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="border-collapse w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-container-low">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-outline-variant/20 px-3 py-2 text-left font-headline font-bold text-sm">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-outline-variant/20 px-3 py-2 text-sm">{children}</td>
          ),
          hr: () => (
            <hr className="border-outline-variant/20 my-4" />
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-on-surface">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;