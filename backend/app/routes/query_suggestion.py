from fastapi import APIRouter, Depends, HTTPException
import dspy
import json
import os
from ..services.dataset_service import dataset_service
from ..core.security import get_current_user
from ..models import User

class SuggestQueries(dspy.Signature):
    dataset_context: str = dspy.InputField(desc="Column names, types, sample rows")
    suggestions: str = dspy.OutputField(desc="JSON array of 1 concise and a creative question string that result in good visual dashboards, add instructions for visualization & data, strictly excluding conversational questions.(like what, how etc) and keep the questions concise.")

quick_lm = dspy.LM('openai/gpt-4o-mini', max_tokens=250, api_key= os.getenv('OPENAI_API_KEY'))
dspy.context(lm=quick_lm)
program = dspy.Predict(SuggestQueries)

router = APIRouter(prefix="/api/data", tags=["query_suggestions"])

@router.post("/datasets/{dataset_id}/suggest-queries")
async def suggest_query(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
):
    data_dict = dataset_service.get_dataset(current_user.id, dataset_id)
    if not data_dict:
        raise HTTPException(404, "Dataset not in memory; please re-upload")
    sheet_name, df = next(iter(data_dict.items()))
    dataset_context=df.head(5).to_markdown()
    result = program(dataset_context=dataset_context)
    suggestion_list = json.loads(result.suggestions)
    return {"suggestions": suggestion_list}
    #return "Hello, World!"