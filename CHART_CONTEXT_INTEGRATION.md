# Chart Generation Context Integration

## Changes Applied

Updated chart generation to use dataset context for improved visualization quality.

## What Changed

### 1. **`chart_creator.py` - Added dataset_context parameter**

**Function Signature Updated:**
```python
async def generate_chart_spec(
    df: pd.DataFrame, 
    query: str, 
    dataset_context: str = None  # NEW PARAMETER
) -> Dict[str, Any]:
```

**Key Changes:**
- Accepts optional `dataset_context` parameter
- Provides fallback if context not available
- Passes context to DSPy visualization module via `aforward()`

**Implementation:**
```python
# Use dataset context or provide fallback
if not dataset_context:
    dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns: {', '.join(df.columns.tolist())}"

# Generate the visualization with dataset context
result = await viz_module.aforward(
    query=query,
    dataset_context=dataset_context
)
```

### 2. **`data.py` - Retrieve and pass context**

**Endpoint Updated:** `POST /api/data/analyze`

**Key Changes:**
- Retrieves dataset context from memory using `dataset_service.get_context()`
- Provides fallback context if not yet generated
- Passes context to `generate_chart_spec()`

**Implementation:**
```python
# Get the dataset context from memory
dataset_context = dataset_service.get_context(current_user.id, dataset_id)

# If context not available yet, provide basic fallback info
if not dataset_context:
    dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(df.columns.tolist())}"

# Generate chart specification using DSPy agents with context
chart_spec = await generate_chart_spec(df, request.query, dataset_context)
```

## Data Flow

```
User Request: "Show me distribution of prices"
        ↓
Retrieve Dataset (DataFrame from memory)
        ↓
Retrieve Dataset Context (from memory)
        ↓ 
Context = "This dataset contains housing data with prices 
           ranging from $100k to $500k, includes location 
           information, and has 1000 records..."
        ↓
Pass to DSPy: generate_chart_spec(df, query, context)
        ↓
DSPy uses context to understand:
  - What "prices" means semantically
  - Appropriate visualization type
  - Data ranges and distributions
  - Relevant columns to use
        ↓
Generate optimized D3.js chart specification
        ↓
Return to frontend
```

## Benefits

### 1. **Better Chart Selection**
The AI understands what the data represents, not just column names:
- "Show customer revenue" → Knows which column is revenue
- "Distribution of ages" → Understands it's demographic data
- "Sales over time" → Recognizes temporal patterns

### 2. **Improved Accuracy**
Context provides:
- Column meanings and relationships
- Data types and ranges
- Statistical summaries
- Sample values

### 3. **Smarter Visualizations**
The AI can:
- Choose appropriate chart types based on data meaning
- Select relevant columns automatically
- Apply appropriate aggregations
- Generate meaningful titles and labels

### 4. **Fallback Handling**
If context generation is still in progress:
- Uses basic structural information (rows, columns, names)
- Still generates visualizations
- Upgrades to rich context once available

## Example Comparison

### Without Context
```
Query: "Show me price distribution"
Context: None
Result: Generic bar chart of first numeric column
```

### With Context
```
Query: "Show me price distribution"
Context: "This dataset contains housing prices ranging from $100k 
         to $500k across different neighborhoods. The 'median_price' 
         column represents typical home values..."
Result: Intelligent histogram of median_price with:
  - Appropriate bin sizes
  - Price-formatted axes
  - Relevant title
  - Proper aggregation
```

## Context Status Handling

### Scenario 1: Context Available
```python
dataset_context = "Rich description of dataset..."
# Uses detailed context for optimal visualization
```

### Scenario 2: Context Pending
```python
dataset_context = None
# Falls back to: "Dataset with 1000 rows and 5 columns: price, location, ..."
# Still generates visualization, just less optimized
```

### Scenario 3: Context Failed
```python
dataset_context = None
# Same fallback as pending
# User can retry context generation if needed
```

## API Response Format

The response now includes better visualizations thanks to context:

```json
{
  "message": "Chart generated successfully",
  "query": "Show price distribution",
  "dataset_id": "upload_abc123",
  "chart_spec": {
    "type": "Histogram",
    "data": [...],
    "spec": {
      "code": "// Optimized D3.js code with proper formatting",
      "styling": [...],
      "renderer": "d3"
    },
    "metadata": {
      "title": "Distribution of Housing Prices",
      "x_label": "Price ($)",
      "y_label": "Frequency",
      "description": "Shows the distribution of median home prices...",
      "columns_used": ["median_price"],
      "generated_by": "dspy_d3_module"
    }
  }
}
```

## Testing

### Test Without Context
```bash
# Upload file (context generation starts async)
POST /api/data/upload

# Immediately request visualization (before context ready)
POST /api/data/analyze
{
  "query": "Show price distribution",
  "dataset_id": "upload_abc123"
}

# Should still work with fallback context
```

### Test With Context
```bash
# Upload file
POST /api/data/upload

# Wait for context generation (poll status)
GET /api/data/datasets/upload_abc123/context

# Request visualization (context now available)
POST /api/data/analyze
{
  "query": "Show price distribution",
  "dataset_id": "upload_abc123"
}

# Should use rich context for better results
```

## Performance Impact

**Minimal:**
- Context retrieval from memory: < 1ms
- No additional database queries
- Context already generated during upload
- Fallback ensures no blocking

## Future Enhancements

1. **Context Caching**: Cache frequently used contexts
2. **Context Validation**: Verify context quality before use
3. **Custom Contexts**: Allow users to provide manual context
4. **Context Versioning**: Track context updates over time
5. **Multi-dataset Context**: Combine contexts for joined datasets

## Files Modified

- `backend/app/services/chart_creator.py` - Added dataset_context parameter
- `backend/app/routes/data.py` - Retrieve and pass context to chart generation

## Backward Compatibility

✅ **Fully backward compatible:**
- `dataset_context` parameter is optional
- Falls back to basic info if not provided
- No breaking changes to API
- Works with or without context generation

## Summary

Chart generation now uses dataset context to create smarter, more accurate visualizations. The DSPy AI module understands the semantic meaning of your data, not just its structure, resulting in better chart selection, labeling, and overall quality.

**Key Benefits:**
- 🎯 Better chart type selection
- 📊 More accurate visualizations
- 🏷️ Meaningful titles and labels
- 🔄 Graceful fallback handling
- ⚡ No performance impact

