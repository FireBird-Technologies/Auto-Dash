# Context Storage Update

## Changes Made

Updated the dataset service to store generated context in both the database **AND** in-memory storage.

## What Changed

### 1. **In-Memory Data Structure**
Added context fields to the in-memory storage:

**Before:**
```python
{
    "df": DataFrame,
    "filename": str,
    "uploaded_at": datetime,
    "row_count": int,
    "column_count": int,
    "columns": list
}
```

**After:**
```python
{
    "df": DataFrame,
    "filename": str,
    "uploaded_at": datetime,
    "row_count": int,
    "column_count": int,
    "columns": list,
    "context": str | None,           # NEW
    "context_status": str            # NEW ("pending", "generating", "completed", "failed")
}
```

### 2. **Updated Methods**

#### `store_dataset()`
- Now initializes `context` as `None`
- Sets `context_status` to `"pending"`

#### `get_dataset_info()`
- Now returns context and status:
```python
{
    "dataset_id": "...",
    "filename": "...",
    # ... existing fields ...
    "context": "Generated description...",  # NEW
    "context_status": "completed"           # NEW
}
```

#### `generate_context_async()` & `_generate_context_sync()`
- Now accepts optional `user_id` parameter
- Updates **both** database and in-memory storage
- Status updates happen in both places:
  - "pending" → "generating" → "completed"/"failed"

### 3. **New Methods**

#### `get_context(user_id, dataset_id) -> str | None`
Retrieve just the context from memory without full metadata.

```python
context = dataset_service.get_context(user_id, dataset_id)
if context:
    print(context)
```

#### `get_context_status(user_id, dataset_id) -> str`
Check context generation status from memory.

```python
status = dataset_service.get_context_status(user_id, dataset_id)
# Returns: "pending", "generating", "completed", "failed", or "not_found"
```

### 4. **Route Updates**

Updated all context generation calls to pass `user_id`:

**Before:**
```python
asyncio.create_task(
    dataset_service.generate_context_async(dataset_id, df.copy())
)
```

**After:**
```python
asyncio.create_task(
    dataset_service.generate_context_async(dataset_id, df.copy(), current_user.id)
)
```

## Benefits

### 1. **Dual Storage**
- **Database**: Persistent across server restarts
- **Memory**: Fast access during user session

### 2. **No Extra API Calls**
Frontend can get context immediately with dataset info:
```python
info = dataset_service.get_dataset_info(user_id, dataset_id)
# info now includes context and status
```

### 3. **Real-Time Status**
Can check context status without database query:
```python
status = dataset_service.get_context_status(user_id, dataset_id)
if status == "completed":
    context = dataset_service.get_context(user_id, dataset_id)
```

### 4. **Session Persistence**
Context available throughout user session without re-querying database.

## Usage Examples

### Uploading Data
```python
# 1. Store dataset
info = dataset_service.store_dataset(user_id, dataset_id, df, filename)
# info["context"] = None
# info["context_status"] = "pending"

# 2. Trigger context generation
asyncio.create_task(
    dataset_service.generate_context_async(dataset_id, df, user_id)
)

# 3. Later, check status
status = dataset_service.get_context_status(user_id, dataset_id)
# Returns: "generating" or "completed"

# 4. Retrieve context
if status == "completed":
    context = dataset_service.get_context(user_id, dataset_id)
```

### Getting Dataset Info
```python
info = dataset_service.get_dataset_info(user_id, dataset_id)

print(f"Context: {info['context']}")
print(f"Status: {info['context_status']}")
```

### Listing Datasets with Context
```python
datasets = dataset_service.list_datasets(user_id)

for ds in datasets:
    print(f"{ds['filename']}: {ds['context_status']}")
    if ds['context']:
        print(f"  → {ds['context'][:100]}...")
```

## Data Flow

```
1. File Upload
   ↓
2. Store in Memory (context = None, status = "pending")
   ↓
3. Store in Database (context = NULL, status = "pending")
   ↓
4. Trigger Async Context Generation
   ↓
5. Update Memory (status = "generating")
   ↓
6. Update Database (status = "generating")
   ↓
7. DSPy Generates Context
   ↓
8. Update Memory (context = "...", status = "completed")
   ↓
9. Update Database (context = "...", status = "completed")
   ↓
10. Frontend Can Access Context from get_dataset_info()
```

## Frontend Integration

### Polling for Context
```typescript
async function waitForContext(datasetId: string) {
  const maxAttempts = 30; // 1 minute max
  
  for (let i = 0; i < maxAttempts; i++) {
    const info = await fetch(`/api/data/datasets/${datasetId}`).then(r => r.json());
    
    if (info.context_status === 'completed') {
      return info.context;
    }
    
    if (info.context_status === 'failed') {
      throw new Error('Context generation failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
  }
  
  throw new Error('Context generation timeout');
}
```

### Display Context
```typescript
const info = await fetch(`/api/data/datasets/${datasetId}`).then(r => r.json());

if (info.context) {
  console.log('Dataset Context:', info.context);
  console.log('Status:', info.context_status);
}
```

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Context generation not started yet |
| `generating` | DSPy is currently generating context |
| `completed` | Context successfully generated |
| `failed` | Context generation encountered an error |
| `not_found` | Dataset doesn't exist in memory |

## Memory Considerations

### Context Size
- Typical context: 200-500 characters
- Memory impact: Minimal (few KB per dataset)
- Acceptable for 100s-1000s of datasets

### Cleanup
Context is automatically removed when:
1. Dataset is deleted via `delete_dataset()`
2. Server restarts (in-memory only, database persists)
3. User session expires (data stays in memory)

### Best Practices
1. **Copy DataFrames**: Always use `df.copy()` for async operations
2. **Pass user_id**: Ensure user_id passed to `generate_context_async()`
3. **Check Status**: Verify context_status before using context
4. **Handle Failures**: Implement retry logic for failed generations

## Migration Notes

### Existing Datasets
- Old datasets in memory don't have context fields
- `get()` method used for backward compatibility
- New uploads automatically get context fields

### Database
- No schema changes required
- Uses existing `Dataset.context` column
- Both systems stay in sync

## Testing

### Test Context Storage
```python
# Store dataset
info = dataset_service.store_dataset(1, "test_id", df, "test.csv")
assert info["context"] is None
assert info["context_status"] == "pending"

# Generate context
context = await dataset_service.generate_context_async("test_id", df, 1)
assert context is not None

# Verify storage
stored_context = dataset_service.get_context(1, "test_id")
assert stored_context == context

status = dataset_service.get_context_status(1, "test_id")
assert status == "completed"
```

## Files Modified

- `backend/app/services/dataset_service.py` - Updated storage structure and methods
- `backend/app/routes/data.py` - Updated context generation calls
- `CONTEXT_STORAGE_UPDATE.md` - This file

## Summary

Context is now stored in **both** database and memory:
- ✅ Database: Persistent storage
- ✅ Memory: Fast session access
- ✅ Status tracking in both locations
- ✅ New convenience methods for context retrieval
- ✅ Backward compatible
- ✅ No breaking changes

