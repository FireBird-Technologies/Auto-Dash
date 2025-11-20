from fastapi import APIRouter, Depends, HTTPException
from ..schemas.chat import ChatRequest, ChatResponse
from ..core.security import get_current_subject, get_current_user
from ..core.db import get_db
from ..models import User
from sqlalchemy.orm import Session
from ..services.agents import chat_function, chart_matcher
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
        
        # Find matching chart using chart_matcher if dataset_id provided
        fig_data = ""
        plotly_code = ""
        matched_chart_info = None
        
        if payload.dataset_id:
            charts = dataset_service._store.get(current_user.id, {}).get(payload.dataset_id, {}).get("charts", {})
            
            if charts:
                # Compress chart metadata to 200 chars for matching
                def compress_chart(idx, c):
                    t = c.get("chart_type", "")[:30]
                    n = c.get("title", "")[:50]
                    p = str(c.get("plan", {}))[:100]
                    return {"i": idx, "t": t, "n": n, "p": p}
                
                charts_json = json.dumps([compress_chart(idx, c) for idx, c in charts.items()], default=str)[:200]
                
                # Define reward function for chart matching
                def chart_match_reward(args, pred) -> float:
                    """
                    Reward function for BestOfN:
                    - 1.0: Valid chart index that exists
                    - 0.5: Returns -1 (explicit no match)
                    - 0.0: Invalid/out-of-range index
                    """
                    try:
                        chart_idx = int(pred.chart_index)
                        if chart_idx in charts:
                            return 1.0  # Perfect - matched an existing chart
                        elif chart_idx == -1:
                            return 0.5  # Valid response but no match
                        else:
                            return 0.0  # Invalid index
                    except (ValueError, AttributeError, TypeError):
                        return 0.0  # Invalid response
                
                # Use gpt-4o-mini for chart matching
                match_lm = dspy.LM(
                    "openai/gpt-4o-mini",
                    api_key=os.getenv("OPENAI_API_KEY"),
                    max_tokens=1000
                )
                
                # Set up BestOfN with chart_matcher
                chart_matcher_module = dspy.Predict(chart_matcher)
                best_of_n_matcher = dspy.BestOfN(
                    module=chart_matcher_module,
                    N=3,  # Try up to 3 times
                    reward_fn=chart_match_reward,
                    threshold=1.0  # Stop early if we get a perfect match (score=1.0)
                )
                
                with dspy.context(lm=match_lm):
                    match_result = best_of_n_matcher(
                        query=payload.message,
                        charts=charts_json
                    )
                
                matched_index = int(match_result.chart_index)
                logger.info(f"BestOfN chart matcher returned: {matched_index}")
                
                # Safety: Default to first chart if no valid match
                if matched_index < 0 or matched_index not in charts:
                    if charts:
                        matched_index = min(charts.keys())
                        logger.info(f"No valid match from BestOfN, defaulting to chart {matched_index}")
                
                if matched_index >= 0 and matched_index in charts:
                    matching_chart = charts[matched_index]
                    plotly_code = matching_chart.get("chart_spec", "")
                    figure = matching_chart.get("figure")
                    if figure:
                        fig_data = json.dumps(figure)
                    
                    # Store matched chart info for frontend
                    matched_chart_info = {
                        "index": matched_index,
                        "type": matching_chart.get("chart_type", ""),
                        "title": matching_chart.get("title", "")
                    }
                    logger.info(f"Using chart {matched_index} ({matching_chart.get('chart_type')}) for query")
        
        # Fallback to payload if no match found or no charts
        if not plotly_code and payload.plotly_code:
            plotly_code = payload.plotly_code
        
        if not fig_data and payload.fig_data:
            if isinstance(payload.fig_data, dict):
                fig_data = json.dumps(payload.fig_data)
            else:
                fig_data = str(payload.fig_data)
        
        # Initialize chat_function
        chat_fn = chat_function()
        
        # Use default model from environment (configured in main.py) for main chat
        # No need to set up lm here, it uses dspy.configure(lm=default_lm) from main.py
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
        code_type = None
        executable_code = None
        
        if hasattr(response_obj, 'answer'):
            reply = str(response_obj.answer)
        elif hasattr(response_obj, 'edited_code'):
            # Plotly edit code
            code_type = 'plotly_edit'
            executable_code = str(response_obj.edited_code)
            reply = f"```python\n{executable_code}\n```"
            if hasattr(response_obj, 'reasoning'):
                reply = f"{str(response_obj.reasoning)}\n\n{reply}"
        elif hasattr(response_obj, 'code'):
            # Analysis code
            code_type = 'analysis'
            executable_code = str(response_obj.code)
            reply = f"```python\n{executable_code}\n```"
            if hasattr(response_obj, 'reasoning'):
                reply = f"{str(response_obj.reasoning)}\n\n{reply}"
        else:
            # Fallback: convert response to string
            reply = str(response_obj)
        
        return ChatResponse(
            reply=reply,
            user=str(current_user.id),
            matched_chart=matched_chart_info,
            code_type=code_type,
            executable_code=executable_code
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing chat request: {str(e)}"
        )


