from pydantic import BaseModel
from typing import Optional, Dict, Any


class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    fig_data: Optional[Dict[str, Any]] = None
    plotly_code: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    user: str | None = None
    matched_chart: Optional[Dict[str, Any]] = None


class FixVisualizationRequest(BaseModel):
    plotly_code: str
    error_message: str
    dataset_id: Optional[str] = None


