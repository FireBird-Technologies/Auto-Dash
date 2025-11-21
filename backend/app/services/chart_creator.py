"""
Chart Creator Module
====================

This module integrates with the DSPy-based visualization generation system
to create Plotly chart specifications from natural language queries.
"""

import pandas as pd
import numpy as np
import os
import re
import json
import plotly
import plotly.graph_objects as go
import scipy
from scipy import stats, signal, optimize
from typing import Dict, Any, List, Tuple
from .agents import PlotlyVisualizationModule
import logging

logger = logging.getLogger(__name__)


def execute_plotly_code(code: str, data: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    """
    Execute Plotly Python code and return the figure as JSON.
    
    Args:
        code: Python code that generates a Plotly figure
        data: Dict of DataFrames with sheet names as keys (normalized format)
        
    Returns:
        dict: Plotly figure as JSON
    """
    try:
        # Validate data exists
        if data is None:
            logger.error("No data provided for execution")
            raise ValueError("No data provided for execution")
        
        if not isinstance(data, dict):
            logger.error(f"Data must be a dict, got {type(data)}")
            raise ValueError(f"Data must be a dict, got {type(data)}")
        
        if not data:
            logger.error("Data dict is empty - no sheets available")
            raise ValueError("Data dict is empty - no sheets available")
        
        # Log sheet information
        sheet_names = list(data.keys())
        logger.info(f"Executing code with {len(sheet_names)} sheet(s): {sheet_names}")
        
        # Import clean_plotly_code to ensure fig.show() is always removed
        from .agents import clean_plotly_code
        
        # Clean the code first to remove fig.show() and other issues
        code = clean_plotly_code(code)
        
        # Create execution environment with necessary imports
        exec_globals = {
            'pd': pd,
            'np': np,
            'go': go,
            'plotly': plotly,
            'scipy': scipy,
            'stats': stats,
            'signal': signal,
            'optimize': optimize,
            'data': data,
        }
        
        # Set up dataframes: first sheet as default 'df', all sheets available by name
        if not sheet_names:
            logger.error("No sheets found in data")
            raise ValueError("No sheets found in data")
        
        # Default df is first sheet
        first_sheet_df = data[sheet_names[0]]
        if first_sheet_df is None:
            logger.error(f"First sheet '{sheet_names[0]}' has None DataFrame")
            raise ValueError(f"First sheet '{sheet_names[0]}' has None DataFrame")
        
        exec_globals['df'] = first_sheet_df
        logger.info(f"Default df: '{sheet_names[0]}' ({first_sheet_df.shape[0]} rows x {first_sheet_df.shape[1]} cols)")
        
        # Make all sheets available by their cleaned names
        for sheet_name, sheet_df in data.items():
            if sheet_df is None:
                logger.warning(f"Skipping sheet '{sheet_name}': DataFrame is None")
                continue
            exec_globals[sheet_name] = sheet_df
        
        # Try to import plotly.express if available
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except:
            pass
        
        # Create no-op functions to prevent accidental show() calls
        def noop_show(*args, **kwargs):
            """No-op function to prevent show() from opening browser tabs"""
            pass
        
        def noop_display(*args, **kwargs):
            """No-op function to prevent display() calls"""
            pass
        
        exec_globals['show'] = noop_show
        exec_globals['display'] = noop_display
        
        # Execute the code
        logger.info("Executing plotly code...")
        logger.info(f"Code to execute:\n{code}")
        exec(code, exec_globals)
        
        # Get the figure object (should be stored in 'fig' variable)
        fig = exec_globals.get('fig')
        
        if fig is None:
            logger.error("Code did not produce a 'fig' variable")
            raise ValueError("Code did not produce a 'fig' variable")
        
        if not isinstance(fig, go.Figure):
            logger.error(f"'fig' is not a Plotly Figure object, got {type(fig)}")
            raise ValueError(f"'fig' is not a Plotly Figure object, got {type(fig)}")
        
        # Enforce max width (1000px) and height (800px) constraints
        current_width = getattr(fig.layout, 'width', None) if fig.layout else None
        current_height = getattr(fig.layout, 'height', None) if fig.layout else None
        
        width = min(current_width, 1000) if current_width else 1000
        height = min(current_height, 800) if current_height else 800
        
        fig.update_layout(width=width, height=height)
        # enable this when debugging else comment
        #fig.show()
        # Convert figure to JSON
        fig_json = json.loads(fig.to_json())
        
        # VALIDATION: Check if figure has data
        if not fig.data:
            logger.warning("Figure has no data traces! Raising ValueError.")
            # Log the code that failed to produce data
            logger.warning(f"Code that produced empty figure:\n{code}")
            raise ValueError("The generated code created a figure with no data traces. Did you forget fig.add_trace()?")
            
        # Log first trace data sample to verify content
        if fig.data:
            logger.info(f"Figure data sample (trace 0): {str(fig.data[0])[:300]}...")

        logger.info("Plotly code executed successfully")
        
        return {
            'success': True,
            'figure': fig_json,
            'error': None
        }
        
    except Exception as e:
        logger.error(f"Plotly execution failed: {e}")
        logger.error(f"Code was:\n{code}")
        return {
            'success': False,
            'figure': None,
            'error': str(e),
            'code': code
        }


async def generate_chart_spec(
    df: pd.DataFrame | Dict[str, pd.DataFrame], 
    query: str, 
    dataset_context: str = None,
    user_id: int = None,
    dataset_id: str = None
) -> Tuple[List[Dict[str, Any]], dict, str]:
    """
    Generate Plotly chart specifications based on the user's query.
    
    Args:
        df: pandas DataFrame (CSV) or dict of DataFrames (multi-sheet Excel)
        query: Natural language query describing what visualization is needed
        dataset_context: Rich textual description of the dataset
        user_id: User ID for accessing session data
        dataset_id: Dataset ID for retrieving full dataset from session
        
    Returns:
        tuple: (list of chart specs, full plan dict, dashboard_title)
            Each chart spec contains:
            - chart_spec: Python code for generating the chart
            - chart_type: Type of chart (bar_chart, line_chart, etc.)
            - title: Chart title
            - chart_index: Index in the array
            - plan: Plan for this specific chart
            - figure: Executed Plotly figure as JSON (if successful)
            - error: Error message (if execution failed)
    """
    # try:
        # Get or initialize the visualization module with user_id and dataset_id
        # This allows the module to access the full dataset for metric validation
    viz_module = PlotlyVisualizationModule(user_id=user_id, dataset_id=dataset_id)
    
    # Data is always dict format now
    sheet_names = list(df.keys())
    first_sheet = df[sheet_names[0]]
    
    # Use dataset context or provide fallback
    if not dataset_context:
        columns = [str(col) for col in first_sheet.columns.tolist()]
        dataset_context = f"Dataset with {len(first_sheet)} rows and {len(first_sheet.columns)} columns. Columns: {', '.join(columns)}"
    
    # Always add execution environment info
    execution_info = (
        "\n\nIMPORTANT - Available DataFrames:\n"
        f"- Available sheets: {', '.join(sheet_names)}\n"
        f"- Default DataFrame 'df' contains: '{sheet_names[0]}'\n"
        f"- Access sheets by name: {', '.join([repr(name) for name in sheet_names])}\n"
        "- Use 'df' for default data or access specific sheets directly"
    )
    dataset_context += execution_info
    
    # Generate the visualization with dataset context
    result, full_plan, dashboard_title = await viz_module.aforward(
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
        
        return result, full_plan or {}, dashboard_title
    
    # Handle fail message (string)
    if isinstance(result, str):
        execution_result = execute_plotly_code(result, df)

        figure = execution_result.get('figure') if isinstance(execution_result, dict) else None
        success = execution_result.get('success') if isinstance(execution_result, dict) else False
        error = execution_result.get('error') if isinstance(execution_result, dict) else str(execution_result)

        return [{
            'chart_spec': result,
            'chart_type': 'error',
            'title': 'Error',
            'chart_index': 0,
            'plan': full_plan or {},
            'figure': figure,
            'execution_success': success,
            'execution_error': error
        }], full_plan or {}, dashboard_title
    
    return result, full_plan or {}, dashboard_title
        
#     except Exception as e:
#         logger.error(f"Failed to generate visualization: {e}")
#         # Return error response with a simple error figure
#         error_code = f"""
# import plotly.graph_objects as go

# fig = go.Figure()
# fig.add_annotation(
#     text="Error: {str(e)}",
#     xref="paper", yref="paper",
#     x=0.5, y=0.5, showarrow=False,
#     font=dict(size=14, color="red")
# )
# fig.update_layout(title="Visualization Error")
# fig
# """
#         execution_result = execute_plotly_code(error_code, df)

#         figure = execution_result.get('figure') if isinstance(execution_result, dict) else None

#         return [{
#             "chart_type": "error",
#             "title": "Error",
#             "chart_index": 0,
#             "chart_spec": error_code,
#             "figure": figure,
#             "execution_success": False,
#             "execution_error": f"Failed to generate visualization: {str(e)}"
#         }]
