import logging
from typing import Optional, Dict, Any

from .agents import PlotlyQueryRouter

logger = logging.getLogger(__name__)

_plotly_router_instance: Optional[PlotlyQueryRouter] = None


def get_plotly_router() -> PlotlyQueryRouter:
    global _plotly_router_instance
    if _plotly_router_instance is None:
        logger.info("Initializing PlotlyQueryRouter")
        _plotly_router_instance = PlotlyQueryRouter()
    return _plotly_router_instance


async def route_plotly_query(
    *,
    user_query: str,
    plotly_code: Optional[str],
    fig_data: Optional[str],
    dataset_context: Optional[str],
) -> Dict[str, Any]:
    """Route a query to the appropriate Plotly toolchain and return serialized results."""
    router = get_plotly_router()
    try:
        prediction = await router.aforward(
            user_query=user_query,
            fig_data=fig_data,
            dataset_context=dataset_context,
            plotly_code=plotly_code,
        )
    except Exception as exc:
        logger.exception("Plotly router failed: %s", exc)
        raise

    route = prediction.get("route")
    response = prediction.get("response")
    query_type = getattr(route, "query_type", None) or "general_query"

    if "plotly_edit_query" in query_type:
        payload = {
            "edited_code": getattr(response, "edited_code", ""),
            "reasoning": getattr(response, "reasoning", ""),
        }
    elif "data_query" in query_type:
        payload = {
            "code": getattr(response, "code", ""),
            "reasoning": getattr(response, "reasoning", ""),
        }
    else:
        payload = {
            "answer": getattr(response, "answer", ""),
            "reasoning": getattr(route, "reasoning", ""),
        }

    return {
        "query_type": query_type,
        "payload": payload,
    }