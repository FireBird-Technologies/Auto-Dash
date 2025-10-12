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
    Generate a structured visualization plan from a natural language query.
    Output a JSON dictionary where keys are chart types and values contain chart specifications.
    
    Format: {
      "bar_chart": {"title": "Chart Title", "instructions": "Specific D3 instructions"},
      "line_chart": {"title": "Another Chart", "instructions": "More instructions"},
      ...
    }
    
    Available chart types: bar_chart, line_chart, scatter_plot, treemap, heatmap, histogram, sankey, chord_diagram, area_chart, boxplot
    
    Use the color theme for data points only, not for chart backgrounds.
    Keep instructions short (2-3 lines per chart).
    Include only essential charts—avoid redundant ones (but you may use multiple charts if needed).
    """

    query = dspy.InputField(
        desc="User's natural language query or instruction, e.g., 'Compare monthly revenue trends across regions.'"
    )
    dataset_context = dspy.InputField(desc="Dataset information, columns, types, sample data, statistics")
    
    plan = dspy.OutputField(
        desc=(
            "JSON dictionary where keys are chart_types (bar_chart, line_chart, scatter_plot, heatmap, histogram, sankey, chord_diagram, area_chart, boxplot, treemap) "
            'and values are objects with {"title": "Descriptive Chart Title", "instructions": "Specific D3 aggregation and visualization instructions"}. '
            'Example: {"bar_chart": {"title": "Revenue by Region", "instructions": "Use d3.rollup to sum revenue by region. Sort bars descending. Add hover tooltips."}, '
            '"line_chart": {"title": "Sales Trend", "instructions": "Group by month. Show multi-line with legend. Add area fill."}}'
        ),
        type=dict
    )

    relevant_query = dspy.OutputField(
        desc="Boolean flag — True if the query is NOT about visualizations, dashboarding, design, data analysis etc. False if it IS relevant.",
        type=bool
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
    in json but keep it concise
    Make the dataset_context as concise as possible to deliver insights quickly!
    """

    dataframe_info = dspy.InputField(
        desc="Information about the pandas DataFrame: column names, types, and optionally some samples/statistics."
    )

    dataset_context = dspy.OutputField(
        desc="A json like str with the columns, their data types, sample values, value ranges, and any key statistics that help downstream modules reason about what visualizations are possible."
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

# Common D3.js documentation for all chart types
COMMON_D3_DOCS = """
🚨🚨🚨 CRITICAL OUTPUT FORMAT - READ CAREFULLY 🚨🚨🚨

FORBIDDEN - DO NOT INCLUDE:
❌ HTML tags (<!DOCTYPE>, <html>, <head>, <body>, <script>, <style>)
❌ Markdown code blocks (```javascript, ```)
❌ Data loading (d3.csv, d3.json, fetch, d3.tsv)
❌ .then(), .catch(), .finally() callbacks
❌ Promises or async/await patterns
❌ Functions that wrap data loading: "function(data) {" at the top level
❌ References to #chart-container (ONLY #visualization exists!)
❌ Comments like "// In a real application" or "// Sample data"
❌ Stray closing braces }); at the end
❌ Incomplete lines ending with .attr( or similar

✅ REQUIRED FORMAT:
// Your code starts like this:
const margin = {top: 60, right: 30, bottom: 70, left: 60};
const svg = d3.select("#visualization").append("svg")...

// Data is ALREADY available as 'data' parameter - use it directly:
const processedData = data.filter(d => d.value > 0);

REQUIREMENTS:
1. Data parameter 'data' is already loaded - use it immediately. No need for d3.csv, d3.json, data is LOADED NO SAMPLE DATA NEEDED
2. ONLY select "#visualization" (no other IDs exist)
3. Use D3 v7 syntax (d3.group, d3.rollup not d3.nest)
4. Complete, immediately-executable code
5. No wrapper functions expecting async data

⚠️ VARIABLE NAMING:
- Use const/let with descriptive names (barChartSvg, lineChartX)
- Avoid generic names like 'svg', 'x', 'y' if possible

AGGREGATIONS:
- d3.sum/mean/median/min/max(data, d => d.value)
- d3.group(data, d => d.category) - returns Map
- d3.rollup(data, agg_func, d => d.key)

SCALES: scaleLinear, scaleBand, scaleTime, scaleLog, scaleOrdinal
COLORS: schemeCategory10, interpolateViridis, scaleOrdinal
"""




class bar_chart_d3(dspy.Signature):
    """Generate PURE JAVASCRIPT D3.js bar chart code - NO HTML!
    
    Bar charts are ideal for: comparing categories, showing distributions, ranking items.
    
    CRITICAL: Return ONLY JavaScript code starting with d3.select("#visualization")
    DO NOT include: HTML tags, <script>, <style>, <!DOCTYPE>, markdown, data loading
    DO NOT wrap in: .then(), .catch(), callbacks expecting data loading
    DO NOT reference: #chart-container or other non-existent elements (only #visualization exists)
    
    The 'data' parameter is ALREADY AVAILABLE - just use it directly!
    
    Best practices:
    - Use d3.scaleBand() for categorical x-axis
    - Use d3.scaleLinear() for y-axis
    - Add transitions: .transition().duration(750)
    - Include sorting options (by value, alphabetically)
    - Add value labels on bars
    - Enable click/hover interactions
    
    Example START of output:
    d3.select("#visualization").html("");
    const margin = {top: 40, right: 30, bottom: 60, left: 70};
    const svg = d3.select("#visualization").append("svg")...
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for bar chart")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags")


class line_chart_d3(dspy.Signature):
    """Generate D3.js LINE CHART code.
    
    Line charts are ideal for: time series, trends, continuous data, comparing multiple series.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Use d3.scaleTime() or scaleLinear() for x-axis
    - Use d3.scaleLinear() for y-axis
    - Use d3.line() path generator
    - Add area fill below line with d3.area()
    - Include grid lines for readability
    - Add dot markers at data points
    - Support multiple lines with legend
    - Add crosshair/tooltip on hover
    - Calculate trendlines manually if needed:
      slope = Σ((x-x̄)(y-ȳ)) / Σ((x-x̄)²)
    
    Example structure:
    const line = d3.line().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX);
    svg.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", "steelblue");
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for line chart")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class scatter_plot_d3(dspy.Signature):
    """Generate D3.js SCATTER PLOT code.
    
    Scatter plots are ideal for: correlations, distributions, clusters, outliers.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Use d3.scaleLinear() for both axes
    - Size and color dots by additional dimensions
    - Add regression/trend line with manual calculation
    - Enable brush selection for zooming
    - Show correlation coefficient (r²) if requested
    - Add jitter for overlapping points
    - Include quadrant lines if meaningful
    - Support 3rd dimension via size/color
    
    Regression calculation:
    const xMean = d3.mean(data, d => d.x);
    const yMean = d3.mean(data, d => d.y);
    const slope = d3.sum(data, d => (d.x - xMean) * (d.y - yMean)) / d3.sum(data, d => (d.x - xMean) ** 2);
    const intercept = yMean - slope * xMean;
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for scatter plot")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")



class heatmap_d3(dspy.Signature):
    """Generate D3.js HEATMAP code.
    
    Heatmaps are ideal for: matrices, correlations, time patterns, density visualization.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Use d3.scaleBand() for both x and y axes
    - Use d3.scaleSequential() with interpolateViridis for colors
    - Add color legend/scale
    - Show values on hover or in cells
    - Sort rows/columns intelligently
    - Add clustering if requested
    - Include zoom for large matrices
    
    Example structure:
    const x = d3.scaleBand().domain(columns).range([0, width]);
    const y = d3.scaleBand().domain(rows).range([0, height]);
    const color = d3.scaleSequential(d3.interpolateViridis).domain([min, max]);
    svg.selectAll("rect").data(data).enter().append("rect").attr("fill", d => color(d.value));
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for heatmap")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class histogram_d3(dspy.Signature):
    """Generate D3.js HISTOGRAM code.
    
    Histograms are ideal for: distributions, frequency analysis, normal curves.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Use d3.histogram() to bin data
    - Use d3.scaleLinear() for both axes
    - Add bin size control slider
    - Show distribution statistics (mean, median, std dev)
    - Add normal curve overlay if appropriate
    - Include cumulative frequency option
    - Show percentile lines
    
    Example structure:
    const histogram = d3.histogram().domain(x.domain()).thresholds(x.ticks(20));
    const bins = histogram(data.map(d => d.value));
    svg.selectAll("rect").data(bins).enter().append("rect").attr("height", d => y(d.length));
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for histogram")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class sankey_d3(dspy.Signature):
    """Generate D3.js SANKEY DIAGRAM code.
    
    Sankey diagrams are ideal for: flow analysis, process visualization, network flows.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    IMPORTANT: Build sankey layout manually - NO d3-sankey plugin!
    
    Manual implementation:
    1. Create nodes array: [{id, name}, ...]
    2. Create links array: [{source, target, value}, ...]
    3. Calculate node positions and heights based on total flow
    4. Use d3.line() or paths for curved links
    
    Best practices:
    - Sort nodes by total flow
    - Use color to show flow direction or categories
    - Add hover to highlight connected nodes
    - Show flow values on links
    - Implement drag-and-drop for nodes
    
    Simple implementation:
    // Calculate node positions
    nodes.forEach((n, i) => { n.x = i * (width / nodes.length); n.y = height / 2; });
    // Draw curved paths between nodes
    const link = d3.linkHorizontal().x(d => d.x).y(d => d.y);
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for sankey diagram")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class chord_diagram_d3(dspy.Signature):
    """Generate D3.js CHORD DIAGRAM code.
    
    Chord diagrams are ideal for: relationships, connections, circular flow between entities.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    
    Best practices:
    - Use d3.chord() layout (this IS in D3 core)
    - Use d3.ribbon() for arcs between nodes
    - Color by source or target
    - Add labels around circle
    - Show relationship strength on hover
    - Include filtering by threshold
    
    Example structure:
    const chord = d3.chord().padAngle(0.05).sortSubgroups(d3.descending);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon().radius(innerRadius);
    const chords = chord(matrix);
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for chord diagram")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class area_chart_d3(dspy.Signature):
    """Generate D3.js AREA CHART code.
    
    Area charts are ideal for: cumulative totals, stacked comparisons, showing magnitude over time.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Use d3.area() generator
    - Support stacked areas with d3.stack()
    - Add gradient fills for visual appeal
    - Include baseline (y=0) clearly
    - Support stream graph variant
    - Enable series toggle (show/hide)
    - Add smooth curves with curve functions
    
    Example structure:
    const area = d3.area().x(d => x(d.date)).y0(height).y1(d => y(d.value)).curve(d3.curveMonotoneX);
    svg.append("path").datum(data).attr("d", area).attr("fill", "steelblue").attr("opacity", 0.7);
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for area chart")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


class boxplot_d3(dspy.Signature):
    """Generate D3.js BOX PLOT code.
    
    Box plots are ideal for: statistical distributions, quartiles, outliers, comparing groups.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Best practices:
    - Calculate Q1, Q2 (median), Q3, IQR manually
    - Use d3.quantile() for percentiles
    - Mark outliers (> 1.5 * IQR)
    - Add mean marker (diamond)
    - Support violin plot overlay option
    - Show individual data points on hover
    - Enable comparison across categories
    
    Calculations:
    const sorted = data.sort(d3.ascending);
    const q1 = d3.quantile(sorted, 0.25);
    const median = d3.quantile(sorted, 0.5);
    const q3 = d3.quantile(sorted, 0.75);
    const iqr = q3 - q1;
    """ + COMMON_D3_DOCS
    
    plan = dspy.InputField(desc="User requirements for box plot")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")

class treemap_d3(dspy.Signature):
    """Generate D3.js TREEMAP code.
    Data is available as 'data' parameter - DO NOT load data, NO SAMPLE DATA NEEDED
    Treemaps are ideal for: hierarchical data, visualizing proportions/part-to-whole, grouped categories, packs of rectangles.

    Best practices:
    - Use d3.hierarchy() to build data structure from flat or nested input
    - Use d3.treemap() layout to size rectangles by value
    - Represent hierarchy via nesting and rectangles
    - Optionally support zoomable treemaps
    - Encode color by category or numerical variable
    - Show tooltips with value, path, and percent of total
    - Add labels with text truncation (fit to rectangles)
    - Allow adjustable padding between tiles

    Example steps:
    const root = d3.hierarchy(data).sum(d => d.value);
    d3.treemap().size([width, height]).padding(1)(root);
    svg.selectAll("rect")
        .data(root.leaves())
        .enter().append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        // styling/fill as needed;
    """ + COMMON_D3_DOCS

    plan = dspy.InputField(desc="User requirements for treemap")
    styling = dspy.InputField(desc="Chart styling")
    dataset_context = dspy.InputField(desc="Dataset columns and stats")
    d3_js_code = dspy.OutputField(desc="Pure JavaScript D3.js code ONLY - no HTML, no markdown, no script tags, start with d3.select")


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def wrap_in_iife(code: str) -> str:
    """
    Wrap D3 code in an IIFE (Immediately Invoked Function Expression) to avoid variable conflicts.
    This allows multiple charts to coexist without variable name collisions.
    """
    if not code or not code.strip():
        return code
    
    # Check if already wrapped in IIFE
    stripped = code.strip()
    if stripped.startswith('(function()') or stripped.startswith('(async function()'):
        return code
    
    # Wrap in IIFE with async support if needed
    wrapped = f"""(function() {{
{code}
}})();"""
    
    return wrapped


def clean_d3_code(code: str) -> str:
    """
    Clean D3 code by removing HTML wrappers, markdown formatting, and other artifacts.
    Returns pure JavaScript D3 code.
    """
    if not code:
        return code
    
    cleaned = code.strip()
    
    # Remove markdown code blocks
    if cleaned.startswith('```javascript'):
        cleaned = cleaned.replace('```javascript', '', 1)
    elif cleaned.startswith('```js'):
        cleaned = cleaned.replace('```js', '', 1)
    elif cleaned.startswith('```'):
        cleaned = cleaned.replace('```', '', 1)
    
    if cleaned.endswith('```'):
        cleaned = cleaned.rsplit('```', 1)[0]
    
    # Remove any remaining markdown artifacts
    cleaned = cleaned.replace('```', '')
    
    # Check if it contains HTML document structure
    if '<!DOCTYPE' in cleaned or '<html' in cleaned.lower():
        logger.warning("Detected HTML document in D3 code output. Attempting to extract JavaScript...")
        
        # Try to extract JavaScript from <script> tags
        script_pattern = r'<script[^>]*>(.*?)</script>'
        scripts = re.findall(script_pattern, cleaned, re.DOTALL | re.IGNORECASE)
        
        if scripts:
            # Join all script contents
            cleaned = '\n\n'.join(scripts)
            logger.info("Extracted JavaScript from <script> tags")
        else:
            # If no script tags found, try to find code after certain markers
            # Look for code that starts with d3.select or const/let/var
            lines = cleaned.split('\n')
            js_lines = []
            in_script = False
            
            for line in lines:
                stripped = line.strip()
                # Start collecting when we see JavaScript-like code
                if not in_script and (
                    stripped.startswith('d3.') or 
                    stripped.startswith('const ') or 
                    stripped.startswith('let ') or 
                    stripped.startswith('var ') or
                    stripped.startswith('function ')
                ):
                    in_script = True
                
                # Stop collecting when we hit closing HTML tags
                if in_script and (
                    stripped.startswith('</script>') or 
                    stripped.startswith('</body>') or
                    stripped.startswith('</html>')
                ):
                    break
                
                if in_script:
                    js_lines.append(line)
            
            if js_lines:
                cleaned = '\n'.join(js_lines)
                logger.info("Extracted JavaScript from HTML body")
            else:
                logger.error("Could not extract JavaScript from HTML document")
    
    # Remove common HTML artifacts that might remain
    html_artifacts = [
        '<!DOCTYPE html>',
        '<html>',
        '</html>',
        '<head>',
        '</head>',
        '<body>',
        '</body>',
        '<style>',
        '</style>',
    ]
    
    for artifact in html_artifacts:
        if artifact in cleaned:
            cleaned = cleaned.replace(artifact, '')
            logger.info(f"Removed HTML artifact: {artifact}")
    
    # Remove leading/trailing whitespace again
    cleaned = cleaned.strip()
    
    # Remove problematic patterns that indicate incomplete/malformed code
    problematic_patterns = [
        # Catch blocks without try (more aggressive)
        r'\}\s*\)\s*\.catch\s*\([^)]*\)\s*\{.*?\}\s*\)?\s*;?\s*$',
        # Just .catch at the end
        r'\)\s*\.catch\s*\([^)]*\)\s*\{[^}]*\}\s*\)?\s*;?\s*$',
        # Stray }); pattern
        r'createChart\(data\);\s*\}\)\s*\.catch',
    ]
    
    for pattern in problematic_patterns:
        match = re.search(pattern, cleaned, re.MULTILINE | re.DOTALL)
        if match:
            logger.warning(f"Removing problematic pattern: {match.group()[:100]}...")
            cleaned = cleaned[:match.start()].rstrip()
            # Add proper closing if needed
            if 'createChart(data)' in cleaned and not cleaned.rstrip().endswith(';'):
                cleaned = cleaned.rstrip() + '\n  createChart(data);\n}'
    
    # Remove references to #chart-container (wrong ID)
    if '#chart-container' in cleaned:
        logger.warning("Found #chart-container - replacing with #visualization")
        cleaned = cleaned.replace('#chart-container', '#visualization')
        cleaned = cleaned.replace('"#chart-container"', '"#visualization"')
        cleaned = cleaned.replace("'#chart-container'", "'#visualization'")
    
    # Remove incomplete lines at the end (lines that end with dots or open calls)
    lines = cleaned.split('\n')
    while lines:
        last_line = lines[-1].strip()
        # Check if line is incomplete
        if (last_line.endswith('.') or 
            last_line.endswith('(') or
            last_line.endswith(',') or
            last_line.startswith('.') and not last_line.endswith(';') and not last_line.endswith('}')):
            logger.info(f"Removing incomplete line: {last_line}")
            lines = lines[:-1]
        else:
            break
    
    cleaned = '\n'.join(lines)
    
    # Remove stray closing braces/parentheses at the end (common LLM artifact)
    lines = cleaned.split('\n')
    while lines and lines[-1].strip() in ['});', '};', '}', ');', ']);', '})']:
        # Check if this is likely a stray closing
        remaining = '\n'.join(lines[:-1])
        open_braces = remaining.count('{')
        close_braces = remaining.count('}')
        open_parens = remaining.count('(')
        close_parens = remaining.count(')')
        
        # If removing this line would balance things better, remove it
        line_to_check = lines[-1].strip()
        if line_to_check in ['});', '};', '}', '})']:
            if close_braces >= open_braces:
                logger.info(f"Removing stray closing brace: {line_to_check}")
                lines = lines[:-1]
            else:
                break
        elif line_to_check in [');', ']);']:
            if close_parens >= open_parens:
                logger.info(f"Removing stray closing parenthesis: {line_to_check}")
                lines = lines[:-1]
            else:
                break
        else:
            break
    
    cleaned = '\n'.join(lines).strip()
    
    # Final validation: ensure code ends properly
    # Look for the last complete statement and cut off anything after
    if cleaned:
        # Find last occurrence of common ending patterns
        last_good_endings = [
            cleaned.rfind('});'),
            cleaned.rfind('};'),
            cleaned.rfind('.remove();'),
            cleaned.rfind('.text('),
        ]
        
        # Get the maximum valid ending position
        last_valid_pos = max(last_good_endings)
        
        if last_valid_pos > 0:
            # Check if there's garbage after the last good ending
            potential_garbage = cleaned[last_valid_pos + 3:].strip()
            
            # If there's content after and it's not a complete statement, remove it
            if potential_garbage and len(potential_garbage) < 100:
                # Check if it's incomplete (common patterns)
                if (potential_garbage.startswith('.attr') or
                    potential_garbage.count('(') > potential_garbage.count(')') or
                    potential_garbage.count('{') > potential_garbage.count('}')):
                    logger.warning(f"Removing garbage at end: {potential_garbage[:50]}...")
                    # Find the proper end including the semicolon
                    if cleaned[last_valid_pos:last_valid_pos+3] == '});':
                        cleaned = cleaned[:last_valid_pos + 3]
                    elif cleaned[last_valid_pos:last_valid_pos+2] == '};':
                        cleaned = cleaned[:last_valid_pos + 2]
                    else:
                        cleaned = cleaned[:last_valid_pos + 1]
    
    # Validate that we have something that looks like D3 code
    if cleaned and not any(marker in cleaned for marker in ['d3.', 'select(', 'data(', 'append(']):
        logger.warning("Cleaned code doesn't appear to contain D3.js code")
    
    return cleaned


# Keep original as fallback for unspecified chart types
# class plan_to_d3(dspy.Signature):
#     """Generate D3.js visualization code (general purpose).
#     """ + COMMON_D3_DOCS
    
#     plan = dspy.InputField(desc="Planner instructions around what they want to visualize")
#     dataset_context = dspy.InputField(desc="Information about the dataset, columns, stats")
#     color_theme = dspy.InputField(desc="Color theme (hex values)")
#     d3_js_code = dspy.OutputField(desc="Complete D3.js code")

class D3VisualizationModule(dspy.Module):
    def __init__(self):
        self.styling_instructions = STYLING_INSTRUCTIONS
        self.planner = dspy.Predict(GenerateVisualizationPlan)
        # self.plan_to_d3_sign = dspy.Predict(plan_to_d3)
        self.chart_sigs = {
            'bar_chart_d3': dspy.asyncify(dspy.Predict(bar_chart_d3)),
            'line_chart_d3': dspy.asyncify(dspy.Predict(line_chart_d3)),
            'scatter_plot_d3': dspy.asyncify(dspy.Predict(scatter_plot_d3)),
            'histogram_d3': dspy.asyncify(dspy.Predict(histogram_d3)),
            'area_chart_d3': dspy.asyncify(dspy.Predict(area_chart_d3)),
            'boxplot_d3': dspy.asyncify(dspy.Predict(boxplot_d3)),
            'sankey_d3': dspy.asyncify(dspy.Predict(sankey_d3)),
            'treemap_d3': dspy.asyncify(dspy.Predict(treemap_d3)),
            'chord_diagram_d3': dspy.asyncify(dspy.Predict(chord_diagram_d3))
        }

            
        self.fail = FAIL_MESSAGE

    async def aforward(self, query, dataset_context):
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1200 )):
            plan = self.planner(query=query, dataset_context=dataset_context)

        logger.info("GenerateVisualizationPlan result: %s", plan.plan)
        # logger.info("DSPy inspect_history:\n%s", dspy.inspect_history(n=1))
        tasks = []
        styling = []
        if 'False' in str(plan.relevant_query):
            # Directly check if chart type names appear in plan.plan and use corresponding chart_sigs if so.
            for chart_key in self.chart_sigs.keys():
                chart_type = chart_key.replace('_d3', '')

                if chart_type in plan.plan:
                    # Find styling instructions for the chart type from STYLING_INSTRUCTIONS
                    
                    chart_type_category = chart_type  # chart_type variable from above
                    style = next(
                        (s['styling'] for s in self.styling_instructions if s.get('category') == chart_type_category),
                        {}
                    )
                    try:
                        chart_plan = plan.plan[chart_type]
                    except Exception as e:
                        logger.error(f"Failed to extract chart plan for {chart_type}: {e}")
                        # If direct dict access fails, fallback: search plan.plan as string and extract context
                        plan_str = str(plan.plan)
                        idx = plan_str.find(chart_type)
                        if idx != -1:
                            ahead = plan_str[idx-30:idx] if idx > 30 else plan_str[:idx]
                            # Take everything after `idx` until the next closing curly brace '}' (inclusive).
                            end_idx = plan_str.find('}', idx)
                            if end_idx != -1:
                                after = plan_str[idx:end_idx+1]  # include the closing brace
                            else:
                                after = plan_str[idx:]  # fallback if no closing }
                            logger.warning(f"String fallback for chart_type '{chart_type}': ...{ahead}>>>{after}...")
                            chart_plan = after  # crude, but at least passes something
                        else:
                            logger.warning(f"chart_type '{chart_type}' not found in plan.plan string fallback.")
                            continue
                    tasks.append(self.chart_sigs[chart_key](plan=chart_plan, dataset_context=dataset_context, styling=style))
            # INSERT_YOUR_CODE
            # INSERT_YOUR_CODE
            if not tasks:
                # If no chart type detected (empty tasks), default to line_chart
                style = next(
                    (s['styling'] for s in self.styling_instructions if s.get('category') == 'line_chart'),
                    {}
                )
                tasks.append(self.chart_sigs['line_chart_d3'](plan=plan.plan, dataset_context=dataset_context, styling=style))

            results = await asyncio.gather(*tasks)
            # Each result is expected to have a 'd3_js_code' attribute
            
            # Clean each result and return as separate chart specifications
            chart_specs = []
            chart_types_generated = []
            
            for i, r in enumerate(results):
                raw_code = getattr(r, 'd3_js_code', str(r))
                cleaned = clean_d3_code(raw_code)
                
                # Get the chart type for this result
                chart_type = list(self.chart_sigs.keys())[min(i, len(self.chart_sigs) - 1)].replace('_d3', '')
                
                # Get title from plan if available
                title = "Visualization"
                try:
                    if chart_type in plan.plan:
                        chart_info = plan.plan[chart_type]
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
                chart_types_generated.append(chart_type)
                
                logger.info(f"Chart {i+1} ({chart_type}): {title} - cleaned successfully")
            
            logger.info(f"Generated {len(chart_specs)} charts: {chart_types_generated}")
            # Return array of chart specs instead of concatenated code
            return chart_specs
        else:
            logger.info("Query found not relevant for visualization. Returning FAIL_MESSAGE.")
            return self.fail

