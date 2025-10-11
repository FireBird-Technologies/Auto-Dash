"""
Chart Creator Module
====================

This module integrates with the DSPy-based visualization generation system
to create D3.js chart specifications from natural language queries.
"""

import pandas as pd
import os
import re
from typing import Dict, Any
from .agents import D3VisualizationModule


def clean_d3_code(d3_code: str) -> str:
    """
    Clean D3.js code by removing data loading statements and fixing container selection.
    
    This function:
    - Removes d3.csv(), d3.json(), d3.tsv(), d3.xml() calls
    - Removes fetch() API calls for data loading
    - Replaces d3.select("body") with d3.select("#visualization")
    - Fixes deprecated D3 v5 syntax to D3 v7
    
    Args:
        d3_code: Raw D3.js code string
        
    Returns:
        Cleaned D3.js code that works in our container
    """
    if not d3_code or not isinstance(d3_code, str):
        return d3_code
    
    # Pattern 1: Replace d3.select("body") with d3.select("#visualization")
    d3_code = re.sub(r'd3\.select\(["\']body["\']\)', 'd3.select("#visualization")', d3_code)
    
    # Pattern 2: Replace d3.select(document.body) with d3.select("#visualization")
    d3_code = re.sub(r'd3\.select\(document\.body\)', 'd3.select("#visualization")', d3_code)
    
    # Pattern 3: Replace d3.nest() with d3.group() (D3 v7 syntax)
    # This is complex, so we'll add a comment for now
    if 'd3.nest()' in d3_code:
        d3_code = re.sub(r'd3\.nest\(\)', 'd3.rollup', d3_code)
    
    # Pattern 4: Remove d3.csv/json/tsv/xml calls with .then()
    patterns_to_remove = [
        r'd3\.(csv|json|tsv|xml)\([^)]*\)\s*\.then\s*\(\s*function\s*\([^)]*\)\s*\{',
        r'd3\.(csv|json|tsv|xml)\([^)]*\)\s*\.then\s*\(\s*\(?[^)=]*\)?\s*=>\s*\{',
        r'fetch\([^)]*\)\s*\.then\([^)]*\)\s*\.then\s*\(\s*function\s*\([^)]*\)\s*\{',
        r'fetch\([^)]*\)\s*\.then\([^)]*\)\s*\.then\s*\(\s*\(?[^)=]*\)?\s*=>\s*\{',
    ]
    
    for pattern in patterns_to_remove:
        d3_code = re.sub(pattern, '// Data is already available as \'data\' parameter\n', d3_code, flags=re.MULTILINE)
    
    # Pattern 5: Remove standalone d3.csv/json/tsv/xml calls
    d3_code = re.sub(r'd3\.(csv|json|tsv|xml)\([^)]*\);?', '', d3_code)
    
    # Pattern 6: Remove fetch() calls
    d3_code = re.sub(r'fetch\([^)]*\)\.then\([^)]*\);?', '', d3_code)
    
    # Pattern 7: Remove lines that define data loading promises
    d3_code = re.sub(r'(const|let|var)\s+\w+\s*=\s*d3\.(csv|json|tsv|xml)\([^)]*\);?', '', d3_code)
    
    # Pattern 8: Clean up multiple empty lines
    d3_code = re.sub(r'\n{3,}', '\n\n', d3_code)
    
    return d3_code.strip()


# Global module instance (lazy initialization)



async def generate_chart_spec(
    df: pd.DataFrame, 
    query: str, 
    dataset_context: str = None
) -> Dict[str, Any]:
    """
    Generate a D3.js chart specification based on the user's query.
    
    Args:
        df: pandas DataFrame containing the data
        query: Natural language query describing what visualization is needed
        dataset_context: Rich textual description of the dataset (from DSPy context generation)
        
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
        viz_module = D3VisualizationModule()
        
        # Use dataset context or provide fallback
        if not dataset_context:
            columns = [str(col) for col in df.columns.tolist()]
            dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns: {', '.join(columns)}"
        
        # Generate the visualization with dataset context
        result = await viz_module.aforward(
            query=query,
            dataset_context=dataset_context
        )
        
        # Clean the D3 code to remove any data loading statements
        if isinstance(result, str):
            result = clean_d3_code(result)
        elif isinstance(result, dict) and 'code' in result:
            result['code'] = clean_d3_code(result['code'])
        elif isinstance(result, dict) and 'spec' in result and isinstance(result['spec'], dict):
            if 'code' in result['spec']:
                result['spec']['code'] = clean_d3_code(result['spec']['code'])
        
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


