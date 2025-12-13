/**
 * Chat Component
 * 
 * Full-featured chat interface that uses the chat_function endpoint.
 * Supports general Q&A, dataset queries, and code editing.
 */

import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatRequest, ChatResponse } from '../services/chatApi';
import { InsufficientBalancePopup } from './InsufficientBalancePopup';

interface ChatProps {
  datasetId?: string;
  figData?: Record<string, any>;
  plotlyCode?: string;
  disabled?: boolean;
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'error';
  message: string;
  timestamp: Date;
  queryType?: string;  // Show action buttons when 'need_clarity'
  originalQuery?: string;
}

export const Chat: React.FC<ChatProps> = ({ 
  datasetId, 
  figData, 
  plotlyCode, 
  disabled = false 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [insufficientBalanceData, setInsufficientBalanceData] = useState<{
    required?: number;
    balance?: number;
    plan?: string;
  }>({});

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || disabled) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    setMessages(prev => [...prev, {
      type: 'user',
      message: userMessage,
      timestamp: new Date(),
    }]);

    setIsLoading(true);

    try {
      // Build request with optional context
      const request: ChatRequest = {
        message: userMessage,
      };

      if (datasetId) {
        request.dataset_id = datasetId;
      }

      if (figData) {
        request.fig_data = figData;
      }

      if (plotlyCode) {
        request.plotly_code = plotlyCode;
      }

      // Call chat API
      const response: ChatResponse = await sendChatMessage(request);

      // Add assistant response to chat
      setMessages(prev => [...prev, {
        type: 'assistant',
        message: response.reply,
        timestamp: new Date(),
        queryType: response.query_type,
        originalQuery: userMessage,
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      
      // Check for insufficient credits (402)
      const errorWithStatus = error as Error & { status?: number; detail?: any };
      if (errorWithStatus.status === 402 && errorWithStatus.detail) {
        const detail = typeof errorWithStatus.detail === 'string' 
          ? JSON.parse(errorWithStatus.detail) 
          : errorWithStatus.detail;
        
        if (detail.error === 'insufficient_credits') {
          setInsufficientBalanceData({
            required: detail.required,
            balance: detail.balance,
            plan: detail.plan
          });
          setShowInsufficientBalance(true);
          
          // Remove user message from chat history since action failed
          setMessages(prev => prev.slice(0, -1));
          setIsLoading(false);
          return;
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      setMessages(prev => [...prev, {
        type: 'error',
        message: `Error: ${errorMessage}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle action button click - resend with forced action prefix
  const handleActionClick = async (action: 'edit' | 'add' | 'analyze', originalQuery: string) => {
    const prefixMap = {
      edit: 'Edit chart: ',
      add: 'Plot: ',
      analyze: 'Calculate: ',
    };
    
    const newMessage = prefixMap[action] + originalQuery;
    setInput(newMessage);
    
    // Auto-send with slight delay for UX
    setTimeout(() => {
      setInput('');
      // Simulate sending the message
      setMessages(prev => [...prev, {
        type: 'user',
        message: newMessage,
        timestamp: new Date(),
      }]);
      
      const request: ChatRequest = {
        message: newMessage,
        dataset_id: datasetId,
        fig_data: figData,
        plotly_code: plotlyCode,
      };
      
      setIsLoading(true);
      sendChatMessage(request)
        .then(response => {
          setMessages(prev => [...prev, {
            type: 'assistant',
            message: response.reply,
            timestamp: new Date(),
          }]);
        })
        .catch(error => {
          setMessages(prev => [...prev, {
            type: 'error',
            message: `Error: ${error.message}`,
            timestamp: new Date(),
          }]);
        })
        .finally(() => setIsLoading(false));
    }, 100);
  };

  return (
    <div className="chat-container">
      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p>Ask me anything about your data!</p>
            <p className="chat-empty-hint">
              I can help with analysis, trends, or editing visualizations.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.type}-message`}>
              <div className={`chat-avatar ${msg.type}-avatar`}>
                {msg.type === 'user' ? 'You' : 'AI'}
              </div>
              <div className={`chat-bubble ${msg.type}-bubble`}>
                {msg.message}
                {msg.queryType === 'need_clarity' && msg.originalQuery && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={() => handleActionClick('add', msg.originalQuery!)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      ➕ Add Chart
                    </button>
                    <button
                      onClick={() => handleActionClick('edit', msg.originalQuery!)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      ✏️ Edit Chart
                    </button>
                    <button
                      onClick={() => handleActionClick('analyze', msg.originalQuery!)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      📊 Analyze Data
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="chat-message assistant-message">
            <div className="chat-avatar assistant-avatar">AI</div>
            <div className="chat-bubble assistant-bubble thinking-bubble">
              <span className="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data..."
          className="chat-input"
          rows={2}
          disabled={isLoading || disabled}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || disabled}
          className="chat-send-button"
          title={isLoading ? 'Sending...' : 'Send message'}
        >
          {isLoading ? '...' : '>'}
        </button>
      </div>

      {/* Insufficient Balance Popup */}
      <InsufficientBalancePopup
        isOpen={showInsufficientBalance}
        onClose={() => setShowInsufficientBalance(false)}
        required={insufficientBalanceData.required}
        balance={insufficientBalanceData.balance}
        plan={insufficientBalanceData.plan}
      />
    </div>
  );
};

