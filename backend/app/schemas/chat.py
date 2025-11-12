from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    user: str | None = None


class FixVisualizationRequest(BaseModel):
    plotly_code: str
    error_message: str


