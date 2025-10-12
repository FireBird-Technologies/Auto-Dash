"""
DSPy-based Visualization Generation System
==========================================

This module uses DSPy to generate D3.js visualizations from natural language queries.
It includes a two-stage pipeline:
1. Planner: Converts user query to visualization plan
2. D3 Generator: Converts plan to executable D3.js code
"""

import dspy
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import json
import logging

# Set up logger for the module
logger = logging.getLogger("dspy_vis")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter('[%(asctime)s][%(levelname)s] %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)


# ============================================================================
# STYLING INSTRUCTIONS
# ============================================================================

STYLING_INSTRUCTIONS = [
    {
        "category": "line_charts",
        "description": "Used to visualize trends and changes over time, often with multiple series.",
        "styling": {
            "theme": "light",
            "axes": {
                "stroke_width": 0.2,
                "grid_stroke_width": 1,
                "grid_color": "#e0e0e0",
                "label_title_spacing": 14  # ensure good distance between axis labels and axis titles
            },
            "title": {
                "bold_html": True,
                "include": True
            },
            "colors": "use color scale (d3.schemeCategory10 or interpolated if >10 lines)",
            "annotations": ["min", "max"],
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,   # ENSURE M, K, B shown and never commas
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True},
                "zoom": {"enabled": True, "pan": True}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900,
                "margin": {"top": 50, "right": 50, "bottom": 50, "left": 60}
            }
        }
    },
    {
        "category": "bar_charts",
        "description": "Useful for comparing discrete categories or groups with bars representing values.",
        "styling": {
            "theme": "light",
            "axes": {
                "stroke_width": 0.2,
                "grid_stroke_width": 1,
                "label_title_spacing": 14
            },
            "title": {"bold_html": True, "include": True},
            "annotations": ["bar values"],
            "bar_style": {"padding": 0.1, "corner_radius": 3},
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True, "highlight_color": "#ff6b6b"},
                "click": {"enabled": True, "action": "show_details"}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },
    {
        "category": "histograms",
        "description": "Display the distribution of a data set, useful for returns or frequency distributions.",
        "styling": {
            "theme": "light",
            "bin_count": 50,
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1, "label_title_spacing": 14},
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "bar_style": {"opacity": 0.8, "corner_radius": 2},
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },
    {
        "category": "scatter_plots",
        "description": "Show relationships between two numerical variables with points.",
        "styling": {
            "theme": "light",
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1, "label_title_spacing": 14},
            "title": {"bold_html": True, "include": True},
            "point_style": {"radius": 4, "opacity": 0.6},
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True},
                "zoom": {"enabled": True, "pan": True},
                "brush": {"enabled": True}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },
    {
        "category": "pie_charts",
        "description": "Show composition or parts of a whole with slices representing categories.",
        "styling": {
            "theme": "light",
            "top_categories_to_show": 10,
            "bundle_rest_as": "Others",
            "title": {"bold_html": True, "include": True},
            "pie_style": {
                "inner_radius_ratio": 0.0,
                "pad_angle": 0.02
            },
            "annotations": ["percentage labels"],
            "color_scheme": "d3.schemeCategory10",
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True, "highlight": True}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 700
            }
        }
    },
    {
        "category": "tabular_and_generic_charts",
        "description": "Applies to charts where number formatting needs flexibility, including mixed or raw data.",
        "styling": {
            "theme": "light",
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1, "label_title_spacing": 14},
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "number_format": {
                "use_abbreviations": True,
                "kmb_only": True,
                "apply_k_m_b": True,
                "thresholds": {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000},
                "always_abbreviate": True,
                "never_use_commas": True,
                "exclude_if_commas_present": True,
                "exclude_if_not_numeric": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },
    {
        "category": "heat_maps",
        "description": "Show data density or intensity using color scales on a matrix or grid.",
        "styling": {
            "theme": "light",
            "axes": {
                "stroke_color": "black",
                "stroke_width": 0.2,
                "grid_stroke_width": 1,
                "label_title_spacing": 14
            },
            "color_scale": "d3.interpolateViridis",
            "title": {"bold_html": True, "include": True},
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },
    {
        "category": "histogram_distribution",
        "description": "Specialized histogram for return distributions with opacity control.",
        "styling": {
            "theme": "light",
            "bar_style": {"opacity": 0.75},
            "axes": {
                "grid_stroke_width": 1,
                "label_title_spacing": 14
            },
            "title": {"bold_html": True, "include": True},
            "svg_defaults": {
                "height": 500,
                "width": "100%",
                "max_width": 900
            }
        }
    },

    {
        "category": "chord",
        "description": "Chord diagrams - show inter-relationships between entities in a circular layout.",
        "styling": {
            "theme": "light",
            "chord_style": {"pad_angle": 0.03, "inner_radius_ratio": 0.7},
            "color_scheme": "d3.schemeCategory10",
            "annotations": ["group labels", "flow values"],
            "title": {"bold_html": True, "include": True},
            "interactivity": {"hover": {"enabled": True, "show_tooltip": True}},
            "svg_defaults": {"height": 550, "width": "100%", "max_width": 650}
        }
    },
    {
        "category": "d3graph",
        "description": "Generic D3 force-directed network graph to visualize nodes and edges (networks).",
        "styling": {
            "theme": "light",
            "node_style": {"radius": 7, "color": "#FF6D00"},
            "edge_style": {"width": 1, "color": "#bbb"},
            "force_strength": 0.07,
            "title": {"bold_html": True, "include": True},
            "interactivity": {
                "drag": {"enabled": True},
                "zoom": {"enabled": True}
            },
            "svg_defaults": {"height": 580, "width": "100%", "max_width": 900}
        }
    },

    {
        "category": "sankey",
        "description": "Sankey diagram showing flow magnitudes between nodes using links of varying thickness.",
        "styling": {
            "theme": "light",
            "node_width": 18,
            "node_padding": 10,
            "color_scheme": "d3.schemeCategory10",
            "title": {"bold_html": True, "include": True},
            "annotations": ["flow values", "labels"],
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {"height": 580, "width": "100%", "max_width": 950}
        }
    },
    {
        "category": "matrix",
        "description": "Matrix visualizations (e.g., adjacency matrix or correlation heatmap).",
        "styling": {
            "theme": "light",
            "cell_style": {"border": "1px solid #ccc", "size": 35},
            "color_scale": "d3.interpolateRdBu",
            "annotations": ["values inside cells"],
            "title": {"bold_html": True, "include": True},
            "svg_defaults": {"height": 600, "width": "100%", "max_width": 1000}
        }
    },
    
    {
        "category": "violin",
        "description": "Violin plots visualize data distributions, combining box plot and density trace.",
        "styling": {
            "theme": "light",
            "violin_style": {"width": 75, "color": "#8e24aa", "opacity": 0.8},
            "axes": {"stroke_width": 0.18, "grid_stroke_width": 1, "grid_color": "#eee", "label_title_spacing": 14},
            "title": {"bold_html": True, "include": True},
            "annotations": ["median", "quartiles"],
            "interactivity": {"hover": {"enabled": True, "show_tooltip": True}},
            "svg_defaults": {"height": 500, "width": "100%", "max_width": 700}
        }
    },

    {
        "category": "treemap",
        "description": "Treemap visualization to display hierarchical data using nested rectangles.",
        "styling": {
            "theme": "light",
            "rect_style": {"padding": 2, "corner_radius": 2},
            "color_scheme": "d3.interpolateCool",
            "title": {"bold_html": True, "include": True},
            "annotations": ["labels", "values"],
            "svg_defaults": {"height": 500, "width": "100%", "max_width": 900}
        }
    },
    {
        "category": "tree",
        "description": "Tree diagrams - node-link or radial layout for hierarchical data.",
        "styling": {
            "theme": "light",
            "node_style": {"radius": 5, "color": "#43A047"},
            "link_style": {"width": 1.2, "color": "#bdbdbd"},
            "title": {"bold_html": True, "include": True},
            "interactivity": {
                "collapse_expand": {"enabled": True},
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {"height": 620, "width": "100%", "max_width": 950}
        }
    },

    {
        "category": "maps",
        "description": "Geographic map, choropleth or point-based for spatial visualizations.",
        "styling": {
            "theme": "light",
            "map_style": {"projection": "geoMercator"},
            "color_scale": "d3.interpolateViridis",
            "point_style": {"radius": 5, "color": "#d84315"},
            "title": {"bold_html": True, "include": True},
            "interactivity": {
                "zoom": {"enabled": True, "pan": True},
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {"height": 520, "width": "100%", "max_width": 950}
        }
    }
]


# ============================================================================
# DSPY SIGNATURES
# ============================================================================



class GenerateVisualizationPlan(dspy.Signature):
    """
    Generate a visualization or analytical plan from a natural language query.
    The plan should include the reasoning steps and the names of charts
    (chosen from known chart types).
    Make the plan as concise as possible only 3-4 lines
    """

    query = dspy.InputField(
        desc="User's natural language query or instruction, e.g., 'Compare monthly revenue trends across regions.'"
    )
    dataset_context = dspy.InputField(desc="Dataset information, columns, types, sample data, statistics")
    
    plan = dspy.OutputField(
        desc=(
            "Step-by-step plan describing what to compute or visualize, "
            "including which chart types to use. "
            "Chart names must be chosen from: "
            "[line_charts, bar_charts, histograms,chords, scatter_plots, treemaps, "
            "sankey, heat_maps,d3graphs histogram_distribution]."
            "but only choose as much as needed don't repeat charts"
        )
    )

    relevant_query = dspy.OutputField(
        desc="Boolean flag — True if the query is NOT about visualizations, dashboarding, design, data analysis etc. False if it IS relevant.",
        type=bool
    )
    
    chart_type = dspy.OutputField(
        desc="Primary chart type from the list above"
    )


class fix_d3(dspy.Signature):
    """"""
    d3_code = dspy.InputField(desc="The error based d3 code")
    error = dspy.InputField(desc="The error generated by the system")
    fix = dspy.OutputField(desc="The fixed code that can run")

class CreateDatasetContext(dspy.Signature):
    """
    DSPy signature to generate dataset context for visualization tasks.
    The dataset context should describe columns, types, sample values, and relevant statistics.
    """

    dataframe_info = dspy.InputField(
        desc="Information about the pandas DataFrame: column names, types, and optionally some samples/statistics."
    )

    dataset_context = dspy.OutputField(
        desc="A textual or structured summary describing the columns, their data types, sample values, value ranges, and any key statistics that help downstream modules reason about what visualizations are possible."
    )






# ============================================================================
# FAILURE MESSAGE
# ============================================================================

FAIL_MESSAGE = """// D3.js: No visualization generated.
// Reason: The query was not about analysis/visualization or the data is invalid.
d3.select("body")
  .append("div")
  .style("color", "red")
  .style("font-size", "1.2em")
  .style("margin", "2em")
  .text("No visualization generated: The query was not about analysis/visualization or the data is invalid.");"""


# ============================================================================
# MAIN D3 MODULE
# ============================================================================

class plan_to_d3(dspy.Signature):
    """Generate D3.js visualization code that uses data passed as a parameter.
    
    CRITICAL REQUIREMENTS:
    1. The data is already available as a JavaScript array called 'data'
    2. DO NOT use d3.csv(), d3.json(), or any data loading methods
    3. DO NOT use d3.select("body") - ALWAYS use d3.select("#visualization") as the root container
    4. Use D3 v7 CORE LIBRARY ONLY - NO external plugins (d3.regressionLinear, d3.sankey, d3.hexbin, d3-regression, etc.)
    5. For regression/trendlines, use manual calculations or d3.line() with computed slope/intercept
    6. Use D3 v7 syntax (d3.group, d3.rollup instead of d3.nest)
    7. The container div with id="visualization" is already created for you
    
    AVAILABLE D3 FUNCTIONS (core only):
    - Scales: d3.scaleLinear, d3.scaleOrdinal, d3.scaleBand, d3.scaleTime, d3.scaleLog
    - Shapes: d3.line, d3.area, d3.arc, d3.pie, d3.symbol
    - Arrays: d3.group, d3.rollup, d3.mean, d3.sum, d3.extent, d3.min, d3.max, d3.median
    - Axes: d3.axisBottom, d3.axisLeft, d3.axisRight, d3.axisTop
    - Colors: d3.schemeCategory10, d3.interpolateViridis, d3.scaleOrdinal
    
    Example start of D3 code:
    // Data is already available as 'data' parameter
    // Select the provided container
    const container = d3.select("#visualization");
    
    // Create your visualization
    const svg = container.append("svg")
        .attr("width", 800)
        .attr("height", 600);
    
    // For trendlines, calculate manually:
    // const xMean = d3.mean(data, d => d.x);
    // const yMean = d3.mean(data, d => d.y);
    // const slope = d3.sum(data, d => (d.x - xMean) * (d.y - yMean)) / d3.sum(data, d => (d.x - xMean) ** 2);
    // const intercept = yMean - slope * xMean;
    
    Ensure the visualization is interactive with buttons, legends axis controls etc
    Make the chart modern sleek
    """
    plan = dspy.InputField(desc="Planner instructions around what they want to visualize")
    dataset_context = dspy.InputField(desc="Information about the dataset, columns, stats")
    styling_instructions = dspy.InputField(desc="Styling instructions for the charts / dashboard")
    d3_js_code = dspy.OutputField(desc="Complete D3.js code that: 1) Uses the 'data' variable (already available), 2) MUST use d3.select('#visualization') NOT d3.select('body'), 3) Uses ONLY D3 v7 core library - NO external plugins (d3.regressionLinear, d3.sankey, etc.), 4) NO data loading code, 5) For trendlines calculate slope/intercept manually")

class D3VisualizationModule(dspy.Module):
    def __init__(self):
        self.styling_instructions = STYLING_INSTRUCTIONS
        self.planner = dspy.Predict(GenerateVisualizationPlan)
        self.plan_to_d3_sign = dspy.Predict(plan_to_d3)
        self.fail = FAIL_MESSAGE

    async def aforward(self, query, dataset_context):
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1200 )):
            plan = self.planner(query=query, dataset_context=dataset_context)

        logger.info("GenerateVisualizationPlan result: %s", plan.plan)
        # logger.info("DSPy inspect_history:\n%s", dspy.inspect_history(n=1))

        if 'False' in str(plan.relevant_query):
            styling = []
            for c in self.styling_instructions:
                if c.get("category") in plan.plan:
                    styling.append(c)
            d3_code = self.plan_to_d3_sign(
                plan=plan.plan,
                dataset_context=dataset_context,
                styling_instructions=str(styling)
            )

            logger.info("plan_to_d3 result: %s", d3_code)
            # logger.info("DSPy inspect_history after plan_to_d3 (last 3):\n%s", "\n"+ dspy.inspect_history(n=1))
            return d3_code.d3_js_code
        else:
            logger.info("Query found not relevant for visualization. Returning FAIL_MESSAGE.")
            return self.fail

