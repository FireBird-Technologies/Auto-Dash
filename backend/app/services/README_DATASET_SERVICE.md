# Dataset Service

## Overview
Unified service that combines in-memory dataset storage and asynchronous context generation using DSPy. Previously split into `data_store.py` and `context_generator.py`, now merged into a single cohesive service.

## Architecture

### Single Service Class: `DatasetService`
Provides:
1. **In-Memory Storage**: Fast access to DataFrames during user sessions
2. **Context Generation**: AI-powered dataset descriptions using DSPy
3. **Database Integration**: Persistent metadata storage

### Singleton Pattern
```python
from ..services.dataset_service import dataset_service

# Use globally
df = dataset_service.get_dataset(user_id, dataset_id)
```

## Storage Methods

### `store_dataset(user_id, dataset_id, df, filename) -> dict`
Store a DataFrame in memory with metadata.

**Parameters:**
- `user_id`: User ID (int)
- `dataset_id`: Unique dataset identifier (str)
- `df`: pandas DataFrame
- `filename`: Original filename (str)

**Returns:**
```python
{
    "dataset_id": "upload_abc123",
    "filename": "data.csv",
    "uploaded_at": "2025-10-11T...",
    "row_count": 1000,
    "column_count": 5,
    "columns": ["col1", "col2", ...]
}
```

### `get_dataset(user_id, dataset_id) -> DataFrame | None`
Retrieve a DataFrame from memory.

**Returns:** DataFrame or None if not found

### `get_dataset_info(user_id, dataset_id) -> dict | None`
Get metadata without loading the full DataFrame.

### `list_datasets(user_id) -> List[dict]`
List all datasets for a user.

### `delete_dataset(user_id, dataset_id) -> bool`
Remove a dataset from memory.

### `get_latest_dataset(user_id) -> Tuple[str, DataFrame] | None`
Get the most recently uploaded dataset.

**Returns:** `(dataset_id, DataFrame)` or None

## Context Generation Methods

### `generate_context_async(dataset_id, df) -> str`
Asynchronously generate AI-powered dataset context.

**Process:**
1. Updates DB status to "generating"
2. Prepares DataFrame metadata
3. Calls DSPy to generate description
4. Saves to database with status "completed"
5. Returns context string

**Usage:**
```python
# In async route
asyncio.create_task(
    dataset_service.generate_context_async(dataset_id, df.copy())
)
```

### `_generate_context_sync(dataset_id, df) -> str`
Internal synchronous implementation (runs in thread pool).

## Combined Operations

### `store_and_generate_context(user_id, dataset_id, df, filename) -> dict`
Convenience method to store dataset and prepare for context generation.

**Note:** Context generation should still be triggered separately using `asyncio.create_task()` to avoid blocking.

## In-Memory Storage Structure

```python
{
    user_id: {
        dataset_id: {
            "df": DataFrame,
            "filename": str,
            "uploaded_at": datetime,
            "row_count": int,
            "column_count": int,
            "columns": list
        }
    }
}
```

## Database Schema

Context and metadata stored in `Dataset` model:
- `dataset_id`: Unique identifier
- `context`: Generated description (Text)
- `context_status`: "pending", "generating", "completed", "failed"
- `context_generated_at`: Timestamp
- `columns_info`: JSON metadata

## Typical Workflow

```python
# 1. User uploads file
df = pd.read_csv(file)

# 2. Create DB record
db_dataset = DatasetModel(
    user_id=current_user.id,
    dataset_id=dataset_id,
    filename=file.filename,
    row_count=len(df),
    column_count=len(df.columns),
    context_status="pending"
)
db.add(db_dataset)
db.commit()

# 3. Store in memory for fast access
info = dataset_service.store_dataset(
    user_id=current_user.id,
    dataset_id=dataset_id,
    df=df,
    filename=file.filename
)

# 4. Generate context asynchronously
asyncio.create_task(
    dataset_service.generate_context_async(dataset_id, df.copy())
)

# 5. Return immediately (context generation continues in background)
return {"dataset_id": dataset_id, "context_status": "pending"}
```

## Context Generation with DSPy

### Input to DSPy
```python
{
    "columns": ["age", "income", "city"],
    "dtypes": {"age": "int64", "income": "float64", "city": "object"},
    "shape": (1000, 3),
    "sample_values": [{...}, {...}, {...}],
    "statistics": {...}
}
```

### Output from DSPy
A rich textual description of the dataset, for example:
> "This dataset contains demographic and financial information with 1000 records across 3 columns. The 'age' column ranges from 18 to 65, 'income' shows typical salary distributions, and 'city' includes geographical locations..."

## Benefits of Merged Service

### Before (Separate Files)
```python
from ..services.data_store import data_store
from ..services.context_generator import context_generator

data_store.store_dataset(...)
context_generator.generate_context_async(...)
```

### After (Unified)
```python
from ..services.dataset_service import dataset_service

dataset_service.store_dataset(...)
dataset_service.generate_context_async(...)
```

**Advantages:**
1. ✅ Single import statement
2. ✅ Cohesive service with related functionality
3. ✅ Easier to maintain and understand
4. ✅ Better encapsulation
5. ✅ Backward compatible via exports

## Backward Compatibility

Old imports still work:
```python
from ..services.dataset_service import data_store, context_generator

# These are aliases to dataset_service
data_store.store_dataset(...)  # Works!
context_generator.generate_context_async(...)  # Works!
```

## Error Handling

### Storage Errors
- Returns None if dataset not found
- Returns False if deletion fails

### Context Generation Errors
- Database updated with status "failed"
- Exception propagated to caller
- Can be retried by resetting status to "pending"

## Performance Considerations

### Memory Usage
- DataFrames stored in RAM
- Lost on server restart
- Limited by available memory

### Context Generation
- CPU-intensive (DSPy processing)
- Runs in thread pool to avoid blocking
- Typically takes 2-10 seconds depending on dataset size

### Optimization Tips
1. Copy DataFrames before async operations: `df.copy()`
2. Clean data before storage to reduce memory: `df.replace({np.nan: None})`
3. Consider implementing LRU cache for frequent access
4. Monitor memory usage for large datasets

## Testing

### Unit Tests
```python
def test_store_and_retrieve():
    service = DatasetService()
    df = pd.DataFrame({"a": [1, 2, 3]})
    
    service.store_dataset(1, "test_id", df, "test.csv")
    retrieved = service.get_dataset(1, "test_id")
    
    assert retrieved is not None
    assert len(retrieved) == 3
```

### Integration Tests
```python
async def test_context_generation():
    service = DatasetService()
    df = pd.DataFrame({"a": [1, 2, 3]})
    
    # Requires DB and DSPy setup
    context = await service.generate_context_async("test_id", df)
    assert isinstance(context, str)
    assert len(context) > 0
```

## Future Enhancements

1. **Persistent Storage**: Save DataFrames to disk/S3
2. **Caching**: Redis cache for frequently accessed datasets
3. **Batch Processing**: Generate contexts for multiple datasets
4. **Context Versioning**: Track changes to generated contexts
5. **Custom DSPy Modules**: Specialized context generators per data type
6. **Compression**: Reduce memory footprint for large datasets
7. **Sharding**: Distribute storage across multiple services

## Related Files

- `backend/app/services/dataset_service.py` - Main service implementation
- `backend/app/services/agents.py` - DSPy modules including CreateDatasetContext
- `backend/app/models.py` - Dataset database model
- `backend/app/routes/data.py` - API endpoints using this service

## Migration Notes

### From Separate Services
If you have existing code using old imports:

**Option 1: Update imports (recommended)**
```python
# Old
from ..services.data_store import data_store
from ..services.context_generator import context_generator

# New
from ..services.dataset_service import dataset_service
```

**Option 2: Keep old imports (temporary)**
```python
# Still works due to backward compatibility exports
from ..services.dataset_service import data_store, context_generator
```

### Database
No changes required. Uses existing `Dataset` model.

### Environment Variables
No changes required. Uses existing configuration.

## Summary

The `DatasetService` provides a unified interface for dataset management, combining storage and AI-powered context generation. It simplifies the codebase while maintaining all functionality from the previous separate services.

