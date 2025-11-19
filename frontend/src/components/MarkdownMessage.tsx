import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CodeBlockProps {
  language?: string;
  children: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: '12px 0',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Header with language and controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#e9ecef',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#495057',
            textTransform: 'uppercase'
          }}>
            {language || 'code'}
          </span>
          <span style={{ fontSize: '11px', color: '#6c757d' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: '12px',
            color: '#495057',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      
      {/* Code content */}
      {isExpanded && (
        <pre style={{
          margin: 0,
          padding: '12px',
          overflow: 'auto',
          backgroundColor: '#ffffff',
          fontSize: '13px',
          lineHeight: '1.5',
          fontFamily: 'Monaco, "Courier New", monospace'
        }}>
          <code>{children}</code>
        </pre>
      )}
    </div>
  );
};

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  return (
    <div style={{
      lineHeight: '1.6',
      fontSize: '14px',
      color: '#212529'
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            if (!inline && language) {
              return (
                <CodeBlock language={language}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlock>
              );
            }
            
            return (
              <code className={className} {...props} style={{
                backgroundColor: '#f1f3f5',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'Monaco, "Courier New", monospace'
              }}>
                {children}
              </code>
            );
          },
          table({ children }: any) {
            return (
              <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                <table style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }: any) {
            return <thead style={{ backgroundColor: '#f8f9fa' }}>{children}</thead>;
          },
          th({ children }: any) {
            return (
              <th style={{
                padding: '10px 12px',
                textAlign: 'left',
                borderBottom: '2px solid rgba(0, 0, 0, 0.1)',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                {children}
              </th>
            );
          },
          td({ children }: any) {
            return (
              <td style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                fontSize: '13px'
              }}>
                {children}
              </td>
            );
          },
          p({ children }: any) {
            return <p style={{ margin: '8px 0' }}>{children}</p>;
          },
          ul({ children }: any) {
            return <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>;
          },
          ol({ children }: any) {
            return <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>;
          },
          li({ children }: any) {
            return <li style={{ margin: '4px 0' }}>{children}</li>;
          },
          strong({ children }: any) {
            return <strong style={{ fontWeight: '600' }}>{children}</strong>;
          },
          em({ children }: any) {
            return <em style={{ fontStyle: 'italic' }}>{children}</em>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

