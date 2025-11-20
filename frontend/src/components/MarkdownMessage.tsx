import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language?: string;
  children: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default for multi-line
  const [copied, setCopied] = useState(false);
  
  // Check if code is multi-line
  const codeString = String(children);
  const isMultiLine = codeString.includes('\n') && codeString.trim().split('\n').length > 1;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // For single-line code blocks, render without toggle header (subtle styling)
  if (!isMultiLine) {
    return (
      <div style={{ margin: '4px 0' }}>
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: '1.4',
            backgroundColor: '#1e1e1e'
          }}
          PreTag="div"
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  // For multi-line code blocks, render with toggle header
  return (
    <div style={{
      margin: '12px 0',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#1e1e1e'
    }}>
      {/* Header with language and controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        backgroundColor: '#252526',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#cccccc',
            textTransform: 'uppercase'
          }}>
            {language || 'code'}
          </span>
          <span style={{ fontSize: '11px', color: '#858585' }}>
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
            color: '#cccccc',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      
      {/* Code content */}
      {isExpanded && (
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '12px',
            fontSize: '13px',
            lineHeight: '1.5',
            backgroundColor: '#1e1e1e'
          }}
          PreTag="div"
        >
          {codeString}
        </SyntaxHighlighter>
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
      color: '#212529',
      width: '100%',
      maxWidth: '100%'
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            // Render as CodeBlock for any non-inline code (with or without language)
            if (!inline) {
              return (
                <CodeBlock language={language || undefined}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlock>
              );
            }
            
            // Inline code
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
              <div style={{ 
                overflowX: 'auto', 
                margin: '12px 0',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
              }}>
                <table style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontSize: '13px'
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
          tbody({ children }: any) {
            return <tbody>{children}</tbody>;
          },
          tr({ children }: any) {
            return (
              <tr style={{
                transition: 'background-color 0.15s'
              }}>
                {children}
              </tr>
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

