"""
Chart Creator Module
====================

This module integrates with the DSPy-based visualization generation system
to create D3.js chart specifications from natural language queries.
"""

import pandas as pd
import os
from typing import Dict, Any
from .agents import D3VisualizationModule, initialize_dspy


# Global module instance (lazy initialization)
_viz_module: D3VisualizationModule = None


def get_viz_module() -> D3VisualizationModule:
    """
    Get or initialize the visualization module (singleton pattern).
    """
    global _viz_module
    if _viz_module is None:
        # Initialize DSPy with model from environment or default
        model = os.getenv("DSPY_MODEL", "gpt-4o-mini")
        _viz_module = initialize_dspy(model=model)
    return _viz_module


def generate_chart_spec(df: pd.DataFrame, query: str) -> Dict[str, Any]:
    """
    Generate a D3.js chart specification based on the user's query.
    
    Args:
        df: pandas DataFrame containing the data
        query: Natural language query describing what visualization is needed
        
    Returns:
        dict: Chart specification containing:
            - type: str - Chart type (histogram, bar, scatter, line, pie, heatmap, etc.)
            - data: list - Processed/aggregated data for the chart
            - spec: dict - D3.js configuration and code
            - metadata: dict - Additional information about the chart
    
    Example return format:
    {
        "type": "Bar Charts",
        "data": [...],  # Processed data ready for D3
        "spec": {
            "code": "// D3.js code...",
            "styling": [...],
            "renderer": "d3"
        },
        "metadata": {
            "title": "Distribution of Housing Prices",
            "x_label": "Price",
            "y_label": "Frequency",
            "description": "...",
            "columns_used": ["price"],
            "generated_by": "dspy_d3_module"
        },
        "plan": "Step by step visualization plan..."
    }
    """
    try:
        # Get or initialize the visualization module
        viz_module = get_viz_module()
        
        # Generate the visualization
        result = viz_module.forward(
            query=query,
            df=df,
            return_aggregation_code=False
        )
        
        return result
        
    except Exception as e:
        # Return error response if generation fails
        return {
            "type": "error",
            "message": f"Failed to generate visualization: {str(e)}",
            "data": [],
            "spec": {
                "code": f"// Error: {str(e)}",
                "renderer": "d3"
            },
            "metadata": {
                "title": "Error",
                "description": f"An error occurred: {str(e)}"
            }
        }


def validate_query(df: pd.DataFrame, query: str) -> Dict[str, Any]:
    """
    Validate if a query can be satisfied with the available data.
    
    Args:
        df: pandas DataFrame
        query: User query
        
    Returns:
        dict with validation results
    """
    try:
        viz_module = get_viz_module()
        
        # Use the validator directly
        validation = viz_module.validator(
            query=query,
            available_columns=str(df.columns.tolist()),
            column_types=str(df.dtypes.to_dict())
        )
        
        return {
            "is_valid": validation.is_valid,
            "missing_info": validation.missing_info if hasattr(validation, 'missing_info') else "",
            "suggested_columns": validation.suggested_columns if hasattr(validation, 'suggested_columns') else []
        }
    except Exception as e:
        return {
            "is_valid": False,
            "missing_info": f"Validation failed: {str(e)}",
            "suggested_columns": []
        }


