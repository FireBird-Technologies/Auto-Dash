/**
 * Chat Component
 * 
 * Full-featured chat interface that uses the chat_function endpoint.
 * Supports general Q&A, dataset queries, and code editing.
 */

import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatRequest, ChatResponse } from '../services/chatApi';

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
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      setMessages(prev => [...prev, {
        type: 'error',
        message: `❌ ${errorMessage}`,
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

  return (
    <div className="chat-container">
      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p>💬 Ask me anything about your data!</p>
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
          {isLoading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
};

