# DSPy Visualization Agents

## Overview

This module uses [DSPy](https://github.com/stanfordnlp/dspy) to generate D3.js visualizations from natural language queries. It features a multi-stage pipeline with validation, planning, data aggregation, and code generation.

## Architecture

```
User Query
    ↓
[1. Validator] → Checks if query can be satisfied with data
    ↓
[2. Planner] → Generates step-by-step visualization plan
    ↓
[3. Data Aggregator] → Creates pandas code for data transformation
    ↓
[4. D3 Generator] → Generates executable D3.js code
    ↓
[5. Metadata Generator] → Creates chart title, labels, description
    ↓
Chart Specification (JSON)
```

## Features

### ✅ Implemented

1. **Query Validation**
   - Validates columns exist in dataset
   - Checks if data types are appropriate
   - Suggests alternative columns

2. **Intelligent Planning**
   - Determines chart type from natural language
   - Creates step-by-step visualization plan
   - Filters irrelevant queries

3. **Data Aggregation**
   - Generates pandas transformation code
   - Executes safely in isolated environment
   - Falls back to raw data on failure

4. **D3 Code Generation**
   - Generates complete, executable D3.js code
   - Includes proper styling and interactivity
   - Follows best practices

5. **Metadata Generation**
   - Auto-generates chart titles
   - Creates axis labels
   - Provides descriptions

6. **Comprehensive Styling**
   - Line charts
   - Bar charts
   - Histograms
   - Scatter plots
   - Pie charts
   - Heat maps
   - Tabular displays

## Usage

### Basic Usage

```python
from app.services.agents import initialize_dspy, D3VisualizationModule
import pandas as pd

# Initialize DSPy (one-time setup)
viz_module = initialize_dspy(model="gpt-4o-mini")

# Load your data
df = pd.read_csv("housing_sample.csv")

# Generate visualization
result = viz_module.forward(
    query="Show me a histogram of house prices",
    df=df
)

# Access results
print(result['type'])  # "Histograms"
print(result['metadata']['title'])  # "Distribution of House Prices"
print(result['spec']['code'])  # D3.js code
print(result['data'])  # Processed data
```

### Via chart_creator.py

```python
from app.services.chart_creator import generate_chart_spec
import pandas as pd

df = pd.read_csv("housing_sample.csv")
chart_spec = generate_chart_spec(df, "Create a scatter plot of sqft_living vs price")
```

### Via API Endpoint

```bash
curl -X POST http://localhost:8000/api/data/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Show correlation between bedrooms and price",
    "dataset_id": "sample_abc123"
  }'
```

## Response Format

```json
{
  "type": "Scatter Plots",
  "data": [
    {"bedrooms": 3, "price": 950000},
    {"bedrooms": 4, "price": 1200000},
    ...
  ],
  "spec": {
    "code": "// Complete D3.js code...",
    "styling": [
      {
        "category": "scatter_plots",
        "styling": {
          "theme": "light",
          "point_style": {"radius": 4, "opacity": 0.6},
          ...
        }
      }
    ],
    "renderer": "d3"
  },
  "metadata": {
    "title": "Bedrooms vs Price Correlation",
    "x_label": "Number of Bedrooms",
    "y_label": "Price",
    "description": "Scatter plot showing the relationship between bedrooms and price",
    "columns_used": ["bedrooms", "price"],
    "generated_by": "dspy_d3_module",
    "chart_category": "scatter_plots"
  },
  "plan": "1. Extract bedrooms and price columns\n2. Create scatter plot\n3. Add trend line..."
}
```

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional (defaults shown)
DSPY_MODEL=gpt-4o-mini
```

### Supported Models

- `gpt-4o-mini` (default) - Fast and cost-effective
- `gpt-4o` - More capable but slower
- `gpt-3.5-turbo` - Fastest but less accurate
- Any OpenAI compatible model

### Custom Styling

Modify `STYLING_INSTRUCTIONS` in `agents.py`:

```python
STYLING_INSTRUCTIONS = [
    {
        "category": "bar_charts",
        "description": "Bar chart styling",
        "styling": {
            "theme": "dark",  # Change to dark theme
            "bar_style": {
                "padding": 0.2,  # Increase padding
                "corner_radius": 5  # More rounded corners
            },
            ...
        }
    }
]
```

## Supported Chart Types

### 1. Line Charts
**Use for:** Time series, trends, multi-series comparisons

**Example queries:**
- "Show sales trends over time"
- "Compare revenue across regions monthly"
- "Plot price changes by year"

### 2. Bar Charts
**Use for:** Category comparisons, rankings

**Example queries:**
- "Bar chart of average price by neighborhood"
- "Compare sales across products"
- "Show top 10 regions by revenue"

### 3. Histograms
**Use for:** Distributions, frequency analysis

**Example queries:**
- "Show distribution of house prices"
- "Histogram of customer ages"
- "Display frequency of bedrooms"

### 4. Scatter Plots
**Use for:** Correlations, relationships between variables

**Example queries:**
- "Scatter plot of sqft_living vs price"
- "Show correlation between age and income"
- "Plot temperature vs sales"

### 5. Pie Charts
**Use for:** Composition, parts of a whole

**Example queries:**
- "Pie chart of market share by company"
- "Show proportion of waterfront properties"
- "Display category breakdown"

### 6. Heat Maps
**Use for:** Correlations, density, intensity

**Example queries:**
- "Heat map of feature correlations"
- "Show sales intensity by region and time"
- "Display correlation matrix"

### 7. Tables
**Use for:** Raw data, detailed comparisons

**Example queries:**
- "Show summary statistics"
- "Display top 10 records"
- "Create a comparison table"

## Examples

### Example 1: Housing Data Analysis

```python
import pandas as pd
from app.services.agents import initialize_dspy

# Initialize
viz = initialize_dspy()
df = pd.read_csv("housing_sample.csv")

# Multiple queries
queries = [
    "Show distribution of prices",
    "Compare average price by number of bedrooms",
    "Scatter plot of sqft_living vs price",
    "Show correlation between numerical features"
]

for query in queries:
    result = viz.forward(query, df)
    print(f"Query: {query}")
    print(f"Type: {result['type']}")
    print(f"Title: {result['metadata']['title']}\n")
```

### Example 2: Error Handling

```python
# Query with non-existent column
result = viz.forward("Show sales by region", df)

if result['type'] == 'error':
    print(f"Error: {result['message']}")
    print(f"Suggestions: {result.get('suggestions', [])}")
```

### Example 3: With Aggregation

```python
# This will auto-aggregate data
result = viz.forward(
    "Show average price by zipcode, sorted descending",
    df
)

# Data will be pre-aggregated
print(f"Rows in result: {len(result['data'])}")  # Much less than original
print(f"Aggregated columns: {result['data'][0].keys()}")
```

## Advanced Features

### Data Aggregation

The system can generate and execute pandas code:

```python
result = viz.forward(
    "Show total sales by region and product category",
    df
)

# Access aggregation code if needed
result_with_code = viz.forward(
    query="...",
    df=df,
    return_aggregation_code=True
)
print(result_with_code['aggregation_code'])
```

### Validation

```python
from app.services.chart_creator import validate_query

validation = validate_query(df, "Show sales trends")

if not validation['is_valid']:
    print(f"Issue: {validation['missing_info']}")
    print(f"Try these columns: {validation['suggested_columns']}")
```

### Custom Dataset Context

```python
# Provide custom context
dataset_context = {
    "columns": df.columns.tolist(),
    "dtypes": df.dtypes.to_dict(),
    "description": "Housing sales data from 2020-2024",
    "notes": "Price is in USD, sqft_living is living area"
}

result = viz.forward(query, df)  # Uses auto-generated context
```

## Troubleshooting

### Issue: "OPENAI_API_KEY not set"
**Solution:** 
```bash
export OPENAI_API_KEY=sk-your-key
# or add to backend/.env
```

### Issue: Charts not rendering
**Solution:** Check that D3.js code is being executed in frontend. Update `D3ChartRenderer.tsx` to execute the code from `result['spec']['code']`.

### Issue: "No dataset available"
**Solution:** Upload a file or load sample data before querying.

### Issue: Aggregation fails
**Solution:** The system falls back to raw data. Check logs for pandas errors.

### Issue: Irrelevant query filtered
**Solution:** Make query more specific to visualization/analysis.

## Performance Tips

1. **Use gpt-4o-mini** for speed and cost
2. **Pre-aggregate large datasets** before sending to API
3. **Cache results** for repeated queries
4. **Limit data preview** to 100 rows in dataset context
5. **Use specific queries** to reduce token usage

## Testing

```bash
# Test the module
cd backend
python -m app.services.agents

# Should output example visualization
```

## Integration Checklist

- [x] `agents.py` created with DSPy pipeline
- [x] `chart_creator.py` integrated
- [x] `/api/data/analyze` endpoint updated
- [x] `requirements.txt` includes `dspy-ai`
- [x] `.env.example` has `OPENAI_API_KEY`
- [ ] Frontend `D3ChartRenderer.tsx` executes D3 code
- [ ] Add API key to `.env`
- [ ] Test with housing sample data
- [ ] Deploy and monitor

## Next Steps

1. Add the D3 code execution logic to frontend
2. Test with various queries
3. Fine-tune styling templates
4. Add caching for common queries
5. Monitor token usage and costs
6. Consider adding more chart types

## License

Part of AutoDash project.

