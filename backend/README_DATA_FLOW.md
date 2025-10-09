# Data Flow Documentation

## File Upload & Chart Generation Flow

### Overview
This document describes how data flows from user upload through visualization rendering.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Upload CSV/Excel OR Load Sample Data               │
│  Component: FileUpload.tsx                                   │
│  Action: POST /api/data/upload OR /api/data/sample/load     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: FileProcessor                                      │
│  - Detects encoding (chardet)                                │
│  - Tries multiple delimiters (,  ;  |  tab)                  │
│  - Parses with pandas                                        │
│  - Generates unique dataset_id                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: DataStore (In-Memory)                              │
│  Structure: {user_id: {dataset_id: {df, filename, ...}}}    │
│  - Stores full DataFrame                                     │
│  - Stores metadata (row count, columns, types)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Response to Frontend                                        │
│  {                                                           │
│    dataset_id: "upload_abc123",                              │
│    file_info: {                                              │
│      filename, rows, columns, column_names,                  │
│      data_types, preview (first 5 rows)                      │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: App State                                         │
│  - setData(preview_data)                                     │
│  - setDatasetId(dataset_id)                                  │
│  - Navigate to Visualization step                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: User Asks Question / Query                         │
│  Component: Visualization.tsx                                │
│  Example: "Show me a histogram of prices"                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend → Backend                                          │
│  POST /api/data/analyze                                      │
│  {                                                           │
│    query: "Show me a histogram of prices",                   │
│    dataset_id: "upload_abc123"                               │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: Analyze Endpoint                                   │
│  1. Retrieve DataFrame from DataStore                        │
│  2. Call chart_creator.generate_chart_spec(df, query)        │
│  3. [PLACEHOLDER] Return chart specification                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  chart_creator.py (TO BE IMPLEMENTED)                        │
│  Input: df (pandas DataFrame), query (string)                │
│  Processing:                                                 │
│    - Parse natural language query                            │
│    - Determine chart type (histogram, bar, scatter, etc.)    │
│    - Aggregate data if needed                                │
│    - Generate D3.js configuration                            │
│  Output: chart_spec dict                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Chart Specification Format                                  │
│  {                                                           │
│    "type": "histogram",                                      │
│    "data": [                                                 │
│      {"x0": 800000, "x1": 850000, "count": 5},              │
│      {"x0": 850000, "x1": 900000, "count": 8},              │
│      ...                                                     │
│    ],                                                        │
│    "spec": {                                                 │
│      "width": 800,                                           │
│      "height": 600,                                          │
│      "margins": {...},                                       │
│      "color": "steelblue",                                   │
│      "bins": 50                                              │
│    },                                                        │
│    "metadata": {                                             │
│      "title": "Distribution of Housing Prices",              │
│      "x_label": "Price",                                     │
│      "y_label": "Frequency"                                  │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Response to Frontend                                        │
│  {                                                           │
│    message: "Chart generated successfully",                  │
│    query: "Show me a histogram of prices",                   │
│    dataset_id: "upload_abc123",                              │
│    chart_spec: { ... }                                       │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Visualization.tsx                                 │
│  - setChartSpec(result.chart_spec)                           │
│  - Add to chat history                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: D3ChartRenderer.tsx                               │
│  - Receives chartSpec and data                               │
│  - Executes D3.js code based on spec                         │
│  - Renders interactive visualization                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  D3.js Rendering (TO BE IMPLEMENTED)                         │
│  Based on example code provided:                             │
│  - createHistogram(data, 'price')                            │
│  - createBarChart(data, 'bedrooms')                          │
│  - createScatterPlot(data)                                   │
│  - createHeatMap(data)                                       │
│  - etc.                                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  USER SEES VISUALIZATION                                     │
│  - Interactive D3 chart                                      │
│  - Can ask follow-up questions                               │
│  - Can refine visualization                                  │
└─────────────────────────────────────────────────────────────┘
```

## Data Structures

### 1. In-Memory DataStore
```python
{
  user_id_123: {
    "upload_abc123": {
      "df": <pandas.DataFrame>,
      "filename": "housing.csv",
      "uploaded_at": "2025-10-09T12:00:00",
      "row_count": 1000,
      "column_count": 14,
      "columns": ["price", "bedrooms", ...]
    },
    "sample_xyz789": {
      ...
    }
  },
  user_id_456: {
    ...
  }
}
```

### 2. Dataset Info Response
```json
{
  "dataset_id": "upload_abc123",
  "filename": "housing.csv",
  "uploaded_at": "2025-10-09T12:00:00.000Z",
  "row_count": 1000,
  "column_count": 14,
  "columns": ["price", "bedrooms", "bathrooms", ...]
}
```

### 3. Chart Spec Example (Histogram)
```json
{
  "type": "histogram",
  "data": [
    {"bin_start": 800000, "bin_end": 850000, "frequency": 5},
    {"bin_start": 850000, "bin_end": 900000, "frequency": 8}
  ],
  "spec": {
    "width": 800,
    "height": 600,
    "margins": {"top": 20, "right": 30, "bottom": 40, "left": 50},
    "color": "steelblue",
    "bins": 50,
    "x_axis": {
      "label": "Price",
      "format": "$,.0f"
    },
    "y_axis": {
      "label": "Frequency",
      "format": ",.0f"
    }
  },
  "metadata": {
    "title": "Distribution of Housing Prices",
    "description": "Histogram showing the distribution of home prices in the dataset"
  }
}
```

## API Endpoints Reference

### Upload/Load Data

#### POST `/api/data/upload`
**Request:**
- Content-Type: multipart/form-data
- Body: file (CSV/Excel)
- Headers: Authorization: Bearer <token>

**Response:**
```json
{
  "message": "File uploaded and processed successfully",
  "user_id": 123,
  "dataset_id": "upload_abc123",
  "file_info": {
    "dataset_id": "upload_abc123",
    "filename": "housing.csv",
    "rows": 1000,
    "columns": 14,
    "column_names": [...],
    "data_types": {...},
    "preview": [...],
    "file_size_bytes": 50000,
    "processing_method": "robust_parser"
  }
}
```

#### POST `/api/data/sample/load`
**Request:**
- Headers: Authorization: Bearer <token>

**Response:**
```json
{
  "message": "Sample data loaded successfully",
  "dataset_id": "sample_abc123",
  "dataset_info": {
    "dataset_id": "sample_abc123",
    "filename": "housing_sample.csv",
    "uploaded_at": "2025-10-09T12:00:00.000Z",
    "row_count": 20,
    "column_count": 14,
    "columns": [...]
  }
}
```

### Query/Analyze Data

#### POST `/api/data/analyze`
**Request:**
```json
{
  "query": "Show me a histogram of prices",
  "dataset_id": "upload_abc123"  // Optional, uses latest if omitted
}
```

**Response:**
```json
{
  "message": "Chart generated successfully",
  "query": "Show me a histogram of prices",
  "dataset_id": "upload_abc123",
  "chart_spec": {
    "type": "histogram",
    "data": [...],
    "spec": {...},
    "metadata": {...}
  }
}
```

### Dataset Management

#### GET `/api/data/datasets`
List all datasets for current user

#### GET `/api/data/datasets/{dataset_id}`
Get dataset metadata

#### GET `/api/data/datasets/{dataset_id}/preview?rows=10`
Get preview of dataset

#### DELETE `/api/data/datasets/{dataset_id}`
Delete dataset

## Example Queries

The system should handle queries like:

- "Show me a histogram of prices"
- "Create a scatter plot of sqft_living vs price"
- "Bar chart of average price by number of bedrooms"
- "Line chart of average price by year built"
- "Pie chart showing waterfront vs non-waterfront properties"
- "Heat map of correlations between numerical variables"
- "Summary statistics for all numerical columns"

## Implementation Notes

1. **Data Persistence**: Currently in-memory only. Consider adding:
   - Redis for distributed caching
   - PostgreSQL for permanent storage
   - S3 for large file storage

2. **Security**: 
   - File size limits (currently none)
   - File type validation (done)
   - Malicious file detection
   - Rate limiting

3. **Scalability**:
   - Current in-memory store won't scale
   - Consider dataset expiration
   - Add pagination for large previews

4. **Error Handling**:
   - Robust file parsing (implemented)
   - Query validation (needs implementation)
   - Graceful failure modes

