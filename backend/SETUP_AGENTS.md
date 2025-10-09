# DSPy Agents Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- `dspy-ai==2.4.9` - DSPy framework
- All other dependencies (FastAPI, pandas, etc.)

### 2. Set Up Environment Variables

Create `backend/.env` file:

```bash
# Copy example
cp .env.example .env

# Edit and add your OpenAI API key
nano .env
```

Add at minimum:
```env
OPENAI_API_KEY=sk-your-actual-openai-api-key
DSPY_MODEL=gpt-4o-mini
```

### 3. Test the Agent System

```bash
# From backend directory
python -m app.services.agents
```

You should see output like:
```
Initializing DSPy...
Generating visualization...

Chart Type: Bar Charts
Title: Sales by Month

D3 Code Preview:
// D3.js visualization code...
```

### 4. Start the Backend Server

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Test the API

```bash
# First, load sample data
curl -X POST http://localhost:8000/api/data/sample/load \
  -H "Authorization: Bearer YOUR_TOKEN"

# Then analyze
curl -X POST http://localhost:8000/api/data/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me a histogram of prices"
  }'
```

## Architecture

```
User Query → API Endpoint → chart_creator.py → agents.py → DSPy Pipeline
                                                                  ↓
                                                            [Validator]
                                                                  ↓
                                                             [Planner]
                                                                  ↓
                                                           [Aggregator]
                                                                  ↓
                                                          [D3 Generator]
                                                                  ↓
                                                         [Metadata Gen]
                                                                  ↓
                                                          Chart Spec JSON
```

## Files Created/Modified

### New Files

1. **`backend/app/services/agents.py`** (425 lines)
   - Main DSPy visualization module
   - All signatures and pipeline logic
   - Styling instructions
   - Comprehensive error handling

2. **`backend/app/services/README_AGENTS.md`**
   - Full documentation
   - Usage examples
   - API reference

3. **`backend/SETUP_AGENTS.md`** (this file)
   - Setup instructions
   - Quick start guide

### Modified Files

1. **`backend/app/services/chart_creator.py`**
   - Now integrates with agents.py
   - Singleton pattern for efficiency
   - Added validation function

2. **`backend/app/routes/data.py`**
   - Activated chart generation (line 381)
   - Now calls `generate_chart_spec()`
   - Returns full chart specification

3. **`backend/requirements.txt`**
   - Added `dspy-ai==2.4.9`
   - Added `numpy==1.24.3` (dependency)

4. **`backend/.env.example`**
   - Added `OPENAI_API_KEY`
   - Added `DSPY_MODEL`

## Environment Variables

### Required

- `OPENAI_API_KEY` - Your OpenAI API key (get from https://platform.openai.com)

### Optional

- `DSPY_MODEL` - Model to use (default: `gpt-4o-mini`)
  - Options: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`
- `AUTO_MIGRATE` - Auto-create database tables (default: `1`)
- `SESSION_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - For OAuth
- `GOOGLE_CLIENT_SECRET` - For OAuth
- `STRIPE_SECRET_KEY` - For payments

## Example Queries

The system can handle various types of visualization requests:

### Distributions
- "Show distribution of prices"
- "Create a histogram of bedrooms"
- "Display frequency of property types"

### Comparisons
- "Compare average price by number of bedrooms"
- "Bar chart of sales by region"
- "Show top 10 zipcodes by average price"

### Correlations
- "Scatter plot of sqft_living vs price"
- "Show correlation between all numerical features"
- "Plot bedrooms against bathrooms"

### Trends
- "Show price trends by year built"
- "Line chart of average prices over time"
- "Display monthly sales trends"

### Compositions
- "Pie chart of waterfront vs non-waterfront"
- "Show proportion of properties by condition"
- "Display market share by category"

## Cost Estimation

Using `gpt-4o-mini` (recommended):
- Input: ~$0.15 / 1M tokens
- Output: ~$0.60 / 1M tokens

Typical query:
- Input: ~2,000 tokens (dataset context + query)
- Output: ~500 tokens (D3 code)
- **Cost per query: ~$0.0006 ($0.06 per 100 queries)**

For production, consider:
1. Caching common queries
2. Rate limiting per user
3. Monitoring token usage
4. Using cheaper models for simple queries

## Troubleshooting

### "Module 'dspy' not found"
```bash
pip install dspy-ai==2.4.9
```

### "OPENAI_API_KEY not set"
Add to `.env`:
```env
OPENAI_API_KEY=sk-...
```

### "Invalid API key"
1. Check key format (starts with `sk-`)
2. Verify key is active at https://platform.openai.com
3. Check billing is set up

### Charts not generating
1. Check backend logs: `tail -f logs/app.log`
2. Test agent directly: `python -m app.services.agents`
3. Verify DataFrame has data: `print(df.head())`

### "No dataset available"
Upload a file first:
```bash
curl -X POST http://localhost:8000/api/data/upload \
  -F "file=@housing_sample.csv"
```

### D3 code not rendering in frontend
Update `frontend/src/components/D3ChartRenderer.tsx` to execute the code from `chartSpec.spec.code`.

## Testing Workflow

### 1. Test Agent Directly
```python
from app.services.agents import initialize_dspy
import pandas as pd

viz = initialize_dspy()
df = pd.read_csv("app/housing_sample.csv")
result = viz.forward("Show histogram of prices", df)
print(result['metadata']['title'])
```

### 2. Test via chart_creator
```python
from app.services.chart_creator import generate_chart_spec
import pandas as pd

df = pd.read_csv("app/housing_sample.csv")
spec = generate_chart_spec(df, "Show histogram of prices")
print(spec['type'])
```

### 3. Test via API
```bash
# Start server
uvicorn app.main:app --reload

# In another terminal
curl -X POST http://localhost:8000/api/data/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "histogram of prices"}'
```

### 4. Test Full Flow
1. Start backend: `uvicorn app.main:app --reload`
2. Start frontend: `cd ../frontend && npm run dev`
3. Navigate to http://localhost:5173
4. Click "Load Sample Housing Data"
5. Enter query: "Show me a histogram of prices"
6. Check console for D3 code

## Production Checklist

- [ ] Set strong `SESSION_SECRET`
- [ ] Use production OpenAI key
- [ ] Enable rate limiting
- [ ] Add query caching
- [ ] Monitor token usage
- [ ] Set up error tracking (Sentry)
- [ ] Add request logging
- [ ] Configure CORS properly
- [ ] Use HTTPS (`SESSION_HTTPS_ONLY=1`)
- [ ] Set up database backups
- [ ] Add query sanitization
- [ ] Implement user quotas
- [ ] Test with large datasets
- [ ] Add performance monitoring

## Next Steps

1. **Frontend Integration**
   - Update `D3ChartRenderer.tsx` to execute D3 code
   - Add loading states
   - Handle errors gracefully

2. **Enhancements**
   - Add chart export (PNG, SVG)
   - Multi-chart dashboards
   - Save/load chart configurations
   - Share charts via link

3. **Optimization**
   - Cache popular queries
   - Pre-compute common aggregations
   - Lazy load large datasets
   - Implement pagination

4. **Monitoring**
   - Track query types
   - Monitor token usage
   - Log errors and failures
   - A/B test different prompts

## Support

For issues:
1. Check logs: `backend/logs/`
2. Test agent directly: `python -m app.services.agents`
3. Verify API key is valid
4. Check DSPy documentation: https://github.com/stanfordnlp/dspy

## Resources

- [DSPy Documentation](https://dspy-docs.vercel.app/)
- [D3.js Documentation](https://d3js.org/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## License

Part of AutoDash project.

