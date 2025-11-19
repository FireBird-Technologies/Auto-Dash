/**
 * useChat Hook
 * 
 * React hook for managing chat state and interactions with the chat API.
 */

import { useState, useCallback } from 'react';
import { sendChatMessage, ChatRequest, ChatResponse } from '../services/chatApi';

interface UseChatOptions {
  datasetId?: string;
  figData?: Record<string, any>;
  plotlyCode?: string;
  onResponse?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'error';
  message: string;
  timestamp: Date;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    // Add user message
    setMessages(prev => [...prev, {
      type: 'user',
      message: message.trim(),
      timestamp: new Date(),
    }]);

    setIsLoading(true);

    try {
      // Build request
      const request: ChatRequest = {
        message: message.trim(),
      };

      if (options.datasetId) {
        request.dataset_id = options.datasetId;
      }

      if (options.figData) {
        request.fig_data = options.figData;
      }

      if (options.plotlyCode) {
        request.plotly_code = options.plotlyCode;
      }

      // Send request
      const response = await sendChatMessage(request);

      // Add assistant response
      setMessages(prev => [...prev, {
        type: 'assistant',
        message: response.reply,
        timestamp: new Date(),
      }]);

      // Call onResponse callback
      if (options.onResponse) {
        options.onResponse(response);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      
      // Add error message
      setMessages(prev => [...prev, {
        type: 'error',
        message: `❌ ${errorMessage}`,
        timestamp: new Date(),
      }]);

      // Call onError callback
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, options]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}

