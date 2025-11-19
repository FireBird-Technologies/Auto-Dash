from pydantic import BaseModel
from typing import Optional, Dict, Any, Literal


class ChatRequest(BaseModel):
    message: str
    dataset_id: Optional[str] = None
    fig_data: Optional[Dict[str, Any]] = None
    plotly_code: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    user: str | None = None
    matched_chart: Optional[Dict[str, Any]] = None
    code_type: Optional[Literal['plotly_edit', 'analysis']] = None
    executable_code: Optional[str] = None


class FixVisualizationRequest(BaseModel):
    plotly_code: str
    error_message: str
    dataset_id: Optional[str] = None


