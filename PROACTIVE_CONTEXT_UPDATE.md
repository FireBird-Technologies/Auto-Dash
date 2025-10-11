# Proactive Context Generation & TypeError Fix

## Issues Fixed

### 1. TypeError: Column Names Not Strings
**Error:** `TypeError: sequence item 0: expected str instance, int found`

**Problem:** 
- `df.columns.tolist()` can return integers or other types for column names
- `str.join()` expects all items to be strings

**Solution:**
```python
# Before (caused error)
dataset_context = f"Dataset with {len(df)} rows. Columns: {', '.join(df.columns.tolist())}"

# After (fixed)
columns = [str(col) for col in df.columns.tolist()]
dataset_context = f"Dataset with {len(df)} rows. Columns: {', '.join(columns)}"
```

**Files Fixed:**
- `backend/app/routes/data.py` - Line 482
- `backend/app/services/chart_creator.py` - Line 65

### 2. Proactive Context Generation
**Enhancement:** Generate dataset context as soon as user starts typing

**Problem:**
- Context generation happens during upload (async)
- If user quickly navigates to visualization, context might not be ready
- Chart quality suffers without context

**Solution:**
Added proactive context preparation when user starts typing

## Implementation

### Backend: New Endpoint

**`POST /api/data/datasets/{dataset_id}/prepare-context`**

Triggers context generation if not already started.

**Features:**
- Checks current status (pending, generating, completed, failed)
- Only starts generation if needed
- Idempotent (safe to call multiple times)
- Non-blocking (returns immediately)

**Response:**
```json
{
  "message": "Context generation started",
  "status": "generating"
}
```

**Logic:**
```python
status = dataset_service.get_context_status(user_id, dataset_id)

if status in ["completed", "generating"]:
    # Already done or in progress
    return {"status": status}

if status in ["pending", "failed"]:
    # Trigger generation
    asyncio.create_task(generate_context_async(...))
    return {"status": "generating"}
```

### Frontend: Automatic Trigger

**`frontend/src/components/steps/Visualization.tsx`**

**Added:**
1. State tracking: `contextPrepared`
2. Preparation function: `prepareContext()`
3. Change handler: `handleQueryChange()`

**Flow:**
```typescript
// User starts typing
handleQueryChange(e) {
  setQuery(e.target.value);
  
  // First character typed? Prepare context!
  if (newQuery.length > 0 && !contextPrepared) {
    prepareContext();
  }
}

// Prepare context in background
async prepareContext() {
  await fetch(`${backendUrl}/api/data/datasets/${datasetId}/prepare-context`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  setContextPrepared(true);
}
```

## User Experience Flow

### Before Fix
```
1. User uploads file
2. Navigate to visualization
3. Start typing query
4. Submit query
5. ❌ Context not ready → fallback used
6. Lower quality visualization
```

### After Fix
```
1. User uploads file (context generation starts)
2. Navigate to visualization
3. Start typing first character
   → Context preparation triggered proactively
4. Continue typing query (context generates in background)
5. Submit query
6. ✅ Context ready → full context used
7. High quality visualization
```

## Benefits

### 1. Better Chart Quality
- Context ready when user submits query
- More accurate visualizations
- Better column selection
- Meaningful titles and labels

### 2. Seamless UX
- User doesn't notice context generation
- No waiting or loading states
- Natural typing flow maintained

### 3. Intelligent Fallback
- If context still not ready, uses basic fallback
- Never blocks or fails
- Graceful degradation

### 4. Resource Efficient
- Only generates once per dataset
- Idempotent (safe multiple calls)
- Non-blocking

## Example Timeline

```
T+0s:  User uploads file
       → Context generation starts (background)
       
T+2s:  User navigates to visualization page
       → Context still generating (2-5s typical)
       
T+3s:  User types first character: "S"
       → prepare-context called
       → Checks status: "generating"
       → Returns: already in progress
       
T+5s:  User types: "Show price distribu"
       → Context generation completes
       
T+7s:  User submits: "Show price distribution"
       → Context ready! ✅
       → High quality chart generated
```

## API Documentation

### New Endpoint

**POST /api/data/datasets/{dataset_id}/prepare-context**

Proactively trigger context generation for a dataset.

**Authentication:** Required (Bearer token)

**Parameters:**
- `dataset_id` (path): Dataset identifier

**Responses:**

**200 OK - Already Available**
```json
{
  "message": "Context already available or in progress",
  "status": "completed"  // or "generating"
}
```

**200 OK - Started**
```json
{
  "message": "Context generation started",
  "status": "generating"
}
```

**404 Not Found**
```json
{
  "detail": "Dataset not found"
}
```

**Status Values:**
- `pending` - Not started yet
- `generating` - Currently being generated
- `completed` - Ready to use
- `failed` - Generation failed (will retry)
- `not_found` - Dataset doesn't exist

## Testing

### Test Context Preparation

```bash
# Upload file
POST /api/data/upload
→ Returns dataset_id: "upload_abc123"

# User starts typing (simulated)
POST /api/data/datasets/upload_abc123/prepare-context
→ {"status": "generating"}

# Call again (idempotent)
POST /api/data/datasets/upload_abc123/prepare-context
→ {"status": "generating"} or {"status": "completed"}

# Generate chart (context ready)
POST /api/data/analyze
{
  "query": "Show distribution",
  "dataset_id": "upload_abc123"
}
→ Uses full context ✅
```

### Test TypeError Fix

```python
# Test with numeric column names
df = pd.DataFrame({
    0: [1, 2, 3],
    1: [4, 5, 6]
})

# Before: TypeError
columns = df.columns.tolist()  # [0, 1]
', '.join(columns)  # ❌ TypeError

# After: Works
columns = [str(col) for col in df.columns.tolist()]  # ['0', '1']
', '.join(columns)  # ✅ '0, 1'
```

## Files Modified

### Backend
- `backend/app/routes/data.py`
  - Fixed TypeError in fallback context (line 482)
  - Added `/datasets/{dataset_id}/prepare-context` endpoint

- `backend/app/services/chart_creator.py`
  - Fixed TypeError in fallback context (line 65)

### Frontend
- `frontend/src/components/steps/Visualization.tsx`
  - Added `contextPrepared` state
  - Added `prepareContext()` function
  - Added `handleQueryChange()` handler
  - Updated textarea `onChange` to use new handler

## Summary

✅ **Fixed TypeError** - Column names properly converted to strings
✅ **Proactive Context** - Generates when user starts typing
✅ **Better UX** - Context ready by submission time
✅ **Idempotent** - Safe to call multiple times
✅ **Non-blocking** - Never delays user interaction
✅ **Graceful Fallback** - Works even if context not ready

**Result:** Higher quality visualizations with no UX impact!

