# Chat Endpoint Migration

## Overview

The frontend has been updated to use `/api/chat` instead of the deleted `/api/data/chat` endpoint. This provides better integration with the DSPy `chat_function` module and enables chat to have full context of generated charts.

## What Changed

### Deleted Endpoint
- ❌ **`POST /api/data/chat`** - Removed from backend

### Current Endpoints
- ✅ **`POST /api/data/analyze`** - Initial chart generation (first query)
- ✅ **`POST /api/chat`** - Chat with AI about charts (subsequent queries)

## New Flow

### 1. First Query (Chart Generation)
```
User: "Show me sales by region"
  ↓
POST /api/data/analyze
  - query: "Show me sales by region"
  - dataset_id: "dataset_123"
  - color_theme: "blue"
  ↓
Response: { charts: [...] }
  ↓
Charts rendered on screen
```

### 2. Subsequent Queries (Chat with Context)
```
User: "Make the bars blue"
  ↓
POST /api/chat
  - message: "Make the bars blue"
  - dataset_id: "dataset_123"
  - plotly_code: "import plotly.graph_objects as go\n..."  ✅ Current chart code
  - fig_data: { data: [...], layout: {...} }  ✅ Current figure data
  ↓
Response: { reply: "I've edited the code to make bars blue..." }
  ↓
AI response shown in chat
```

## Key Improvements

### ✅ Chat Has Full Context
The chat now receives:
- **`plotly_code`**: The actual Python code that generated the current chart
- **`fig_data`**: The Plotly figure JSON data
- **`dataset_id`**: Access to dataset context

This enables the AI to:
- Edit existing chart code
- Analyze figure data
- Answer questions about the visualization
- Suggest improvements

### ✅ Better User Experience
- **First query**: Generates visualization
- **Follow-up queries**: Natural conversation about the chart
- **AI can understand**: "Change the colors", "What's the highest value?", etc.

## Implementation Details

### Frontend Changes (`Visualization.tsx`)

```typescript
const generateChart = async (userQuery: string) => {
  const isFirstChart = chartSpecs.length === 0;
  
  if (isFirstChart) {
    // First chart: Use analyze endpoint
    const response = await fetch(`${config.backendUrl}/api/data/analyze`, {
      body: JSON.stringify({
        query: userQuery,
        dataset_id: datasetId,
        color_theme: context.colorTheme
      })
    });
    // ... handle chart generation
  } else {
    // Subsequent queries: Use chat endpoint with chart context
    const response = await fetch(`${config.backendUrl}/api/chat`, {
      body: JSON.stringify({
        message: userQuery,
        dataset_id: datasetId,
        plotly_code: chartSpecs[0]?.chart_spec || '',  // Current chart code
        fig_data: chartSpecs[0]?.figure || null  // Current figure data
      })
    });
    // ... handle chat response
  }
};
```

### Backend Chat Endpoint (`/api/chat`)

The endpoint routes queries to appropriate handlers:

1. **`data_query`** - Questions about the data/figure
   ```python
   # Uses fig_editor to analyze figure data
   response = fig_editor_mod(user_query=query, fig_data=fig_data)
   ```

2. **`plotly_edit_query`** - Requests to modify chart code
   ```python
   # Uses plotly_editor to edit the code
   response = plotly_editor_mod(
       user_query=query,
       dataset_context=data_context,
       plotly_code=plotly_code
   )
   ```

3. **`general_query`** - General questions
   ```python
   # Uses general Q&A
   response = general_qa(user_query=query)
   ```

## Request/Response Formats

### `/api/data/analyze` (First Chart)

**Request:**
```json
{
  "query": "Show me sales by region",
  "dataset_id": "dataset_123",
  "color_theme": "blue"
}
```

**Response:**
```json
{
  "charts": [
    {
      "chart_spec": "import plotly.graph_objects as go\n...",
      "chart_type": "bar_chart",
      "title": "Sales by Region",
      "chart_index": 0,
      "figure": { "data": [...], "layout": {...} }
    }
  ]
}
```

### `/api/chat` (Subsequent Queries)

**Request:**
```json
{
  "message": "Make the bars blue and add a title",
  "dataset_id": "dataset_123",
  "plotly_code": "import plotly.graph_objects as go\nfig = go.Figure()...",
  "fig_data": { "data": [...], "layout": {...} }
}
```

**Response:**
```json
{
  "reply": "I've edited the code to make the bars blue and added a title:\n\n```python\nimport plotly.graph_objects as go\n...\n```",
  "user": "user_id"
}
```

## Use Cases Enabled

### 1. Code Editing
```
User: "Change the chart colors to blue"
AI: "I've updated the code to use blue colors..."
```

### 2. Data Analysis
```
User: "What's the highest value in the chart?"
AI: "The highest value is 45,230 in the North region."
```

### 3. Chart Improvements
```
User: "Add error bars and make it look better"
AI: "I've added error bars and improved the styling..."
```

### 4. General Questions
```
User: "What type of chart should I use for time series data?"
AI: "For time series data, line charts are usually best because..."
```

## Migration Checklist

- ✅ Updated frontend to use `/api/chat` for subsequent queries
- ✅ Pass `plotly_code` to chat endpoint
- ✅ Pass `fig_data` to chat endpoint
- ✅ Handle chat response format (text reply instead of charts)
- ✅ Maintain `/api/data/analyze` for initial chart generation
- ✅ No linter errors

## Testing

### Test First Chart Generation
1. Upload a dataset
2. Enter query: "Show me a bar chart of sales by category"
3. ✅ Should call `/api/data/analyze`
4. ✅ Should render chart

### Test Follow-up Chat
1. After first chart is generated
2. Enter query: "What's the total?"
3. ✅ Should call `/api/chat` with `plotly_code` and `fig_data`
4. ✅ Should show AI response in chat

### Test Code Editing
1. After first chart is generated
2. Enter query: "Change the colors to blue"
3. ✅ Should call `/api/chat` with current chart code
4. ✅ Should receive edited code in response

## Notes

- The chat endpoint returns **text responses**, not new charts
- If you want the chat to generate new visualizations, you'd need to:
  1. Parse code from the response
  2. Execute it on the backend
  3. Update the chart specs
- Currently, chat is best for Q&A and code suggestions
- For generating new charts, use `/api/data/analyze`

## Future Enhancements

Potential improvements:
1. **Auto-execute edited code**: Parse code from chat response and regenerate chart
2. **Multiple charts**: Support editing multiple charts at once
3. **Chart comparison**: "Compare this with last week's data"
4. **Export suggestions**: "How should I export this for a presentation?"
5. **Data insights**: "What patterns do you see in this data?"

## Files Changed

- `frontend/src/components/steps/Visualization.tsx` - Updated to use `/api/chat`
- Backend: `/api/data/chat` deleted (no longer needed)
- `/api/chat` now receives chart context

