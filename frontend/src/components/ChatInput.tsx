import React, { useState, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message);
    setMessage('');
  }, [message, onSend, disabled]);

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
          disabled={disabled}
          className="chat-input"
        />
        <button 
          className="button-primary"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};
