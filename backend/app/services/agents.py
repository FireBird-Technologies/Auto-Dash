"""
DSPy-based Visualization Generation System
==========================================

This module uses DSPy to generate Plotly visualizations from natural language queries.
It includes a two-stage pipeline:
1. Planner: Converts user query to visualization plan
2. Plotly Generator: Converts plan to executable Plotly Python code
"""

import dspy
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import json
import logging
import asyncio
import re

# Set up logger for the module
logger = logging.getLogger("dspy_vis")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s][%(levelname)s] %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)


class plotly_editor(dspy.Signature):
    """ You are an AI that edits plotly code"""
    user_query = dspy.InputField(desc="edits the user needs to make")
    plotly_code = dspy.InputField(desc="The initial plotly code")
    dataset_context = dspy.InputField(desc="Context of the dataset ")
    edited_code = dspy.OutputField(desc="Edited code", prefix="```python")
    reasoning = dspy.OutputField(desc="Why did you make these edits explain")

class fig_editor(dspy.Signature):
    """ 
    You are an AI that generates Python code to analyze Plotly figure data.
    
    IMPORTANT: The code you generate must:
    1. Extract ALL data from fig.data (not just samples)
    2. Iterate through ALL traces in fig.data
    3. Extract ALL y-values (prices) from each trace
    4. Perform the requested calculation on the complete dataset
    
    The fig.data is a list of trace objects. Each trace has:
    - trace.y: array of y-values (prices in this case)
    - trace.x: array of x-values (area in this case)
    - trace.name: name of the trace (if available)
    
    Generate code that loops through ALL traces and extracts ALL values.
     Return pure Python code that can be executed directly with exec().
    """
    user_query = dspy.InputField(desc="edits the user needs to make")
    fig_data = dspy.InputField(desc="The initial fig.data")
    code = dspy.OutputField(desc="Edited code")
    reasoning = dspy.OutputField(desc="Why did you make these edits explain")

class chat_function(dspy.Module):
    def __init__(self):
        self.plotly_editor_mod = dspy.Predict(plotly_editor)
        self.fig_editor_mod = dspy.Predict(fig_editor)
        self.general_qa = dspy.Predict("user_query->answer")
  
        self.router = dspy.Predict("user_query->query_type:Literal['data_query','general_query','plotly_edit_query'],reasoning")

        
        
    async def aforward(self, user_query, fig_data, data_context,plotly_code):
        route = self.router(user_query=user_query)
        
        if 'data_query' in route.query_type:
            response = self.fig_editor_mod(user_query=user_query, fig_data=fig_data)
        elif 'plotly_edit_query' in route.query_type:
            response =  self.plotly_editor_mod(user_query=user_query,dataset_context=data_context, plotly_code=plotly_code)
        else:
            response = self.general_qa(user_query=user_query)
            
            
        return_dict = {'route':route,'response':response}
            
            
        
        
        return return_dict

# ============================================================================
# STYLING INSTRUCTIONS
# ============================================================================

STYLING_INSTRUCTIONS = [
    {
        "category": "line_charts",
        "description": "Used to visualize trends and changes over time, often with multiple series.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {
                "bold_html": True,
                "include": True
            },
            "colors": "use multiple colors if more than one line",
            "annotations": ["min", "max"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "showlegend": True,
                "hovermode": "x unified"
            }
        }
    },
    {
        "category": "bar_charts",
        "description": "Useful for comparing discrete categories or groups with bars representing values.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "annotations": ["bar values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "showlegend": True,
                "barmode": "group"
            }
        }
    },
    {
        "category": "histograms",
        "description": "Display the distribution of a data set, useful for returns or frequency distributions.",
        "styling": {
            "template": "plotly_white",
            "bin_size": 50,
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "scatter_plots",
        "description": "Show relationships between two numerical variables with points.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "point_style": {"size": 8, "opacity": 0.7},
            "annotations": ["correlation", "trend line"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "showlegend": True,
                "hovermode": "closest"
            }
        }
    },
    {
        "category": "pie_charts",
        "description": "Show composition or parts of a whole with slices representing categories.",
        "styling": {
            "template": "plotly_white",
            "top_categories_to_show": 10,
            "bundle_rest_as": "Others",
            "hole": 0.0,
            "title": {"bold_html": True, "include": True},
            "annotations": ["percentage labels"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "box_plots",
        "description": "Display statistical distributions, quartiles, and outliers.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "annotations": ["median", "quartiles", "outliers"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "boxmode": "group"
            }
        }
    },
    {
        "category": "heatmaps",
        "description": "Show data density or intensity using color scales on a matrix or grid.",
        "styling": {
            "template": "plotly_white",
            "colorscale": "Viridis",
            "axes_styles": {
                "line_color": "black",
                "line_width": 0.2,
                "grid_width": 1,
                "format_numbers_as_k_m": True,
                "exclude_non_numeric_formatting": True
            },
            "title": {"bold_html": True, "include": True},
            "annotations": ["cell values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000}
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "area_charts",
        "description": "Show cumulative totals and magnitude over time with filled areas.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "stackgroup": "one",
            "opacity": 0.7,
            "title": {"bold_html": True, "include": True},
            "annotations": ["trend"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "showlegend": True,
                "hovermode": "x unified"
            }
        }
    },
    {
        "category": "histogram_distribution",
        "description": "Specialized histogram for return distributions with opacity control.",
        "styling": {
            "template": "plotly_white",
            "bin_size": 50,
            "opacity": 0.75,
            "axes_styles": {
                "grid_width": 1,
                "format_numbers_as_k_m": True,
                "exclude_non_numeric_formatting": True
            },
            "title": {"bold_html": True, "include": True},
            "annotations": ["mean", "std_dev"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "tabular_and_generic_charts",
        "description": "Applies to charts where number formatting needs flexibility, including mixed or raw data.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "exclude_if_commas_present": True,
                "exclude_if_not_numeric": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "sunburst_charts",
        "description": "Hierarchical data visualization showing part-to-whole relationships in a radial layout.",
        "styling": {
            "template": "plotly_white",
            "title": {"bold_html": True, "include": True},
            "annotations": ["hierarchy levels", "values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "treemap_charts",
        "description": "Hierarchical data using nested rectangles, useful for showing proportions.",
        "styling": {
            "template": "plotly_white",
            "title": {"bold_html": True, "include": True},
            "annotations": ["labels", "values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "violin_plots",
        "description": "Combination of box plot and density plot, showing distribution shape.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "opacity": 0.8,
            "title": {"bold_html": True, "include": True},
            "annotations": ["median", "quartiles"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "funnel_charts",
        "description": "Show stages in a process with decreasing values, common in sales/conversion.",
        "styling": {
            "template": "plotly_white",
            "title": {"bold_html": True, "include": True},
            "annotations": ["stage values", "conversion rates"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "waterfall_charts",
        "description": "Show cumulative effect of sequential positive and negative values.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "annotations": ["incremental values", "totals"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    },
    {
        "category": "bubble_charts",
        "description": "Scatter plot with third dimension represented by bubble size.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "bubble_style": {"size_range": [5, 50], "opacity": 0.6},
            "annotations": ["correlation"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000},
            "layout": {
                "showlegend": True,
                "hovermode": "closest"
            }
        }
    },
    {
        "category": "candlestick_charts",
        "description": "Financial chart showing open, high, low, close prices over time.",
        "styling": {
            "template": "plotly_white",
            "axes_line_width": 0.2,
            "grid_width": 1,
            "title": {"bold_html": True, "include": True},
            "colors": {"increasing": "#26a69a", "decreasing": "#ef5350"},
            "annotations": ["price levels"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 1200, "width": 1000}
        }
    }
]


# ============================================================================
# DSPY SIGNATURES
# ============================================================================

# STYLING_INSTRUCTIONS = [str(x) for x in STYLING_INSTRUCTIONS]

class GenerateVisualizationPlan(dspy.Signature):
    """
    Generate a structured visualization plan from a natural language query.
    Output a JSON dictionary with data_source and chart specifications.
    
    Format: {
      "data_source": {"file_type": "csv" or "excel", "sheet_name": "Sheet1" (for Excel, omit for CSV)},
      "bar_chart": {"title": "Chart Title", "instructions": "Specific Plotly instructions"},
      "line_chart": {"title": "Another Chart", "instructions": "More instructions"},
      ...
    }
    
    For multi-sheet Excel files, specify which sheet to use in data_source.sheet_name.
    Available chart types: bar_chart, line_chart, scatter_plot, heatmap, histogram, pie_chart, box_plot, area_chart
    
    Keep instructions short (2-3 lines per chart).
    Include only essential charts—avoid redundant ones.
    """

    query = dspy.InputField(
        desc="User's natural language query, e.g., 'Compare monthly revenue trends across regions.'"
    )
    dataset_context = dspy.InputField(desc="Dataset information including file_type, sheets (for Excel), columns, types, sample data, statistics")
    
    plan = dspy.OutputField(
        desc=(
            "JSON dictionary with 'data_source' key containing {'file_type': 'csv' or 'excel', 'sheet_name': 'SheetName' (for Excel only)}, "
            "and chart_type keys (bar_chart, line_chart, scatter_plot, heatmap, histogram, pie_chart, box_plot, area_chart) "
            'with values as objects: {"title": "Descriptive Chart Title", "instructions": "Specific Plotly visualization instructions"}.'
        ),
        type=dict
    )

    relevant_query = dspy.OutputField(
        desc="Boolean flag — True if the query is NOT about visualizations. False if it IS relevant.",
        type=bool
    )


class fix_plotly(dspy.Signature):
    """Fix broken Plotly Python code."""
    plotly_code = dspy.InputField(desc="The error-based Plotly code")
    error = dspy.InputField(desc="The error generated by the system")
    fix = dspy.OutputField(desc="The fixed code that can run")


class CreateDatasetContext(dspy.Signature):
    """
    Generate dataset context for visualization tasks.
    The dataset context should describe columns, types, sample values, and relevant statistics in JSON format.
    Keep it concise to deliver insights quickly!
    """

    dataframe_info = dspy.InputField(
        desc="Information about the pandas DataFrame: column names, types, and samples/statistics."
    )

    dataset_context = dspy.OutputField(
        desc="A JSON-like string with columns, data types, sample values, value ranges, and key statistics."
    )


# ============================================================================
# FAILURE MESSAGE
# ============================================================================

FAIL_MESSAGE = """# Plotly: No visualization generated.
# Reason: The query was not about analysis/visualization or the data is invalid.
import plotly.graph_objects as go
fig = go.Figure()
fig.add_annotation(
    text="No visualization generated: The query was not about analysis/visualization.",
    xref="paper", yref="paper",
    x=0.5, y=0.5, showarrow=False,
    font=dict(size=16, color="red")
)
"""


# ============================================================================
# COMMON PLOTLY DOCUMENTATION
# ============================================================================

COMMON_PLOTLY_DOCS = """
🚨🚨🚨 CRITICAL OUTPUT FORMAT - READ CAREFULLY 🚨🚨🚨

REQUIRED FORMAT:
- Pure Python code using Plotly
- Start with imports: import plotly.graph_objects as go (or import plotly.express as px)
- ALWAYS assume 'df' already exists (pandas DataFrame) - DO NOT create or load it
- Create figure using Plotly
- MUST end with: fig (the variable name that stores the figure object)

FORBIDDEN - DO NOT INCLUDE:
- fig.show() or fig.write_html() calls
- Data loading code (pd.read_csv, pd.read_excel, pd.DataFrame(), data = ..., df = pd.read_..., etc.)
- Data creation code (df = ..., data = ..., etc.) - df ALREADY EXISTS
- Markdown code blocks (```)
- HTML or JavaScript code
- File I/O operations

REQUIRED:
1. Use 'df' directly - it's already loaded and available (NEVER add df = ... or data = ...)
2. Process/aggregate data using pandas if needed (e.g., df.groupby(), df.agg(), etc.)
3. Create Plotly figure with go.Figure() or px functions using 'df'
4. Configure layout with fig.update_layout()
5. END with just: fig (on its own line, this returns the figure)

EXAMPLE STRUCTURE:
import plotly.graph_objects as go
import pandas as pd

# Process data (df already exists, use it directly)
grouped = df.groupby('category')['value'].sum().reset_index()

# Create figure
fig = go.Figure()
fig.add_trace(go.Bar(x=grouped['category'], y=grouped['value']))
fig.update_layout(title="My Chart", xaxis_title="Category", yaxis_title="Value")

fig
"""


# ============================================================================
# PLOTLY CHART SIGNATURES
# ============================================================================

class bar_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for a bar chart.
    
    Bar charts compare discrete categories.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for bar chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class line_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for a line chart.
    
    Line charts show trends over time or continuous data.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for line chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class scatter_plot_plotly(dspy.Signature):
    """Generate Plotly Python code for a scatter plot.
    
    Scatter plots show relationships between two variables.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for scatter plot")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class histogram_plotly(dspy.Signature):
    """Generate Plotly Python code for a histogram.
    
    Histograms show distributions of numerical data.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for histogram")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class heatmap_plotly(dspy.Signature):
    """Generate Plotly Python code for a heatmap.
    
    Heatmaps show data intensity using colors.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for heatmap")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class pie_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for a pie chart.
    
    Pie charts show parts of a whole.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for pie chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class box_plot_plotly(dspy.Signature):
    """Generate Plotly Python code for a box plot.
    
    Box plots show statistical distributions and outliers.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for box plot")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class area_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for an area chart.
    
    Area charts show cumulative values over time.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for area chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clean_plotly_code(code: str) -> str:
    """
    Clean Plotly code by removing markdown formatting and other artifacts.
    Returns pure Python Plotly code.
    """
    if not code:
        return code
    
    cleaned = code.strip()
    
    # Remove markdown code blocks
    if cleaned.startswith('```python'):
        cleaned = cleaned.replace('```python', '', 1)
    elif cleaned.startswith('```'):
        cleaned = cleaned.replace('```', '', 1)
    
    if cleaned.endswith('```'):
        cleaned = cleaned.rsplit('```', 1)[0]
    
    # Remove any remaining markdown artifacts
    cleaned = cleaned.replace('```', '')
    
    # Remove fig.show() calls - enhanced regex to catch all variations
    cleaned = re.sub(r'fig\.show\s*\(\s*\)', '', cleaned)  # fig.show()
    cleaned = re.sub(r'fig\.show\s*\([^)]*\)', '', cleaned)  # fig.show(renderer='browser')
    cleaned = re.sub(r'\.show\s*\(\s*\)', '', cleaned)  # .show() on any variable
    
    # Remove fig.write_html() calls
    cleaned = re.sub(r'fig\.write_html\([^)]*\)', '', cleaned)
    
    # Remove any plotly.io.show() calls
    cleaned = re.sub(r'plotly\.io\.show\([^)]*\)', '', cleaned)
    cleaned = re.sub(r'pio\.show\([^)]*\)', '', cleaned)
    
    # Remove data loading code - df already exists, never create or load it
    cleaned = re.sub(r'(data|df)\s*=\s*pd\.read_csv\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'(data|df)\s*=\s*pd\.read_[a-z]+\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'(data|df)\s*=\s*pd\.DataFrame\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'(data|df)\s*=\s*data\[[^\]]+\]', '# Data already loaded', cleaned)
    cleaned = re.sub(r'df\s*=\s*data\.copy\(\)', '# df already exists', cleaned)
    cleaned = re.sub(r'df\s*=\s*data\s*$', '# df already exists', cleaned, flags=re.MULTILINE)
    
    # Ensure code ends with 'fig' on its own line
    lines = cleaned.strip().split('\n')
    if lines and not lines[-1].strip() == 'fig':
        cleaned = cleaned.strip() + '\nfig'
    
    return cleaned.strip()


# ============================================================================
# MAIN PLOTLY MODULE
# ============================================================================

class PlotlyVisualizationModule(dspy.Module):
    def __init__(self):
        self.styling_instructions = STYLING_INSTRUCTIONS
        self.planner = dspy.Predict(GenerateVisualizationPlan)
        self.chart_sigs = {
            'bar_chart': dspy.asyncify(dspy.Predict(bar_chart_plotly)),
            'line_chart': dspy.asyncify(dspy.Predict(line_chart_plotly)),
            'scatter_plot': dspy.asyncify(dspy.Predict(scatter_plot_plotly)),
            'histogram': dspy.asyncify(dspy.Predict(histogram_plotly)),
            'heatmap': dspy.asyncify(dspy.Predict(heatmap_plotly)),
            'pie_chart': dspy.asyncify(dspy.Predict(pie_chart_plotly)),
            'box_plot': dspy.asyncify(dspy.Predict(box_plot_plotly)),
            'area_chart': dspy.asyncify(dspy.Predict(area_chart_plotly))
        }
        self.fail = FAIL_MESSAGE

    async def aforward(self, query, dataset_context):
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1500)):
            plan = self.planner(query=query, dataset_context=dataset_context)

        plan_output = plan.plan

        if isinstance(plan_output, str):
            try:
                plan_output = json.loads(plan_output)
            except json.JSONDecodeError:
                logger.error("Failed to parse plan JSON: %s", plan.plan)
                return self.fail

        logger.info("GenerateVisualizationPlan result: %s", plan_output)
        
        tasks = []
        
        if 'False' in str(plan.relevant_query):
            # Query is relevant for visualization
            # Extract data_source info from plan
            data_source = plan_output.get('data_source', {'file_type': 'csv'})
            
            for chart_key in self.chart_sigs.keys():
                if chart_key in plan_output:
                    # Find styling for this chart type
                    style = next(
                        (s['styling'] for s in self.styling_instructions if s.get('category') == chart_key + 's'),
                        {}
                    )
                    
                    try:
                        chart_plan = plan_output[chart_key]
                    except Exception as e:
                        logger.error(f"Failed to extract chart plan for {chart_key}: {e}")
                        continue
                    
                    tasks.append(self.chart_sigs[chart_key](
                        plan=chart_plan,
                        dataset_context=dataset_context,
                        styling=style
                    ))
            
            if not tasks:
                # Default to bar chart if no specific type detected
                style = next(
                    (s['styling'] for s in self.styling_instructions if s.get('category') == 'bar_charts'),
                    {}
                )
                tasks.append(self.chart_sigs['bar_chart'](
                    plan=plan.plan,
                    dataset_context=dataset_context,
                    styling=style
                ))
            
            results = await asyncio.gather(*tasks)
            
            # Process results into chart specifications
            chart_specs = []
            
            for i, r in enumerate(results):
                raw_code = getattr(r, 'plotly_code', str(r))
                cleaned = clean_plotly_code(raw_code)
                
                # Prepend data selection code based on file type
                file_type = data_source.get('file_type', 'csv')  # Default to CSV if not specified
                
                if file_type == 'excel' and data_source.get('sheet_name'):
                    # Multi-sheet Excel: use the specified sheet
                    sheet_name = data_source['sheet_name']
                    data_selection = f"# Select sheet from Excel file\ndf = data['{sheet_name}']\n\n"
                    cleaned = data_selection + cleaned
                else:
                    # CSV or single-sheet: use data directly
                    # Only add df = data if not already present
                    if 'df = data' not in cleaned and 'df=' not in cleaned and 'df =' not in cleaned:
                        cleaned = "df = data\n\n" + cleaned
                
                # Get chart type and title
                chart_type = list(self.chart_sigs.keys())[min(i, len(self.chart_sigs) - 1)]
                title = "Visualization"
                
                try:
                    if chart_type in plan_output:
                        chart_info = plan_output[chart_type]
                        if isinstance(chart_info, dict) and 'title' in chart_info:
                            title = chart_info['title']
                except:
                    pass
                
                chart_specs.append({
                    'chart_spec': cleaned,
                    'chart_type': chart_type,
                    'title': title,
                    'chart_index': i
                })
                
                logger.info(f"Chart {i+1} ({chart_type}): {title} - cleaned successfully")
            
            logger.info(f"Generated {len(chart_specs)} charts")
            return chart_specs
        else:
            logger.info("Query not relevant for visualization. Returning FAIL_MESSAGE.")
            return self.fail + str(plan.relevant_query)
