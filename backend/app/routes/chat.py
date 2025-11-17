import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..core.db import get_db
from ..models import User
from ..schemas.chat import ChatRequest
from ..services.chat_service import handle_chat_query

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/")
@router.post("/send")
async def chat_with_llm(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Conversational refinement endpoint - consolidates Plotly edit/data Q&A routes
    under /api/chat for LLM-driven interactions.
    """
    query = payload.query or payload.message
    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    try:
        return await handle_chat_query(
            user_id=current_user.id,
            query=query,
            dataset_id=payload.dataset_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as exc:
        logger.exception("Error in chat endpoint")
        raise HTTPException(
            status_code=500, detail=f"Error processing chat query: {str(exc)}"
        )