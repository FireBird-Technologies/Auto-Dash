/**
 * Chat Integration Example
 * 
 * Example page showing different ways to integrate the chat functionality.
 * This is for demonstration purposes - use the components that fit your needs.
 */

import React, { useState } from 'react';
import { Chat } from '../Chat';
import { ChatInputWithApi } from '../ChatInputWithApi';
import { useChat } from '../../hooks/useChat';
import { sendSimpleMessage } from '../../services/chatApi';

export const ChatExample: React.FC = () => {
  const [example, setExample] = useState<'full' | 'input' | 'hook' | 'api'>('full');
  const [apiResponse, setApiResponse] = useState<string>('');

  // Example using the hook
  const { messages, isLoading, sendMessage } = useChat({
    datasetId: 'example_dataset',
    onResponse: (response) => {
      console.log('Got response:', response);
    },
  });
  const [hookInput, setHookInput] = useState('');

  // Example using direct API call
  const handleApiCall = async () => {
    try {
      const response = await sendSimpleMessage('What is data visualization?');
      setApiResponse(response.reply);
    } catch (error) {
      setApiResponse('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Chat Integration Examples</h1>
      
      {/* Example Selector */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setExample('full')} style={{ padding: '10px 20px' }}>
          Full Chat Component
        </button>
        <button onClick={() => setExample('input')} style={{ padding: '10px 20px' }}>
          Input with API
        </button>
        <button onClick={() => setExample('hook')} style={{ padding: '10px 20px' }}>
          useChat Hook
        </button>
        <button onClick={() => setExample('api')} style={{ padding: '10px 20px' }}>
          Direct API Call
        </button>
      </div>

      {/* Example 1: Full Chat Component */}
      {example === 'full' && (
        <div>
          <h2>Example 1: Full Chat Component</h2>
          <p>Complete chat interface with message history:</p>
          <div style={{ height: '500px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <Chat 
              datasetId="example_dataset_123"
              disabled={false}
            />
          </div>
          <pre style={{ marginTop: '20px', background: '#f5f5f5', padding: '10px' }}>
{`<Chat 
  datasetId="example_dataset_123"
  figData={plotlyFigureData}
  plotlyCode={plotlyCodeString}
/>`}
          </pre>
        </div>
      )}

      {/* Example 2: ChatInputWithApi */}
      {example === 'input' && (
        <div>
          <h2>Example 2: ChatInputWithApi Component</h2>
          <p>Simple input that calls the API directly:</p>
          <ChatInputWithApi
            datasetId="example_dataset_123"
            onMessage={(message, reply) => {
              alert(`You: ${message}\n\nAI: ${reply}`);
            }}
            onError={(error) => {
              alert('Error: ' + error.message);
            }}
          />
          <pre style={{ marginTop: '20px', background: '#f5f5f5', padding: '10px' }}>
{`<ChatInputWithApi
  datasetId="example_dataset_123"
  onMessage={(message, reply) => {
    console.log('User:', message);
    console.log('AI:', reply);
  }}
  onError={(error) => {
    console.error('Error:', error);
  }}
/>`}
          </pre>
        </div>
      )}

      {/* Example 3: useChat Hook */}
      {example === 'hook' && (
        <div>
          <h2>Example 3: useChat Hook</h2>
          <p>Custom implementation using the useChat hook:</p>
          
          <div style={{ 
            border: '1px solid #ccc', 
            borderRadius: '8px', 
            padding: '20px',
            maxHeight: '400px',
            overflowY: 'auto',
            marginBottom: '10px'
          }}>
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '10px',
                  margin: '10px 0',
                  background: msg.type === 'user' ? '#e3f2fd' : '#f5f5f5',
                  borderRadius: '8px',
                  textAlign: msg.type === 'user' ? 'right' : 'left'
                }}
              >
                <strong>{msg.type === 'user' ? 'You' : 'AI'}:</strong> {msg.message}
              </div>
            ))}
            {isLoading && <div style={{ textAlign: 'center' }}>Loading...</div>}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={hookInput}
              onChange={(e) => setHookInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(hookInput);
                  setHookInput('');
                }
              }}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              disabled={isLoading}
            />
            <button 
              onClick={() => {
                sendMessage(hookInput);
                setHookInput('');
              }}
              disabled={!hookInput.trim() || isLoading}
              style={{ padding: '10px 20px' }}
            >
              Send
            </button>
          </div>

          <pre style={{ marginTop: '20px', background: '#f5f5f5', padding: '10px' }}>
{`const { messages, isLoading, sendMessage } = useChat({
  datasetId: 'example_dataset',
  onResponse: (response) => {
    console.log('Got response:', response);
  },
});

// Then use sendMessage() to send messages
sendMessage('Hello!');`}
          </pre>
        </div>
      )}

      {/* Example 4: Direct API Call */}
      {example === 'api' && (
        <div>
          <h2>Example 4: Direct API Call</h2>
          <p>Call the API directly without using components:</p>
          
          <button 
            onClick={handleApiCall}
            style={{ padding: '10px 20px', marginBottom: '20px' }}
          >
            Send API Request
          </button>

          {apiResponse && (
            <div style={{ 
              padding: '20px', 
              background: '#f5f5f5', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <strong>Response:</strong>
              <p>{apiResponse}</p>
            </div>
          )}

          <pre style={{ background: '#f5f5f5', padding: '10px' }}>
{`import { sendSimpleMessage } from '../services/chatApi';

async function askQuestion() {
  try {
    const response = await sendSimpleMessage('What is data visualization?');
    console.log(response.reply);
  } catch (error) {
    console.error('Error:', error);
  }
}`}
          </pre>
        </div>
      )}

      {/* Documentation Link */}
      <div style={{ marginTop: '40px', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
        <h3>📚 Full Documentation</h3>
        <p>
          See <code>frontend/src/services/README_CHAT.md</code> for complete API documentation,
          more examples, and integration guides.
        </p>
      </div>
    </div>
  );
};

