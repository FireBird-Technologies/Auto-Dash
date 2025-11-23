"""
Chart Insights Service
Extracts metadata from Plotly figures and generates AI insights.
"""

import json
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


def extract_figure_metadata(figure_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured metadata from a Plotly figure JSON.
    
    Args:
        figure_json: Plotly figure as JSON dict (from fig.to_json())
    
    Returns:
        Dict with structured metadata including chart type, axes, data stats, layout
    """
    try:
        data = figure_json.get("data", [])
        layout = figure_json.get("layout", {})
        
        if not data:
            return {
                "chart_type": "unknown",
                "axes": {},
                "data_stats": {},
                "layout": {}
            }
        
        # Determine chart type from first trace
        first_trace = data[0] if data else {}
        trace_type = first_trace.get("type", "unknown")
        
        chart_type_map = {
            "bar": "bar_chart",
            "scatter": "scatter_plot",
            "line": "line_chart",
            "histogram": "histogram",
            "box": "box_plot",
            "pie": "pie_chart",
            "heatmap": "heatmap",
            "violin": "violin_plot"
        }
        chart_type = chart_type_map.get(trace_type, trace_type)
        
        # Extract axes information
        axes_info = {}
        xaxis = layout.get("xaxis", {})
        yaxis = layout.get("yaxis", {})
        
        if xaxis:
            axes_info["x"] = {
                "label": xaxis.get("title", {}).get("text", "X Axis"),
                "data_type": "categorical" if trace_type in ["bar", "box", "violin"] else "numeric"
            }
        
        if yaxis:
            axes_info["y"] = {
                "label": yaxis.get("title", {}).get("text", "Y Axis"),
                "data_type": "numeric"
            }
        
        # Extract and compute statistics from data
        data_stats = {}
        
        # Collect all x and y values from all traces
        all_x_values = []
        all_y_values = []
        
        for trace in data:
            x_data = trace.get("x", [])
            y_data = trace.get("y", [])
            
            if x_data:
                # Convert to numeric if possible
                try:
                    x_numeric = [float(x) for x in x_data if x is not None and str(x).strip() != '']
                    if x_numeric:
                        all_x_values.extend(x_numeric)
                except (ValueError, TypeError):
                    # Categorical data
                    all_x_values.extend([str(x) for x in x_data if x is not None])
            
            if y_data:
                try:
                    y_numeric = [float(y) for y in y_data if y is not None and str(y).strip() != '']
                    if y_numeric:
                        all_y_values.extend(y_numeric)
                except (ValueError, TypeError):
                    pass
        
        # Compute statistics for numeric data
        if all_x_values and isinstance(all_x_values[0], (int, float)):
            x_array = np.array(all_x_values)
            data_stats["x_values"] = {
                "count": len(x_array),
                "min": float(np.min(x_array)),
                "max": float(np.max(x_array)),
                "mean": float(np.mean(x_array)),
                "median": float(np.median(x_array)),
                "std": float(np.std(x_array)) if len(x_array) > 1 else 0.0
            }
        else:
            # Categorical data
            unique_x = len(set(str(x) for x in all_x_values))
            data_stats["x_values"] = {
                "count": len(all_x_values),
                "unique": unique_x
            }
        
        if all_y_values:
            y_array = np.array(all_y_values)
            data_stats["y_values"] = {
                "count": len(y_array),
                "min": float(np.min(y_array)),
                "max": float(np.max(y_array)),
                "mean": float(np.mean(y_array)),
                "median": float(np.median(y_array)),
                "std": float(np.std(y_array)) if len(y_array) > 1 else 0.0
            }
        
        # Extract layout information
        layout_info = {
            "title": layout.get("title", {}).get("text", ""),
            "xaxis_range": None,
            "yaxis_range": None
        }
        
        if xaxis and "range" in xaxis:
            layout_info["xaxis_range"] = xaxis["range"]
        
        if yaxis and "range" in yaxis:
            layout_info["yaxis_range"] = yaxis["range"]
        
        # Extract annotations if any
        annotations = layout.get("annotations", [])
        if annotations:
            layout_info["annotations"] = [
                {"text": ann.get("text", ""), "x": ann.get("x"), "y": ann.get("y")}
                for ann in annotations[:5]  # Limit to first 5
            ]
        
        return {
            "chart_type": chart_type,
            "axes": axes_info,
            "data_stats": data_stats,
            "layout": layout_info,
            "trace_count": len(data)
        }
    
    except Exception as e:
        logger.error(f"Error extracting figure metadata: {e}")
        return {
            "chart_type": "unknown",
            "axes": {},
            "data_stats": {},
            "layout": {},
            "error": str(e)
        }

