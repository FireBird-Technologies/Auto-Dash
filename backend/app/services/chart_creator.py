"""
Chart Creator Module
====================

This module integrates with the DSPy-based visualization generation system
to create Plotly chart specifications from natural language queries.
"""

import json
import logging
from typing import Dict, Any, List

import pandas as pd
import numpy as np
import plotly.graph_objects as go

from .agents import PlotlyVisualizationModule

logger = logging.getLogger(__name__)


class SheetAwareDataFrame(pd.DataFrame):
    """DataFrame that handles sheet-style lookups by returning self when key is not a column."""

    def __getitem__(self, key):
        if isinstance(key, str) and key not in self.columns:
            return self
        return super().__getitem__(key)


def _strip_markdown_fences(code: str) -> str:
    """Remove markdown code fences (```python ... ```) from generated code."""
    if not isinstance(code, str):
        return code
    
    code = code.strip()
    if code.startswith("```"):
        code = code[3:].lstrip()
        if code.lower().startswith("python"):
            code = code[6:].lstrip()
        if "```" in code:
            code = code[:code.rfind("```")]
    
    return code.strip()


def execute_plotly_code(
    code: str,
    data: pd.DataFrame | Dict[str, pd.DataFrame],
) -> Dict[str, Any]:
    """
    Execute Plotly Python code and return the figure as JSON.
    
    Args:
        code: Python code that generates a Plotly figure
        data: pandas DataFrame (for CSV) or dict of DataFrames (for multi-sheet Excel)
        
    Returns:
        dict with 'success', 'figure', and 'error' keys
    """
    try:
        # Prepare data - wrap DataFrame for sheet-style lookups
        if isinstance(data, pd.DataFrame):
            prepared_data = SheetAwareDataFrame(data.copy(deep=False))
            df_alias = prepared_data
        else:
            prepared_data = data
            df_alias = None

        # Setup execution environment
        exec_globals = {
            'pd': pd,
            'np': np,
            'go': go,
            'data': prepared_data,
            'df': df_alias if df_alias is not None else (data if not isinstance(data, dict) else None),
        }
        
        # Add plotly.express if available
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except Exception:
            pass

        # Clean and execute code
        code = _strip_markdown_fences(code)
        exec(code, exec_globals)

        # Get the figure object
        fig = exec_globals.get('fig')
        if fig is None:
            raise ValueError("Code did not produce a 'fig' variable")
        if not isinstance(fig, go.Figure):
            raise ValueError(f"'fig' is not a Plotly Figure object, got {type(fig)}")

        return {
            'success': True,
            'figure': json.loads(fig.to_json()),
            'error': None
        }

    except Exception as e:
        logger.error(f"Error executing Plotly code: {e}")
        logger.error(f"Code was:\n{code}")
        return {
            'success': False,
            'figure': None,
            'error': str(e),
            'code': code
        }


def _build_fallback_context(df: pd.DataFrame | Dict[str, pd.DataFrame]) -> str:
    """Build basic dataset context string."""
    if isinstance(df, dict):
        sheet_names = list(df.keys())
        first_sheet = df[sheet_names[0]]
        columns = [str(col) for col in first_sheet.columns.tolist()]
        return f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet has {len(first_sheet)} rows and columns: {', '.join(columns)}"
    
    columns = [str(col) for col in df.columns.tolist()]
    return f"Dataset with {len(df)} rows and {len(df.columns)} columns: {', '.join(columns)}"


async def generate_chart_spec(
    df: pd.DataFrame | Dict[str, pd.DataFrame],
    query: str,
    dataset_context: str = None
) -> List[Dict[str, Any]]:
    """
    Generate Plotly chart specifications based on the user's query.
    
    Args:
        df: pandas DataFrame (CSV) or dict of DataFrames (multi-sheet Excel)
        query: Natural language query describing what visualization is needed
        dataset_context: Rich textual description of the dataset
        
    Returns:
        list: Array of chart specifications
    """
    viz_module = PlotlyVisualizationModule()
    
    # Use provided context or build fallback
    if not dataset_context:
        dataset_context = _build_fallback_context(df)
    
    # Generate visualization
    result = await viz_module.aforward(query=query, dataset_context=dataset_context)
    
    # Handle array of chart specs
    if isinstance(result, list):
        for chart_spec in result:
            code = chart_spec.get('chart_spec', '')
            exec_result = execute_plotly_code(code, df)
            
            chart_spec['figure'] = exec_result.get('figure')
            chart_spec['execution_success'] = exec_result.get('success')
            if not exec_result.get('success'):
                chart_spec['execution_error'] = exec_result.get('error')
                logger.warning(f"Chart execution failed: {exec_result.get('error')}")
        
        return result
    
    # Handle fail message (string)
    if isinstance(result, str):
        exec_result = execute_plotly_code(result, df)
        return [{
            'chart_spec': result,
            'chart_type': 'error',
            'title': 'Error',
            'chart_index': 0,
            'figure': exec_result.get('figure'),
            'execution_success': exec_result.get('success'),
            'execution_error': exec_result.get('error')
        }]
    
    return result
