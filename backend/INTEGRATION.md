# AutoDash Integration Guide

## Overview

This document describes the file upload and visualization flow implemented in AutoDash.

## Architecture

```
[User CSV Upload]
        ↓
React uploads file to backend (POST /api/data/upload)
        ↓
Backend stores/reads via pandas + in-memory data store
        ↓
User sends query → backend generates chart spec (+ aggregated data)
        ↓
Frontend renders using D3
```

## Backend Components

### 1. Data Store (`backend/app/services/data_store.py`)
- In-memory storage for uploaded datasets
- Stores DataFrames per user session
- Provides CRUD operations for datasets

### 2. Data Routes (`backend/app/routes/data.py`)

#### Endpoints:

**GET `/api/data/sample`**
- Returns housing sample data from `housing_sample.csv`
- No authentication required

**POST `/api/data/sample/load`**
- Loads housing sample data into user's workspace
- Requires authentication
- Returns dataset_id for future queries

**POST `/api/data/upload`**
- Uploads CSV/Excel files
- Robust parsing with multiple encoding/delimiter fallbacks
- Stores in memory with unique dataset_id
- Returns: dataset_id, file info, preview data

**GET `/api/data/datasets`**
- Lists all datasets for current user

**GET `/api/data/datasets/{dataset_id}`**
- Get metadata about specific dataset

**GET `/api/data/datasets/{dataset_id}/preview?rows=10`**
- Get preview of dataset (default 10 rows)

**DELETE `/api/data/datasets/{dataset_id}`**
- Delete a dataset from memory

**POST `/api/data/analyze`**
- Analyze data and generate chart specification
- Request body:
  ```json
  {
    "query": "Show me a histogram of prices",
    "dataset_id": "optional_dataset_id"  // Uses latest if not provided
  }
  ```
- **TODO**: Integrate with `chart_creator.py` module
- Currently returns dummy response

### 3. Chart Creator (`backend/app/services/chart_creator.py`)

**STATUS: PLACEHOLDER - TO BE IMPLEMENTED**

Expected function signature:
```python
def generate_chart_spec(df: pd.DataFrame, query: str) -> dict:
    """
    Generate D3.js chart specification from query
    
    Returns:
    {
        "type": "histogram",
        "data": [...],  # Aggregated data
        "spec": {...},  # D3 configuration
        "metadata": {...}  # Chart metadata
    }
    """
```

Once implemented, update `backend/app/routes/data.py` line 382:
```python
# Uncomment this line:
from ..services.chart_creator import generate_chart_spec
chart_spec = generate_chart_spec(df, request.query)

# Remove the dummy response
```

## Frontend Components

### 1. FileUpload Component (`frontend/src/components/FileUpload.tsx`)
- Handles file uploads to backend
- Supports CSV, XLS, XLSX formats
- Includes "Load Sample Housing Data" button
- Shows upload status and errors
- Returns: data preview, columns, dataset_id

### 2. D3ChartRenderer Component (`frontend/src/components/D3ChartRenderer.tsx`)
- Renders D3.js charts based on specifications
- Takes chartSpec and data as props
- Currently shows placeholder
- **TODO**: Implement full D3 rendering logic based on chart spec

### 3. Visualization Component (`frontend/src/components/steps/Visualization.tsx`)
- Main visualization interface
- Sends queries to `/api/data/analyze` endpoint
- Displays chat history
- Renders charts using D3ChartRenderer
- Handles user interaction and feedback

### 4. ConnectData Component (`frontend/src/components/steps/ConnectData.tsx`)
- Data upload step in the wizard
- Uses FileUpload component
- Passes dataset_id to parent

## Sample Data

**File**: `backend/app/housing_sample.csv`

Housing dataset with 20 rows containing:
- price, bedrooms, bathrooms, sqft_living, sqft_lot
- floors, waterfront, view, condition, grade
- yr_built, zipcode, lat, long

## Example D3 Chart Types Supported

Based on the example code provided, the system should support:

1. **Histograms** - Distribution of numerical variables
2. **Bar Charts** - Aggregated metrics by category
3. **Scatter Plots** - Correlation between two variables
4. **Line Charts** - Trends over time
5. **Pie Charts** - Proportions
6. **Heat Maps** - Correlation matrices
7. **Summary Tables** - Statistical summaries

## Integration Steps

1. ✅ Data storage service created
2. ✅ Upload endpoints implemented
3. ✅ Sample data endpoints created
4. ✅ Frontend upload component updated
5. ✅ D3 renderer component created
6. ✅ Visualization interface integrated
7. ⏳ **Implement chart_creator.py** (Your task)
8. ⏳ **Update D3ChartRenderer** to execute chart specs
9. ⏳ **Update analyze endpoint** to use chart_creator

## Testing the Flow

### 1. Start Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Test Upload Flow
1. Navigate to http://localhost:5173
2. Click "Get Started" and authenticate
3. Click "Load Sample Housing Data" or upload your own CSV
4. Proceed to visualization step
5. Enter query: "Show me a histogram of prices"
6. Backend will process (currently returns dummy data)
7. Chart renderer will display placeholder

### 4. API Testing

**Test sample data:**
```bash
curl http://localhost:8000/api/data/sample
```

**Test upload (requires auth token):**
```bash
curl -X POST http://localhost:8000/api/data/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@housing_sample.csv"
```

**Test analyze (requires auth token):**
```bash
curl -X POST http://localhost:8000/api/data/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show histogram of prices", "dataset_id": "sample_abc123"}'
```

## Next Steps

1. **Implement `chart_creator.py`**:
   - Parse natural language queries
   - Analyze DataFrame schema
   - Determine appropriate chart type
   - Aggregate data as needed
   - Generate D3.js specification

2. **Update `D3ChartRenderer.tsx`**:
   - Execute D3 code based on chart spec
   - Handle different chart types
   - Add interactivity
   - Add error handling

3. **Enhance Features**:
   - Add chart export (PNG, SVG)
   - Save dashboards to database
   - Multi-chart dashboards
   - Advanced filtering and drill-down

## Environment Variables

Add to `backend/.env`:
```env
AUTO_MIGRATE=1
SESSION_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/google/callback
```

## Dependencies

### Backend
- pandas==2.1.3
- chardet==5.2.0
- openpyxl==3.1.2
- xlrd==2.0.1

### Frontend
- d3==7.8.5
- @types/d3==7.4.3

All dependencies are already in requirements.txt and package.json.

