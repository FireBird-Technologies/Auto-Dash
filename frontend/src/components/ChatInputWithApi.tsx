/**
 * ChatInputWithApi Component
 * 
 * Enhanced ChatInput that directly calls the chat API.
 * Drop-in replacement for ChatInput when you want to use the chat endpoint.
 */

import React, { useState, useCallback } from 'react';
import { sendChatMessage, ChatRequest } from '../services/chatApi';

interface ChatInputWithApiProps {
  onMessage?: (message: string, reply: string) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  datasetId?: string;
  figData?: Record<string, any>;
  plotlyCode?: string;
}

export const ChatInputWithApi: React.FC<ChatInputWithApiProps> = ({ 
  onMessage, 
  onError,
  disabled = false,
  datasetId,
  figData,
  plotlyCode,
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async () => {
    if (!message.trim() || disabled || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      // Build request
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

      // Send to API
      const response = await sendChatMessage(request);

      // Call callback with message and reply
      if (onMessage) {
        onMessage(userMessage, response.reply);
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [message, disabled, isLoading, datasetId, figData, plotlyCode, onMessage, onError]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="chat-section">
      <h3 className="section-title">Chat</h3>
      <div className="chat">
        <input
          type="text"
          placeholder="Ask about trends, correlations, or summaries..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          className="chat-input"
        />
        <button 
          className="button-primary"
          onClick={handleSend}
          disabled={disabled || isLoading || !message.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

