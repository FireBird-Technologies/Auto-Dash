from fastapi import APIRouter, Depends
from ..schemas.chat import ChatRequest, ChatResponse
from ..core.security import get_current_subject


router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send", response_model=ChatResponse)
def chat_send(payload: ChatRequest, user_sub: str = Depends(get_current_subject)):
    return ChatResponse(reply=f"Echo: {payload.message}", user=user_sub)


