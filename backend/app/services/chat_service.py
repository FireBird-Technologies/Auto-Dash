"""Shared chat service logic for handling LLM-driven visualization interactions."""

import json
import logging
from typing import Any, Dict, Optional

import pandas as pd

from .chart_creator import execute_plotly_code, generate_chart_spec
from .dataset_service import dataset_service
from .plotly_router import route_plotly_query

logger = logging.getLogger(__name__)


async def handle_chat_query(
    user_id: int,
    query: str,
    dataset_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Handle a chat query with routing to appropriate handlers.
    
    Args:
        user_id: User ID
        query: User's query string
        dataset_id: Optional dataset ID, uses latest if not provided
        
    Returns:
        Response dictionary with message, charts, and metadata
    """
    # Get the dataset
    if dataset_id:
        df = dataset_service.get_dataset(user_id, dataset_id)
        if df is None:
            raise ValueError("Dataset not found")
    else:
        result = dataset_service.get_latest_dataset(user_id)
        if result is None:
            raise ValueError("No dataset available. Please upload a file first.")
        dataset_id, df = result
    
    # Get the dataset context from memory
    dataset_context = dataset_service.get_context(user_id, dataset_id)
    
    # If context not available yet, provide basic fallback info
    if not dataset_context:
        if isinstance(df, dict):
            sheet_names = list(df.keys())
            active_sheet_name = sheet_names[0]
            active_sheet = df[active_sheet_name]
            columns = [str(col) for col in active_sheet.columns.tolist()]
            dataset_context = (
                f"Excel dataset with {len(sheet_names)} sheet(s): {', '.join(sheet_names)}. "
                f"Using sheet '{active_sheet_name}' containing {len(active_sheet)} rows and "
                f"{len(columns)} columns. Columns: {', '.join(columns)}"
            )
        else:
            columns = [str(col) for col in df.columns.tolist()]
            dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
    
    chart_state = dataset_service.get_chart_state(user_id, dataset_id)
    router_result = None
    if chart_state and (chart_state.get("plotly_code") or chart_state.get("figure_json")):
        try:
            fig_data_serialized = json.dumps(chart_state.get("fig_data")) if chart_state.get("fig_data") is not None else ""
            router_result = await route_plotly_query(
                user_query=query,
                plotly_code=chart_state.get("plotly_code"),
                fig_data=fig_data_serialized,
                dataset_context=dataset_context,
            )
        except Exception as exc:
            logger.warning(f"Plotly router failed, falling back to generation: {exc}")
            router_result = None
    
    if router_result:
        query_type = router_result.get("query_type", "general_query")
        payload_result = router_result.get("payload", {})
        
        if "plotly_edit_query" in query_type:
            edited_code = payload_result.get("edited_code")
            if not edited_code:
                raise ValueError("Router did not return edited Plotly code")
            
            exec_result = execute_plotly_code(edited_code, df)
            if not exec_result.get("success"):
                raise ValueError(f"Edited Plotly code failed: {exec_result.get('error')}")
            
            chart_spec = {
                "chart_spec": edited_code,
                "chart_type": "router_edit",
                "title": "Router Edit",
                "chart_index": 0,
                "figure": exec_result.get("figure"),
                "execution_success": exec_result.get("success"),
                "execution_error": exec_result.get("error"),
            }
            from ..routes.data import persist_chart_state
            persist_chart_state(user_id, dataset_id, chart_spec)
            
            return {
                "message": "Visualization updated via Plotly edit",
                "query": query,
                "dataset_id": dataset_id,
                "chart_spec": chart_spec,
                "router_mode": "plotly_edit_query"
            }
        
        if "data_query" in query_type:
            analysis_code = payload_result.get("code")
            from ..routes.data import get_sheet_dataframe, rebuild_figure_from_state, execute_analysis_code
            active_df, _ = get_sheet_dataframe(df, None)
            fig_obj = rebuild_figure_from_state(chart_state, df, user_id, dataset_id)
            if fig_obj is None:
                raise ValueError("No existing figure available for analysis.")
            
            analysis_result = execute_analysis_code(analysis_code, fig_obj, active_df)
            status = "successful" if analysis_result["success"] else "failed"
            return {
                "message": analysis_result["output"],
                "query": query,
                "dataset_id": dataset_id,
                "router_mode": "data_query",
                "analysis_status": status
            }
        
        answer = payload_result.get("answer") or "No answer produced."
        return {
            "message": answer,
            "query": query,
            "dataset_id": dataset_id,
            "router_mode": "general_query"
        }
    
    try:
        chart_specs = await generate_chart_spec(df, query, dataset_context)
        
        if isinstance(chart_specs, list):
            if chart_specs:
                from ..routes.data import persist_chart_state
                persist_chart_state(user_id, dataset_id, chart_specs[0])
            return {
                "message": f"Visualization updated - {len(chart_specs)} chart(s) generated",
                "query": query,
                "dataset_id": dataset_id,
                "charts": chart_specs
            }
        else:
            from ..routes.data import persist_chart_state
            persist_chart_state(user_id, dataset_id, chart_specs)
            return {
                "message": "Visualization updated",
                "query": query,
                "dataset_id": dataset_id,
                "chart_spec": chart_specs
            }
    except Exception as e:
        raise ValueError(f"Error updating visualization: {str(e)}")

