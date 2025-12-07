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
from contextvars import ContextVar
import os
# Set up logger for the module
logger = logging.getLogger("dspy_vis")
logger.setLevel(logging.WARNING)  # Changed from INFO to WARNING to reduce logging
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s][%(levelname)s] %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

# Context variable to store dataset for metric function
_dataset_context: ContextVar[Optional[Dict[str, pd.DataFrame]]] = ContextVar('_dataset_context', default=None)


class plotly_editor(dspy.Signature):
    """ You are an AI that edits plotly code
    
    IMPORTANT:
    1. You must output the FULL executable Python code, not just the changes.
    2. The code must start with imports (e.g. import plotly.graph_objects as go).
    3. The code must assume 'df' is already available (do not load it).
    4. The code must create the 'fig' object and populate it.
    5. The code must end with 'fig' on the last line.
    6. You MUST add data traces (fig.add_trace) or use px functions. Do NOT just update layout.
    7. set fig.update_layout(template='plotly_white').
    """
    user_query = dspy.InputField(desc="edits the user needs to make")
    plotly_code = dspy.InputField(desc="The initial plotly code")
    dataset_context = dspy.InputField(desc="Context of the dataset ")
    edited_code = dspy.OutputField(desc="Edited code", prefix="```python")
    reasoning = dspy.OutputField(desc="Why did you make these edits explain")

class plotly_adder_sig(dspy.Signature):
    """
    You are an AI that generates code to add a NEW Plotly chart to an existing dashboard.

    GOAL:
    - Create full Plotly Python code to add a new chart, based on a user request, ready to be included in a dashboard.

    RULES:
    1. Output the complete, standalone Plotly code for this chart addition.
    2. Code must start with necessary imports (e.g. import plotly.graph_objects as go, or import plotly.express as px).
    3. Assume 'df' (and any relevant dataframes from dataset_context) are available and already loaded (do NOT load any files).
    4. Generate only the code for the NEW chart as requested by the user, *not* the full dashboard.
    5. set fig.update_layout(template='plotly_white').
    6. Output must end with the 'fig' variable as the final line.
    7. The chart type, data, and features must be based on user_request and the dataset context.

    INPUTS:
    - user_request: Instructions for the new chart to add to the dashboard.
    - dataset_context: Information about available columns, sheets, and data context.

    OUTPUTS:
    - chart_code: The full, executable Python Plotly code to create the new chart (starts with ```python).
    - reasoning: Explanation of how the chart matches the user request and dataset.

    """
    user_query = dspy.InputField(desc="The new chart user wants to add to the dashboard")
    dataset_context = dspy.InputField(desc="Information about available data, sheets, columns, sample values")
    chart_code = dspy.OutputField(desc="Executable Plotly Python code for the new chart", prefix="```python")
    reasoning = dspy.OutputField(desc="Explanation of design choices and data mapping")



class data_query_sig(dspy.Signature):
    """
    You are a pandas expert AI that performs data analysis according to user instructions.

    CRITICAL RESTRICTIONS:
    - ONLY use pandas and numpy - NO other libraries allowed
    - DO NOT create visualizations, charts, or plots of any kind
    - NO matplotlib, plotly, seaborn, or any plotting libraries
    - If user asks for visualization, respond that they should use the chart editor instead

    IMPORTANT: The code you generate MUST:
    1. Take a DataFrame named `df` as input (do not create or load the DataFrame, assume it exists)
    2. Use ONLY pandas (and optionally numpy) - absolutely NO other imports
    3. Perform data analysis, statistics, filtering, aggregation, or transformations
    4. Output results in ONE of these ways:
       - Store final result in variable called 'result'
       - Use print() to output text summaries
       - Store DataFrame results in 'display' or 'summary' variables
    5. Do NOT include I/O (file reads/writes), only work in memory
    6. For multi-sheet data: access sheets by name or use 'df' for the first sheet
    7. ALWAYS include output - use print() or store in 'result' variable
    8. DO NOT import or use: matplotlib, plotly, seaborn, bokeh, or any visualization library

    FORMATTING REQUIREMENTS:
    - Round all numeric results to MAX 2 decimal places (use .round(2))
    - Format datetime columns to show ONLY date (YYYY-MM-DD) using .dt.date or .dt.strftime('%Y-%m-%d')
    - Do NOT show hours/minutes/seconds in datetime unless user explicitly asks for time precision
    - Apply formatting before displaying or storing results

    Return pure Python code that can be executed directly with exec().
    """
    user_query = dspy.InputField(desc="Analysis or edits the user wants to perform on the DataFrame")
    dataset_context = dspy.InputField(desc="The input pandas DataFrame context and available sheets")
    code = dspy.OutputField(desc="Python code for the analysis/manipulation - pandas/numpy ONLY, NO visualizations")
    reasoning = dspy.OutputField(desc="Why did you make these edits? Explain your reasoning.")

class chart_matcher(dspy.Signature):
    """Match user query to chart index. Return integer index."""
    query = dspy.InputField(desc="user query")
    charts = dspy.InputField(desc="JSON: [{'i':0,'t':'scatter_plot','n':'Title','p':{}},...]")
    chart_index = dspy.OutputField(type=int, desc="Matching chart index or -1")

CLARITY_RESPONSE = (
    "I'm sorry, I couldn't understand your request.\n\n"
    "#### Here’s what I can help you with:\n"
    "- **Edit** or **add** a chart to your dashboard\n"
    "- **Analyze your data** or perform computations\n"
    "- Answer **general questions** about your dataset\n\n"
    "Please clarify what you'd like to do, or ask for help with one of the options above!"
)



class chat_function(dspy.Module):
    def __init__(self):
        self.plotly_editor_mod = dspy.Predict(plotly_editor)
        self.data_query_mod = dspy.Predict(data_query_sig)
        self.plotly_add_mod = dspy.Predict(plotly_adder_sig)
        self.general_qa = dspy.Predict("user_query->answer")
        self.CLARITY_RESPONSE = CLARITY_RESPONSE

  
        self.router = dspy.Predict("user_query->query_type:Literal['data_query','general_query','need_more_clarity','plotly_edit_query','add_chart_query'],reasoning")

        
        
    async def aforward(self, user_query, fig_data, data_context,plotly_code):
        with dspy.context(lm= dspy.LM('openai/gpt-4o-mini', api_key=os.getenv('OPENAI_API_KEY'), max_tokens=600)):
            route = self.router(user_query=user_query)
        
        if 'data_query' in route.query_type:
            response = self.data_query_mod(user_query=user_query, dataset_context=data_context)
        elif 'plotly_edit_query' in route.query_type:
            response =  self.plotly_editor_mod(user_query=user_query,dataset_context=data_context, plotly_code=plotly_code)
        elif 'add_chart_query' in route.query_type:
            response =  self.plotly_add_mod(user_query=user_query,dataset_context=data_context)
        elif 'need_more_clarity' in route.query_type:
            response = self.CLARITY_RESPONSE

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
        "category": "kpi_cards",
        "description": "Display key performance indicators with values, change indicators, and optional mini charts.",
        "styling": {
            "template": "plotly_white",
            "title": {"bold_html": True, "include": True},
            "show_change_indicator": True,
            "show_sparkline": True,
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 1000000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "default_size": {"height": 300, "width": 400},
            "layout": {
                "showlegend": False
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
      "filters": {
        "enabled": true,
        "instructions": "Add filter controls for key dimensions like date ranges, categories, or numerical ranges. Each chart should respect these filters."
      },
      "interconnected": {
        "enabled": true,
        "instructions": "Make charts interconnected - when a user clicks or selects data in one chart, other charts should update to show filtered/related data. Use Plotly's built-in selection callbacks or shared filter state."
      },
      "bar_chart": {"title": "Chart Title", "instructions": "Specific Plotly instructions"},
      "line_chart": {"title": "Another Chart", "instructions": "More instructions"},
      ...
    }
    
    For multi-sheet Excel files, specify which sheet to use in data_source.sheet_name.
    Available chart types: bar_chart, line_chart, scatter_plot, heatmap, histogram, pie_chart, box_plot, area_chart
    
    Keep instructions short (2-3 lines per chart).
    Include only essential charts - avoid redundant ones.
    ALWAYS include filters and interconnected settings in the plan.
    
    KPI CARDS: If the dashboard should include KPI cards (3-4 key metrics displayed as small squares at the top), 
    set kpi_cards=True and include a "kpi_cards" array in the plan with 3-4 KPI specifications.
    """

    query = dspy.InputField(
        desc="User's natural language query, e.g., 'Compare monthly revenue trends across regions.'"
    )
    dataset_context = dspy.InputField(
        desc="Dataset information including available sheet names, columns, types, sample data, statistics. "
        "IMPORTANT: Lists which DataFrames are available (df is default, sheets accessible by name)"
    )
    dashboard_title = dspy.OutputField(desc="A global title for the dashboard", type=str)
    kpi_cards = dspy.OutputField(
        desc="Boolean - True if the dashboard should include KPI cards (3-4 key metrics as small squares at the top)",
        type=bool
    )
    plan = dspy.OutputField(
        desc=(
            "JSON dictionary with 'data_source' key containing {'file_type': 'csv' or 'excel', 'sheet_name': 'SheetName' (for Excel only)}, "
            "'filters' key with {'enabled': bool, 'instructions': str}, "
            "'interconnected' key with {'enabled': bool, 'instructions': str}, "
            "and chart_type keys (bar_chart, line_chart, scatter_plot, heatmap, histogram, pie_chart, box_plot, area_chart) "
            'with values as objects: {"title": "Descriptive Chart Title", "instructions": "Specific Plotly visualization instructions"}. '
            'If kpi_cards=True, include a "kpi_cards" key with an array of 3-4 objects: [{"title": "KPI Title", "metric": "metric_name", "instructions": "Display instructions"}]'
        ),
        type=dict
    )

    relevant_query = dspy.OutputField(
        desc="Boolean flag - True if the query is NOT about visualizations. False if it IS relevant.",
        type=bool
    )


class fix_plotly(dspy.Signature):
    """Fix broken Plotly Python code. Return a complete replacement for the error context window,
    including all necessary code (not just the changed line). Maintain the same indentation
    level as the original code context. The fix should be a complete, executable code block
    that replaces the error context window."""
    plotly_code = dspy.InputField(desc="The error-based Plotly code context window (15 lines around error)")
    error = dspy.InputField(desc="The error message generated by the system")
    fix = dspy.OutputField(desc="The complete fixed code block that replaces the error context. Include all necessary code with proper indentation matching the original context.")


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
REQUIRED FORMAT:
- Pure Python Plotly code starting with imports (go or px)
- Use DataFrame variables specified in dataset_context (e.g., 'df' for default, sheet names for multi-sheet)
- Process data with pandas, create Plotly figure, end with: fig

DO NOT add filter controls or dropdowns to the chart - filtering is handled separately by the UI.
DO NOT use fig.update_layout(updatemenus=[...]) for filters.

FORBIDDEN: fig.show(), data loading/creation, markdown blocks, HTML/JS, filter controls on chart
EXAMPLE:
grouped = df.groupby('category')['value'].sum().reset_index()
fig = go.Figure().add_trace(go.Bar(x=grouped['category'], y=grouped['value']))
fig.update_layout(title="My Chart", xaxis_title="Category", yaxis_title="Value")
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
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class line_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for a line chart.
    
    Line charts show trends over time or continuous data.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for line chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class scatter_plot_plotly(dspy.Signature):
    """Generate Plotly Python code for a scatter plot.
    
    Scatter plots show relationships between two variables.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for scatter plot")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class histogram_plotly(dspy.Signature):
    """Generate Plotly Python code for a histogram.
    
    Histograms show distributions of numerical data.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for histogram")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class heatmap_plotly(dspy.Signature):
    """Generate Plotly Python code for a heatmap.
    
    Heatmaps show data intensity using colors. Only use this for correlation stuff
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for heatmap")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")




class box_plot_plotly(dspy.Signature):
    """Generate Plotly Python code for a box plot.
    
    Box plots show statistical distributions and outliers.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for box plot")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class area_chart_plotly(dspy.Signature):
    """Generate Plotly Python code for an area chart.
    
    Area charts show cumulative values over time.
    
    """ + COMMON_PLOTLY_DOCS
    
    plan = dspy.InputField(desc="User requirements for area chart")
    styling = dspy.InputField(desc="Chart styling preferences")
    dataset_context = dspy.InputField(
        desc="Dataset info: available sheets, columns, stats. Use 'df' for default data or access sheets by name"
    )
    plotly_code = dspy.OutputField(desc="Pure Python Plotly code - must end with 'fig'")


class kpi_card_plotly(dspy.Signature):
    """Generate MINIMAL Plotly KPI card using go.Indicator with mode="number" ONLY.
    
    STRICT REQUIREMENTS - Follow exactly:
    
    import plotly.graph_objects as go
    
    value = df['column'].sum()  # Calculate ONE metric
    
    fig = go.Figure(go.Indicator(
        mode="number",
        value=value,
        title={"text": "Title", "font": {"size": 12, "color": "#6b7280"}},
        number={"font": {"size": 28, "color": "#111827"}, "valueformat": ",.0f"}
    ))
    fig.update_layout(margin=dict(l=10, r=10, t=25, b=10), paper_bgcolor="white")
    fig
    
    FORBIDDEN - DO NOT USE:
    - mode="gauge" or any gauge
    - mode="delta" or mode="number+delta"
    - Sparklines or any additional traces
    - Any colors other than #111827 (number) and #6b7280 (title)
    
    ONLY USE: mode="number" - simple number display with title above it.
    """
    
    plan = dspy.InputField(desc="KPI metric to display - use mode='number' ONLY")
    styling = dspy.InputField(desc="Ignored - use standard minimal style")
    dataset_context = dspy.InputField(desc="Dataset info")
    plotly_code = dspy.OutputField(desc="Minimal go.Indicator code with mode='number' only")


class kpi_editor(dspy.Signature):
    """Edit a KPI card based on user instructions.
    
    Output MINIMAL Plotly KPI card using go.Indicator with mode="number" ONLY.
    
    STRICT REQUIREMENTS - Follow exactly:
    
    import plotly.graph_objects as go
    
    value = df['column'].sum()  # Calculate ONE metric
    
    fig = go.Figure(go.Indicator(
        mode="number",
        value=value,
        title={"text": "Title", "font": {"size": 12, "color": "#6b7280"}},
        number={"font": {"size": 28, "color": "#111827"}, "valueformat": ",.0f"}
    ))
    fig.update_layout(margin=dict(l=10, r=10, t=25, b=10), paper_bgcolor="white")
    fig
    
    FORBIDDEN - DO NOT USE:
    - mode="gauge" or any gauge
    - mode="delta" or mode="number+delta"
    - Sparklines or any additional traces
    - Any colors other than #111827 (number) and #6b7280 (title)
    
    ONLY USE: mode="number" - simple number display with title above it.
    """
    user_query = dspy.InputField(desc="The edit instructions from the user")
    current_code = dspy.InputField(desc="The current KPI card code")
    dataset_context = dspy.InputField(desc="Dataset info: columns, types, sample values")
    edited_code = dspy.OutputField(desc="Edited KPI code with mode='number' only", prefix="```python")
    new_title = dspy.OutputField(desc="The new title for this KPI card (short, descriptive)")


class SuggestQueries(dspy.Signature):
    """Generate a single contextual query suggestion for dataset visualization."""
    dataset_context = dspy.InputField(desc="Column names, types, sample rows")
    suggestion = dspy.OutputField(desc="A single creative and insightful query that leads to multiple charts (5-10 words)")


class ChartInsightsSignature(dspy.Signature):
    """Generate insights and observations from a Plotly chart's metadata and statistics."""
    figure_metadata = dspy.InputField(desc="Structured metadata about the chart including type, axes, data statistics, and layout information")
    insights = dspy.OutputField(desc="Markdown-formatted insights describing key patterns, trends, observations, and notable data points from the chart")


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
    # Use word boundaries \b to ensure we only match 'data' or 'df' as complete variable names
    cleaned = re.sub(r'\b(data|df)\b\s*=\s*pd\.read_csv\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'\b(data|df)\b\s*=\s*pd\.read_[a-z]+\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'\b(data|df)\b\s*=\s*pd\.DataFrame\([^)]*\)', '# Data already loaded', cleaned)
    cleaned = re.sub(r'\b(data|df)\b\s*=\s*data\[[^\]]+\]', '# Data already loaded', cleaned)
    cleaned = re.sub(r'\bdf\b\s*=\s*data\.copy\(\)', '# df already exists', cleaned)
    cleaned = re.sub(r'\bdf\b\s*=\s*data\s*$', '# df already exists', cleaned, flags=re.MULTILINE)
    
    # Ensure code ends with 'fig' on its own line
    lines = cleaned.strip().split('\n')
    if lines and not lines[-1].strip() == 'fig':
        cleaned = cleaned.strip() + '\nfig'
    
    return cleaned.strip()


def extract_columns_from_code(code: str, available_columns: list = None) -> list:
    """
    Extract DataFrame column names used in Python/Plotly code.
    
    If available_columns is provided, only returns columns that exist in the DataFrame
    and appear in the code. This is the most reliable method.
    
    Args:
        code: The Python/Plotly code to analyze
        available_columns: List of actual column names from the DataFrame(s)
    
    Returns a list of unique column names found.
    """
    if not code:
        return []
    
    # If we have the actual column names, just check which ones appear in the code
    if available_columns:
        columns_used = []
        for col in available_columns:
            # Check if column name appears in the code (in quotes)
            # Match patterns like: ['column'], ["column"], 'column', "column"
            if f"'{col}'" in code or f'"{col}"' in code:
                columns_used.append(col)
        return columns_used
    
    # Fallback: regex-based extraction if no columns provided
    columns = set()
    
    # Pattern: df['column'] or df["column"] - bracket notation with quotes
    bracket_pattern = r"\[\s*['\"]([^'\"]+)['\"]\s*\]"
    columns.update(re.findall(bracket_pattern, code))
    
    # Filter out common non-column strings
    exclude = {'index', 'columns', 'values', 'axis', 'inplace', 'ascending', 'descending', 
               'left', 'right', 'inner', 'outer', 'on', 'how', 'sum', 'mean', 'count', 
               'min', 'max', 'std', 'var', 'first', 'last', 'nunique'}
    
    columns = [c for c in columns if c.lower() not in exclude and len(c) > 0 and len(c) < 50]
    
    return list(set(columns))


def plotly_chart_metric(example, pred, trace=None) -> float:
    """
    Simple code scorer that checks if Plotly code runs successfully.
    Penalizes code that tries to modify data or includes fig.show().
    Returns: float: Score (0.0=error, 1.0=success)
    """
    try:
        import re
        from .agents import clean_plotly_code  # safe import in context if needed

        # Extract generated code from pred - works for both chart generation and fixing
        # For chart generation: pred.plotly_code
        # For fixing: pred.fix
        generated_code = None
        if isinstance(pred, dict):
            generated_code = pred.get('plotly_code') 
        else:
            generated_code = getattr(pred, "plotly_code", None) 

        if not generated_code:
            return 0.0

        # Clean generated code
        generated_code = clean_plotly_code(str(generated_code))

        # Remove remaining fig.show() and display calls before running
        generated_code = re.sub(r'(fig\.show\s*\([^)]*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(\.show\s*\(\s*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(plotly\.io\.show\([^)]*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(pio\.show\([^)]*\))', r'# \1  # Commented out', generated_code)

        # Basic validation - must have some content
        if len(generated_code.strip()) < 10:
            return 0.0

        # Penalize any code that tries to read or modify dataframes/new data
        data_modification_patterns = [
            r'pd\.read_csv\s*\(',
            r'pd\.read_excel\s*\(',
            r'pd\.read_',
            r'pd\.DataFrame\s*\(',
            r'data\s*=\s*pd\.',
            r'df\s*=\s*pd\.',
            r'data\s*=\s*data\[', 
            r'df\s*=\s*data\s*$',
        ]
        for pattern in data_modification_patterns:
            if re.search(pattern, generated_code, re.MULTILINE | re.IGNORECASE):
                return 0.0

        # Prepare safe exec environment
        def noop_show(*args, **kwargs): pass
        def noop_display(*args, **kwargs): pass

        exec_globals = {
            'pd': pd,
            'np': np,
            'show': noop_show,
            'display': noop_display,
        }

        # Only import and inject 'go', 'plotly', and optionally 'px' if available, for test execution
        try:
            import plotly.graph_objects as go
            exec_globals['go'] = go
        except Exception:
            pass
        try:
            import plotly
            exec_globals['plotly'] = plotly
        except Exception:
            pass
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except Exception:
            pass

        # Get dataset from context variable (set by PlotlyVisualizationModule)
        dataset = _dataset_context.get()
        if dataset:
            # Use actual data from session - inject all sheets and set 'df' to first sheet
            sheet_names = list(dataset.keys())
            first_sheet_name = sheet_names[0]
            exec_globals['df'] = dataset[first_sheet_name]
            
            # Also make individual sheets accessible by name
            for sheet_name, sheet_df in dataset.items():
                # Use valid Python identifier (replace spaces, special chars)
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', sheet_name)
                exec_globals[safe_name] = sheet_df
        else:
            # Fallback to sample data if no dataset available (shouldn't happen in normal flow)
            exec_globals['df'] = pd.DataFrame({'a': [1, 2], 'b': [3, 4]})

        # Run the code
        exec(generated_code, exec_globals)

        # Check if 'fig' was created
        if 'fig' in exec_globals:
            return 1.0
        else:
            return 0.0  # No figure created
            
    except Exception as e:
        return 0.0 

def plotly_add_metric(example, pred, trace=None) -> float:
    """
    Simple code scorer that checks if Plotly code runs successfully.
    Penalizes code that tries to modify data or includes fig.show().
    Returns: float: Score (0.0=error, 1.0=success)
    """
    try:
        import re
        from .agents import clean_plotly_code  # safe import in context if needed

        # Extract generated code from pred - works for both chart generation and fixing
        # For chart generation: pred.plotly_code
        # For fixing: pred.fix
        generated_code = None
        if isinstance(pred, dict):
            generated_code = pred.get('chart_code') 
        else:
            generated_code = getattr(pred, "chart_code", None) 

        if not generated_code:
            return 0.0

        # Clean generated code
        generated_code = clean_plotly_code(str(generated_code))

        # Remove remaining fig.show() and display calls before running
        generated_code = re.sub(r'(fig\.show\s*\([^)]*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(\.show\s*\(\s*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(plotly\.io\.show\([^)]*\))', r'# \1  # Commented out', generated_code)
        generated_code = re.sub(r'(pio\.show\([^)]*\))', r'# \1  # Commented out', generated_code)

        # Basic validation - must have some content
        if len(generated_code.strip()) < 10:
            return 0.0

        # Penalize any code that tries to read or modify dataframes/new data
        data_modification_patterns = [
            r'pd\.read_csv\s*\(',
            r'pd\.read_excel\s*\(',
            r'pd\.read_',
            r'pd\.DataFrame\s*\(',
            r'data\s*=\s*pd\.',
            r'df\s*=\s*pd\.',
            r'data\s*=\s*data\[', 
            r'df\s*=\s*data\s*$',
        ]
        for pattern in data_modification_patterns:
            if re.search(pattern, generated_code, re.MULTILINE | re.IGNORECASE):
                return 0.0

        # Prepare safe exec environment
        def noop_show(*args, **kwargs): pass
        def noop_display(*args, **kwargs): pass

        exec_globals = {
            'pd': pd,
            'np': np,
            'show': noop_show,
            'display': noop_display,
        }

        # Only import and inject 'go', 'plotly', and optionally 'px' if available, for test execution
        try:
            import plotly.graph_objects as go
            exec_globals['go'] = go
        except Exception:
            pass
        try:
            import plotly
            exec_globals['plotly'] = plotly
        except Exception:
            pass
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except Exception:
            pass

        # Get dataset from context variable (set by PlotlyVisualizationModule)
        dataset = _dataset_context.get()
        if dataset:
            # Use actual data from session - inject all sheets and set 'df' to first sheet
            sheet_names = list(dataset.keys())
            first_sheet_name = sheet_names[0]
            exec_globals['df'] = dataset[first_sheet_name]
            
            # Also make individual sheets accessible by name
            for sheet_name, sheet_df in dataset.items():
                # Use valid Python identifier (replace spaces, special chars)
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', sheet_name)
                exec_globals[safe_name] = sheet_df
        else:
            # Fallback to sample data if no dataset available (shouldn't happen in normal flow)
            exec_globals['df'] = pd.DataFrame({'a': [1, 2], 'b': [3, 4]})

        # Run the code
        exec(generated_code, exec_globals)

        # Check if 'fig' was created
        if 'fig' in exec_globals:
            return 1.0
        else:
            return 0.0  # No figure created
            
    except Exception as e:
        return 0.0 


def analysis_code_metric(example, pred, trace=None) -> float:
    """
    Metric for pandas/numpy analysis code validation.
    Validates code runs without errors and doesn't include forbidden visualization libraries.
    Returns: float: Score (1.0=success, 0.0=failure)
    """
    try:
        # Extract code from pred
        code = None
        if isinstance(pred, dict):
            code = pred.get('code')
        else:
            code = getattr(pred, 'code', None)
        
        if not code:
            return 0.0
        
        code = str(code)
        
        # Check for forbidden visualization libraries
        forbidden = ['matplotlib', 'plotly', 'seaborn', 'bokeh', 'altair', 'holoviews', 'ggplot', 'pygal', 'dash', 'streamlit']
        for lib in forbidden:
            if re.search(rf'\bimport\s+{lib}\b|\bfrom\s+{lib}\b', code, re.IGNORECASE):
                return 0.0
        
        # Prepare safe exec environment
        exec_globals = {
            'pd': pd,
            'np': np,
            'json': json,
        }
        
        # Get dataset from context variable if available
        dataset = _dataset_context.get()
        if dataset:
            # Use actual data from session
            sheet_names = list(dataset.keys())
            first_sheet_name = sheet_names[0]
            exec_globals['df'] = dataset[first_sheet_name]
            exec_globals['data'] = dataset
            
            # Make individual sheets accessible by name
            for sheet_name, sheet_df in dataset.items():
                safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', sheet_name)
                exec_globals[safe_name] = sheet_df
        else:
            # Fallback to sample data
            exec_globals['df'] = pd.DataFrame({'a': [1, 2], 'b': [3, 4]})
        
        # Execute the code
        exec(code, exec_globals)
        
        # If we got here, code ran successfully
        return 1.0
        
    except Exception as e:
        return 0.0


# ============================================================================
# MAIN PLOTLY MODULE
# ============================================================================

class PlotlyVisualizationModule(dspy.Module):
    def __init__(self, user_id: int = None, dataset_id: str = None):
        self.styling_instructions = STYLING_INSTRUCTIONS
        self.planner = dspy.Predict(GenerateVisualizationPlan)
        self.N = 3
        self.user_id = user_id
        self.dataset_id = dataset_id
        self.dataset = None  # Will be loaded before forward pass
        self.chart_sigs = {
            'bar_chart': dspy.asyncify(dspy.Refine(dspy.Predict(bar_chart_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'line_chart': dspy.asyncify(dspy.Refine(dspy.Predict(line_chart_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'scatter_plot': dspy.asyncify(dspy.Refine(dspy.Predict(scatter_plot_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'histogram': dspy.asyncify(dspy.Refine(dspy.Predict(histogram_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'heatmap': dspy.asyncify(dspy.Refine(dspy.Predict(heatmap_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'box_plot': dspy.asyncify(dspy.Refine(dspy.Predict(box_plot_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'area_chart': dspy.asyncify(dspy.Refine(dspy.Predict(area_chart_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
            'kpi_card': dspy.asyncify(dspy.Refine(dspy.Predict(kpi_card_plotly), N=self.N, reward_fn=plotly_chart_metric, threshold=0.5)),
        }
        self.fail = FAIL_MESSAGE
    
    def _load_dataset(self):
        """Load dataset from dataset_service using user_id and dataset_id"""
        if self.user_id and self.dataset_id and not self.dataset:
            from .dataset_service import dataset_service
            self.dataset = dataset_service.get_dataset(self.user_id, self.dataset_id)
            if self.dataset:
                logger.info(f"Loaded dataset {self.dataset_id} for user {self.user_id} - {len(self.dataset)} sheet(s)")
            else:
                logger.warning(f"Could not load dataset {self.dataset_id} for user {self.user_id}")

    async def aforward(self, query, dataset_context):
        # Load dataset from dataset_service and set in context variable for metric function

        self._load_dataset()
        if self.dataset:
            _dataset_context.set(self.dataset)
            logger.info(f"Dataset loaded and set in context for metric evaluation")
        
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1400)):
            plan = self.planner(query=query, dataset_context=dataset_context)

        plan_output = plan.plan
        dashboard_title = plan.dashboard_title
        kpi_cards_enabled = getattr(plan, 'kpi_cards', False)

        if isinstance(plan_output, str):
            try:
                plan_output = json.loads(plan_output)
            except json.JSONDecodeError:
                logger.error("Failed to parse plan JSON: %s", plan.plan)
                return self.fail, None, "Unable to generate", []

        logger.info("GenerateVisualizationPlan result: %s", plan_output)
        
        # Extract dashboard title from plan
        dashboard_title = getattr(plan, 'dashboard_title', 'Dashboard Analysis')
        
        # Separate KPI cards and regular charts
        kpi_cards_specs = []
        chart_specs = []
        
        tasks = []
        kpi_tasks = []  # Separate list for KPI tasks
        chart_plans = {}  # Store individual chart plans by chart_type
        chart_types_order = []  # Track order of chart types
        kpi_plans = []  # Track KPI plans
        
        if 'False' in str(plan.relevant_query):
            # Query is relevant for visualization
            # Extract data_source info from plan
            data_source = plan_output.get('data_source', {'file_type': 'csv'})
            
            # Note: Filtering is handled by frontend UI, not on charts
            enhanced_context = dataset_context
            enhanced_context += "\n\nIMPORTANT: Do NOT add filter controls, dropdowns, or updatemenus to charts. Filtering is handled separately by the dashboard UI."
            
            # Handle KPI cards separately if enabled
            if kpi_cards_enabled or plan_output.get('kpi_cards'):
                kpi_cards_list = plan_output.get('kpi_cards', [])
                if not kpi_cards_list:
                    # Generate default KPIs if none specified (limit to 3)
                    kpi_cards_list = [
                        {"title": "Total Records", "metric": "count", "instructions": "Display total number of records"},
                        {"title": "Average Value", "metric": "mean", "instructions": "Display average of main numeric column"},
                        {"title": "Total Sum", "metric": "sum", "instructions": "Display sum of main numeric column"}
                    ]
                
                # Generate KPI cards (limit to 3)
                kpi_style = next(
                    (s['styling'] for s in self.styling_instructions if s.get('category') == 'kpi_cards'),
                    {}
                )
                
                for idx, kpi_spec in enumerate(kpi_cards_list[:3]):  # Limit to 3 KPIs
                    kpi_plan = {
                        'title': kpi_spec.get('title', f'KPI {idx + 1}'),
                        'instructions': kpi_spec.get('instructions', 'Display key metric'),
                        'metric': kpi_spec.get('metric', 'value')
                    }
                    kpi_plans.append(kpi_plan)
                    
                    kpi_tasks.append(self.chart_sigs['kpi_card'](
                        plan=kpi_plan,
                        dataset_context=enhanced_context,
                        styling=kpi_style
                    ))
            
            # Process regular charts (exclude kpi_card from regular processing)
            for chart_key in [k for k in self.chart_sigs.keys() if k != 'kpi_card']:
                if chart_key in plan_output:
                    # Find styling for this chart type
                    style = next(
                        (s['styling'] for s in self.styling_instructions if s.get('category') == chart_key + 's'),
                        {}
                    )
                    
                    try:
                        chart_plan = plan_output[chart_key]
                        chart_plans[chart_key] = chart_plan  # Store plan for this chart type
                        chart_types_order.append(chart_key)  # Track order
                    except Exception as e:
                        logger.error(f"Failed to extract chart plan for {chart_key}: {e}")
                        continue
                    
                    tasks.append(self.chart_sigs[chart_key](
                        plan=chart_plan,
                        dataset_context=enhanced_context,  # Use enhanced context
                        styling=style
                    ))
            
            if not tasks:
                # Default to bar chart if no specific type detected
                style = next(
                    (s['styling'] for s in self.styling_instructions if s.get('category') == 'bar_charts'),
                    {}
                )
                chart_key = 'bar_chart'
                chart_plans[chart_key] = plan_output  # Use full plan as fallback
                chart_types_order.append(chart_key)
                tasks.append(self.chart_sigs[chart_key](
                    plan=plan.plan,
                    dataset_context=dataset_context,
                    styling=style
                ))
            
            default_model = os.getenv("DEFAULT_MODEL", "").lower()
            if "anthropic" in default_model:
                provider = "ANTHROPIC"
            elif "openai" in default_model:
                provider = "OPENAI"
            elif "gemini" in default_model:
                provider = "GEMINI"
            else:
                provider = "UNKNOWN"
            # medium_lm = dspy.LM(default_model, max_tokens=2950,api_key=os.getenv(provider+'_API_KEY'), temperature=1, cache=False)

            # Execute KPI tasks and regular chart tasks separately
            kpi_results = await asyncio.gather(*kpi_tasks) if kpi_tasks else []
            chart_results = await asyncio.gather(*tasks)
            
            # Get all available column names from the dataset(s)
            available_columns = []
            if self.dataset:
                for sheet_name, sheet_df in self.dataset.items():
                    if hasattr(sheet_df, 'columns'):
                        available_columns.extend([str(col) for col in sheet_df.columns.tolist()])
                available_columns = list(set(available_columns))  # Remove duplicates
                logger.info(f"Available columns for filtering: {available_columns}")
            
            # Process KPI card results
            for i, r in enumerate(kpi_results):
                raw_code = getattr(r, 'plotly_code', str(r))
                cleaned = clean_plotly_code(raw_code)
                
                # Extract columns_used by checking which DataFrame columns appear in the code
                columns_used = extract_columns_from_code(cleaned, available_columns)
                
                kpi_plan = kpi_plans[i] if i < len(kpi_plans) else {}
                title = kpi_plan.get('title', f'KPI {i + 1}')
                
                kpi_cards_specs.append({
                    'chart_spec': cleaned,
                    'chart_type': 'kpi_card',
                    'title': title,
                    'chart_index': i,
                    'plan': kpi_plan,
                    'is_kpi': True,
                    'columns_used': columns_used
                })
                
                logger.info(f"KPI {i+1}: {title} - columns_used: {columns_used} - cleaned successfully")
            
            # Process regular chart results
            for i, r in enumerate(chart_results):
                raw_code = getattr(r, 'plotly_code', str(r))
                cleaned = clean_plotly_code(raw_code)
                
                # Extract columns_used by checking which DataFrame columns appear in the code
                columns_used = extract_columns_from_code(cleaned, available_columns)
                
                # Get chart type and title from the order we tracked
                chart_type = chart_types_order[i] if i < len(chart_types_order) else list(self.chart_sigs.keys())[min(i, len(self.chart_sigs) - 1)]
                title = "Visualization"
                
                # Get the plan for this specific chart
                chart_plan = chart_plans.get(chart_type, plan_output)
                
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
                    'chart_index': len(kpi_cards_specs) + i,  # Offset by KPI count
                    'plan': chart_plan,
                    'is_kpi': False,
                    'columns_used': columns_used
                })
                
                logger.info(f"Chart {i+1} ({chart_type}): {title} - columns_used: {columns_used} - cleaned successfully")
            
            logger.info(f"Generated {len(kpi_cards_specs)} KPI cards and {len(chart_specs)} charts")
            # Return tuple: (chart_specs, full_plan_output, dashboard_title, kpi_cards_specs)
            return chart_specs, plan_output, dashboard_title, kpi_cards_specs
        else:
            logger.info("Query not relevant for visualization. Returning FAIL_MESSAGE.")
            return self.fail + str(plan.relevant_query), None, "Unable to generate", []
