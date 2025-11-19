from fastapi import APIRouter, Depends, HTTPException
from ..schemas.chat import ChatRequest, ChatResponse
from ..core.security import get_current_subject, get_current_user
from ..core.db import get_db
from ..models import User
from sqlalchemy.orm import Session
from ..services.agents import chat_function
from ..services.dataset_service import dataset_service
import dspy
import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send", response_model=ChatResponse)
def chat_send(payload: ChatRequest, user_sub: str = Depends(get_current_subject)):
    return ChatResponse(reply=f"Echo: {payload.message}", user=user_sub)


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chat endpoint that uses chat_function to respond to user queries.
    Returns the response directly from chat_function.
    """
    try:
        # Get dataset context if available
        data_context = ""
        if payload.dataset_id:
            data_context = dataset_service.get_context(current_user.id, payload.dataset_id) or ""
            # If context not available, try to get basic info
            if not data_context:
                df = dataset_service.get_dataset(current_user.id, payload.dataset_id)
                if df is not None:
                    if isinstance(df, dict):
                        sheet_names = list(df.keys())
                        first_sheet = df[sheet_names[0]]
                        columns = [str(col) for col in first_sheet.columns.tolist()]
                        data_context = f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet has {len(first_sheet)} rows and columns: {', '.join(columns)}"
                    else:
                        columns = [str(col) for col in df.columns.tolist()]
                        data_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
        
        # Get optional fig_data and plotly_code from payload
        fig_data = ""
        plotly_code = ""
        
        if payload.fig_data:
            if isinstance(payload.fig_data, dict):
                fig_data = json.dumps(payload.fig_data)
            else:
                fig_data = str(payload.fig_data)
        
        if payload.plotly_code:
            plotly_code = payload.plotly_code
        
        # Initialize chat_function
        chat_fn = chat_function()
        
        # Set up DSPy language model
        lm = dspy.LM(
            "openai/gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
            max_tokens=2000
        )
        
        # Call chat_function with DSPy context
        with dspy.context(lm=lm):
            result = await chat_fn.aforward(
                user_query=payload.message,
                fig_data=fig_data,
                data_context=data_context,
                plotly_code=plotly_code
            )
        
        # Extract response from result
        route_info = result.get('route', {})
        response_obj = result.get('response', {})
        
        # Format the reply based on response type
        reply = ""
        if hasattr(response_obj, 'answer'):
            reply = str(response_obj.answer)
        elif hasattr(response_obj, 'edited_code'):
            reply = f"```python:\n{str(response_obj.edited_code)}"+"```"
            if hasattr(response_obj, 'reasoning'):
                reply = f"{str(response_obj.reasoning)}\n\n{reply}"
        elif hasattr(response_obj, 'analysis_code'):
            reply = f"Analysis:\n{str(response_obj.analysis_code)}"
        else:
            # Fallback: convert response to string
            reply = str(response_obj)
        
        return ChatResponse(
            reply=reply,
            user=str(current_user.id)
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        )


