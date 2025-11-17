from typing import Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str | None = None
    query: str | None = None
    dataset_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    user: str | None = None


class FixVisualizationRequest(BaseModel):
    d3_code: str
    error_message: Optional[str] = None


