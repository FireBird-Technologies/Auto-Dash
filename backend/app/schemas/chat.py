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
    code_type: Optional[Literal['plotly_edit', 'analysis', 'add_chart_query']] = None
    executable_code: Optional[str] = None
    query_type: Optional[str] = None  # The detected query type (for showing action buttons on need_clarity)


class FixVisualizationRequest(BaseModel):
    plotly_code: str
    error_message: str
    dataset_id: Optional[str] = None


class RetryCodeRequest(BaseModel):
    user_query: str
    dataset_id: str
    code_type: str  # 'plotly_edit' or 'analysis'
    plotly_code: Optional[str] = None  # Only for plotly_edit
    data_context: str


