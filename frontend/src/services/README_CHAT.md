# Chat API Integration

This directory contains the chat API service and related utilities for integrating with the backend chat endpoint powered by `chat_function` DSPy module.

## Overview

The chat endpoint supports three types of queries:
1. **General Q&A**: Ask questions about anything
2. **Plotly Code Editing**: Request modifications to Plotly code
3. **Data Analysis**: Ask questions about figure data and datasets

## Components

### 1. Chat API Service (`chatApi.ts`)

Low-level API functions for making requests to the chat endpoint.

```typescript
import { sendChatMessage, sendSimpleMessage, requestPlotlyEdit } from '../services/chatApi';

// Simple message
const response = await sendSimpleMessage("Hello!");

// Message with dataset context
const response = await sendMessageWithDataset("What's the average?", datasetId);

// Request Plotly code edit
const response = await requestPlotlyEdit(
  "Change colors to blue",
  plotlyCodeString,
  datasetId
);

// Request data analysis
const response = await requestDataAnalysis(
  "What's the highest value?",
  figureData,
  datasetId
);
```

### 2. useChat Hook (`../hooks/useChat.ts`)

React hook for managing chat state and interactions.

```typescript
import { useChat } from '../hooks/useChat';

function MyComponent() {
  const { messages, isLoading, sendMessage, clearMessages } = useChat({
    datasetId: 'dataset_123',
    onResponse: (response) => console.log('Got reply:', response.reply),
    onError: (error) => console.error('Error:', error),
  });

  return (
    <div>
      {messages.map((msg, idx) => (
        <div key={idx}>{msg.message}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

### 3. Chat Component (`../components/Chat.tsx`)

Full-featured chat interface with message history.

```typescript
import { Chat } from '../components/Chat';

function MyPage() {
  return (
    <Chat 
      datasetId="dataset_123"
      figData={plotlyFigureData}
      plotlyCode={plotlyCodeString}
    />
  );
}
```

### 4. ChatInputWithApi Component (`../components/ChatInputWithApi.tsx`)

Simple input component that directly calls the chat API.

```typescript
import { ChatInputWithApi } from '../components/ChatInputWithApi';

function MyPage() {
  return (
    <ChatInputWithApi
      datasetId="dataset_123"
      onMessage={(message, reply) => {
        console.log('User said:', message);
        console.log('AI replied:', reply);
      }}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

## API Reference

### ChatRequest

```typescript
interface ChatRequest {
  message: string;           // Required: The message to send
  dataset_id?: string;       // Optional: Dataset ID for context
  fig_data?: Record<string, any>;  // Optional: Plotly figure data
  plotly_code?: string;      // Optional: Plotly code to edit
}
```

### ChatResponse

```typescript
interface ChatResponse {
  reply: string;    // The AI's response
  user?: string;    // User ID (from backend)
}
```

## Usage Examples

### Example 1: Simple Q&A

```typescript
import { sendSimpleMessage } from '../services/chatApi';

async function askQuestion() {
  const response = await sendSimpleMessage("What is data visualization?");
  console.log(response.reply);
}
```

### Example 2: Dataset Analysis

```typescript
import { sendMessageWithDataset } from '../services/chatApi';

async function analyzeDataset(datasetId: string) {
  const response = await sendMessageWithDataset(
    "What's the average value in this dataset?",
    datasetId
  );
  console.log(response.reply);
}
```

### Example 3: Edit Plotly Code

```typescript
import { requestPlotlyEdit } from '../services/chatApi';

async function editChart(plotlyCode: string, datasetId: string) {
  const response = await requestPlotlyEdit(
    "Change the chart colors to blue and add a title",
    plotlyCode,
    datasetId
  );
  console.log(response.reply); // Contains the edited code
}
```

### Example 4: Analyze Figure Data

```typescript
import { requestDataAnalysis } from '../services/chatApi';

async function analyzeFigure(figData: any, datasetId: string) {
  const response = await requestDataAnalysis(
    "What's the highest value in this chart?",
    figData,
    datasetId
  );
  console.log(response.reply);
}
```

### Example 5: Using the Hook

```typescript
import React, { useState } from 'react';
import { useChat } from '../hooks/useChat';

function ChatExample() {
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage } = useChat({
    datasetId: 'dataset_123',
  });

  const handleSubmit = () => {
    sendMessage(input);
    setInput('');
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.type}>
            {msg.message}
          </div>
        ))}
      </div>
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={handleSubmit} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

## Error Handling

All API functions throw errors that should be caught:

```typescript
import { sendChatMessage } from '../services/chatApi';

try {
  const response = await sendChatMessage({ message: 'Hello' });
  console.log(response.reply);
} catch (error) {
  if (error instanceof Error) {
    console.error('Chat failed:', error.message);
  }
}
```

## Integration with Existing Code

### Replace ChatInput with ChatInputWithApi

Before:
```typescript
<ChatInput onSend={handleSend} disabled={isLoading} />
```

After:
```typescript
<ChatInputWithApi
  datasetId={datasetId}
  onMessage={(message, reply) => {
    // Handle message and reply
  }}
  onError={(error) => {
    // Handle error
  }}
  disabled={isLoading}
/>
```

### Add Chat to Visualization Page

```typescript
import { Chat } from '../components/Chat';

function Visualization({ datasetId }) {
  const [chartSpecs, setChartSpecs] = useState([]);

  return (
    <div>
      {/* Existing visualization */}
      <div className="charts">
        {chartSpecs.map(spec => <Chart key={spec.id} spec={spec} />)}
      </div>

      {/* Add chat sidebar */}
      <aside>
        <Chat 
          datasetId={datasetId}
          plotlyCode={chartSpecs[0]?.chart_spec}
        />
      </aside>
    </div>
  );
}
```

## Backend Routing

The `chat_function` module routes queries to different handlers:

- **general_query**: General Q&A → returns answer
- **plotly_edit_query**: Plotly code editing → returns edited_code and reasoning
- **data_query**: Data analysis → returns analysis_code

The routing is automatic based on the query content and provided parameters.

