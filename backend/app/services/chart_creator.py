"""
Chart Creator Module
====================

This module integrates with the DSPy-based visualization generation system
to create Plotly chart specifications from natural language queries.
"""

import pandas as pd
import os
import re
import json
import plotly
import plotly.graph_objects as go
from typing import Dict, Any, List
from .agents import PlotlyVisualizationModule
import logging

logger = logging.getLogger(__name__)


def execute_plotly_code(code: str, data: pd.DataFrame) -> Dict[str, Any]:
    """
    Execute Plotly Python code and return the figure as JSON.
    
    Args:
        code: Python code that generates a Plotly figure
        data: pandas DataFrame to pass to the code
        
    Returns:
        dict: Plotly figure as JSON
    """
    try:
        # Create execution environment with necessary imports
        exec_globals = {
            'pd': pd,
            'go': go,
            'plotly': plotly,
            'data': data,
            'np': pd.np if hasattr(pd, 'np') else None
        }
        
        # Try to import plotly.express if available
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except:
            pass
        
        # Execute the code
        exec(code, exec_globals)
        
        # Get the figure object (should be stored in 'fig' variable)
        fig = exec_globals.get('fig')
        
        if fig is None:
            raise ValueError("Code did not produce a 'fig' variable")
        
        if not isinstance(fig, go.Figure):
            raise ValueError(f"'fig' is not a Plotly Figure object, got {type(fig)}")
        
        # Convert figure to JSON
        fig_json = json.loads(fig.to_json())
        
        return {
            'success': True,
            'figure': fig_json,
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


async def generate_chart_spec(
    df: pd.DataFrame, 
    query: str, 
    dataset_context: str = None
) -> List[Dict[str, Any]]:
    """
    Generate Plotly chart specifications based on the user's query.
    
    Args:
        df: pandas DataFrame containing the data
        query: Natural language query describing what visualization is needed
        dataset_context: Rich textual description of the dataset
        
    Returns:
        list: Array of chart specifications, each containing:
            - chart_spec: Python code for generating the chart
            - chart_type: Type of chart (bar_chart, line_chart, etc.)
            - title: Chart title
            - chart_index: Index in the array
            - figure: Executed Plotly figure as JSON (if successful)
            - error: Error message (if execution failed)
    """
    try:
        # Get or initialize the visualization module
        viz_module = PlotlyVisualizationModule()
        
        # Use dataset context or provide fallback
        if not dataset_context:
            columns = [str(col) for col in df.columns.tolist()]
            dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns: {', '.join(columns)}"
        
        # Generate the visualization with dataset context
        result = await viz_module.aforward(
            query=query,
            dataset_context=dataset_context
        )
        
        # Handle array of chart specs
        if isinstance(result, list):
            # Execute each chart spec and add the figure JSON
            for chart_spec in result:
                code = chart_spec.get('chart_spec', '')
                execution_result = execute_plotly_code(code, df)
                
                chart_spec['figure'] = execution_result.get('figure')
                chart_spec['execution_success'] = execution_result.get('success')
                if not execution_result.get('success'):
                    chart_spec['execution_error'] = execution_result.get('error')
                    logger.warning(f"Chart execution failed: {execution_result.get('error')}")
            
            return result
        
        # Handle fail message (string)
        if isinstance(result, str):
            # Create a simple error figure
            execution_result = execute_plotly_code(result, df)
            return [{
                'chart_spec': result,
                'chart_type': 'error',
                'title': 'Error',
                'chart_index': 0,
                'figure': execution_result.get('figure'),
                'execution_success': execution_result.get('success'),
                'execution_error': execution_result.get('error')
            }]
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to generate visualization: {e}")
        # Return error response with a simple error figure
        error_code = f"""
import plotly.graph_objects as go

fig = go.Figure()
fig.add_annotation(
    text="Error: {str(e)}",
    xref="paper", yref="paper",
    x=0.5, y=0.5, showarrow=False,
    font=dict(size=14, color="red")
)
fig.update_layout(title="Visualization Error")
fig
"""
        execution_result = execute_plotly_code(error_code, df)
        
        return [{
            "chart_type": "error",
            "title": "Error",
            "chart_index": 0,
            "chart_spec": error_code,
            "figure": execution_result.get('figure'),
            "execution_success": False,
            "execution_error": f"Failed to generate visualization: {str(e)}"
        }]
