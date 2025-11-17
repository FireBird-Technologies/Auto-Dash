import logging
from typing import Optional, Dict, Any

import dspy


logger = logging.getLogger(__name__)


class PlotlyEditorSignature(dspy.Signature):
    """Generate revised Plotly code for chart edits."""

    user_query = dspy.InputField(desc="User instructions for modifying the chart")
    plotly_code = dspy.InputField(desc="Current Plotly Python code")
    dataset_context = dspy.InputField(desc="Dataset context or preview")
    edited_code = dspy.OutputField(desc="Updated Plotly code (must end with fig)")
    reasoning = dspy.OutputField(desc="Explanation of applied edits")


class FigEditorSignature(dspy.Signature):
    """Generate Python code that analyzes existing Plotly figure traces.

    REQUIREMENTS:
    - Operate ONLY on the provided `fig`, `df`, or `data['SheetName']` (Excel). Do not fabricate sample data.
    - Use numeric-safe helpers such as `ensure_numeric(df['price'])` before aggregations.
    - When calculating correlations or multi-column statistics, select or convert only numeric columns
      (e.g., `numeric_df = df.select_dtypes(include=[np.number])` or applying `ensure_numeric`) so strings
      or categorical values never reach pandas correlation methods.
    - ALWAYS print the final answer(s) so the user sees the result (e.g., print("Max price:", value)).
    """

    user_query = dspy.InputField(desc="User question about the chart data or dataset")
    fig_data = dspy.InputField(desc="Serialized fig.data representation")
    dataset_context = dspy.InputField(desc="Dataset context summary (rows, columns, stats)")
    code = dspy.OutputField(desc="Pure Python analysis code referencing `fig` and `df` (DataFrame)")
    reasoning = dspy.OutputField(desc="Explanation of the generated analysis")


class GeneralQASignature(dspy.Signature):
    """Handle general conversational questions."""

    user_query = dspy.InputField(desc="General or contextual question")
    answer = dspy.OutputField(desc="Conversational answer")


class RouterSignature(dspy.Signature):
    """Classify a user query into chart edit, data analysis, or general chat."""

    user_query = dspy.InputField(desc="Raw user query text")
    query_type = dspy.OutputField(
        desc="Literal string: 'plotly_edit_query', 'data_query', or 'general_query'"
    )
    reasoning = dspy.OutputField(desc="Explanation of the routing decision")


class PlotlyQueryRouter(dspy.Module):
    """Modular DSPy router that selects the appropriate Plotly toolchain."""

    def __init__(self):
        super().__init__()
        self.plotly_editor_mod = dspy.Predict(PlotlyEditorSignature)
        self.fig_editor_mod = dspy.Predict(FigEditorSignature)
        self.general_qa_mod = dspy.Predict(GeneralQASignature)
        self.router = dspy.Predict(RouterSignature)

    def forward(
        self,
        user_query: str,
        fig_data: Optional[str],
        dataset_context: Optional[str],
        plotly_code: Optional[str],
    ):
        route = self.router(user_query=user_query)
        query_type = getattr(route, "query_type", None) or "general_query"

        if "data_query" in query_type:
            response = self.fig_editor_mod(
                user_query=user_query,
                fig_data=fig_data or "",
                dataset_context=dataset_context or "",
            )
        elif "plotly_edit_query" in query_type:
            response = self.plotly_editor_mod(
                user_query=user_query,
                dataset_context=dataset_context or "",
                plotly_code=plotly_code or "",
            )
        else:
            response = self.general_qa_mod(user_query=user_query)

        return {"route": route, "response": response}


_plotly_router_instance: Optional[PlotlyQueryRouter] = None


def get_plotly_router() -> PlotlyQueryRouter:
    global _plotly_router_instance
    if _plotly_router_instance is None:
        logger.info("Initializing PlotlyQueryRouter")
        _plotly_router_instance = PlotlyQueryRouter()
    return _plotly_router_instance


def route_plotly_query(
    *,
    user_query: str,
    plotly_code: Optional[str],
    fig_data: Optional[str],
    dataset_context: Optional[str],
) -> Dict[str, Any]:
    """Route a query to the appropriate Plotly toolchain and return serialized results."""
    router = get_plotly_router()
    try:
        prediction = router(
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

