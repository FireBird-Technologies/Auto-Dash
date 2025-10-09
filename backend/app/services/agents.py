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
from typing import Dict, Any, List, Optional
import json


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
                "grid_color": "#e0e0e0"
            },
            "title": {
                "bold_html": True,
                "include": True
            },
            "colors": "use color scale (d3.schemeCategory10 or interpolated if >10 lines)",
            "annotations": ["min", "max"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True},
                "zoom": {"enabled": True, "pan": True}
            },
            "svg_defaults": {"height": 600, "width": 800, "margin": {"top": 50, "right": 50, "bottom": 50, "left": 60}}
        }
    },
    {
        "category": "bar_charts",
        "description": "Useful for comparing discrete categories or groups with bars representing values.",
        "styling": {
            "theme": "light",
            "axes": {
                "stroke_width": 0.2,
                "grid_stroke_width": 1
            },
            "title": {"bold_html": True, "include": True},
            "annotations": ["bar values"],
            "bar_style": {"padding": 0.1, "corner_radius": 3},
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True, "highlight_color": "#ff6b6b"},
                "click": {"enabled": True, "action": "show_details"}
            },
            "svg_defaults": {"height": 600, "width": 800}
        }
    },
    {
        "category": "histograms",
        "description": "Display the distribution of a data set, useful for returns or frequency distributions.",
        "styling": {
            "theme": "light",
            "bin_count": 50,
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1},
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "bar_style": {"opacity": 0.8, "corner_radius": 2},
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {"height": 600, "width": 800}
        }
    },
    {
        "category": "scatter_plots",
        "description": "Show relationships between two numerical variables with points.",
        "styling": {
            "theme": "light",
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1},
            "title": {"bold_html": True, "include": True},
            "point_style": {"radius": 4, "opacity": 0.6},
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000}
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True},
                "zoom": {"enabled": True, "pan": True},
                "brush": {"enabled": True}
            },
            "svg_defaults": {"height": 600, "width": 800}
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
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000},
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True, "highlight": True}
            },
            "svg_defaults": {"height": 600, "width": 800}
        }
    },
    {
        "category": "tabular_and_generic_charts",
        "description": "Applies to charts where number formatting needs flexibility, including mixed or raw data.",
        "styling": {
            "theme": "light",
            "axes": {"stroke_width": 0.2, "grid_stroke_width": 1},
            "title": {"bold_html": True, "include": True},
            "annotations": ["x values"],
            "number_format": {
                "apply_k_m": True,
                "thresholds": {"K": 1000, "M": 100000},
                "exclude_if_commas_present": True,
                "exclude_if_not_numeric": True,
                "percentage_decimals": 2,
                "percentage_sign": True
            },
            "svg_defaults": {"height": 600, "width": 800}
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
                "grid_stroke_width": 1
            },
            "color_scale": "d3.interpolateViridis",
            "title": {"bold_html": True, "include": True},
            "interactivity": {
                "hover": {"enabled": True, "show_tooltip": True}
            },
            "svg_defaults": {"height": 600, "width": 800}
        }
    },
    {
        "category": "histogram_distribution",
        "description": "Specialized histogram for return distributions with opacity control.",
        "styling": {
            "theme": "light",
            "bar_style": {"opacity": 0.75},
            "axes": {
                "grid_stroke_width": 1
            },
            "title": {"bold_html": True, "include": True},
            "svg_defaults": {"height": 600, "width": 800}
        }
    }
]


# ============================================================================
# DSPY SIGNATURES
# ============================================================================

class ValidateQuery(dspy.Signature):
    """Validate if the query can be satisfied with available data."""
    query = dspy.InputField(desc="User's natural language query")
    available_columns = dspy.InputField(desc="List of available column names in the dataset")
    column_types = dspy.InputField(desc="Dictionary mapping column names to their data types")
    
    is_valid = dspy.OutputField(desc="Boolean: True if query can be satisfied with available columns", type=bool)
    missing_info = dspy.OutputField(desc="Explanation of what's missing or problematic if not valid")
    suggested_columns = dspy.OutputField(desc="List of column names that should be used for this query")


class GenerateVisualizationPlan(dspy.Signature):
    """
    Generate a visualization or analytical plan from a natural language query.
    The plan should include the reasoning steps and the names of charts
    (chosen from known chart types).
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
            "[line_charts, bar_charts, histograms, scatter_plots, pie_charts, "
            "tabular_and_generic_charts, heat_maps, histogram_distribution]."
        )
    )

    relevant_query = dspy.OutputField(
        desc="Boolean flag — True if the query is NOT about visualizations, dashboarding, design, data analysis etc. False if it IS relevant.",
        type=bool
    )
    
    chart_type = dspy.OutputField(
        desc="Primary chart type from the list above"
    )


class GenerateDataAggregation(dspy.Signature):
    """
    Generate pandas code to aggregate and prepare data for visualization.
    """
    plan = dspy.InputField(desc="Visualization plan describing what to compute")
    dataset_context = dspy.InputField(desc="Dataset information including columns and types")
    
    aggregation_code = dspy.OutputField(
        desc="Python pandas code that transforms the input DataFrame 'df' into aggregated data. Must be executable code that creates a variable 'result'."
    )
    columns_needed = dspy.OutputField(
        desc="List of column names needed from the original dataset",
        type=list
    )


class PlanToD3(dspy.Signature):
    """Convert visualization plan to executable D3.js code."""
    plan = dspy.InputField(desc="Planner instructions around what they want to visualize")
    dataset_context = dspy.InputField(desc="Information about the dataset, columns, stats")
    styling_instructions = dspy.InputField(desc="Styling instructions for the charts/dashboard")
    
    d3_js_code = dspy.OutputField(
        desc="Complete, executable D3.js code that renders the visualization. Should include all necessary D3 setup, scales, axes, and rendering logic."
    )


class GenerateChartMetadata(dspy.Signature):
    """Generate metadata for the chart including title, labels, and description."""
    query = dspy.InputField(desc="User's original query")
    plan = dspy.InputField(desc="Visualization plan")
    chart_type = dspy.InputField(desc="Type of chart being generated")
    
    title = dspy.OutputField(desc="Chart title")
    x_label = dspy.OutputField(desc="X-axis label (if applicable)")
    y_label = dspy.OutputField(desc="Y-axis label (if applicable)")
    description = dspy.OutputField(desc="Brief description of what the chart shows")


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

class D3VisualizationModule(dspy.Module):
    """
    Main DSPy module for generating D3.js visualizations.
    
    Pipeline:
    1. Validate query against available data
    2. Generate visualization plan
    3. Generate data aggregation code (if needed)
    4. Generate D3.js code
    5. Generate metadata
    """
    
    def __init__(self, styling_instructions: List[Dict] = None):
        super().__init__()
        self.styling_instructions = styling_instructions or STYLING_INSTRUCTIONS
        
        # Initialize predictors
        self.validator = dspy.Predict(ValidateQuery)
        self.planner = dspy.Predict(GenerateVisualizationPlan)
        self.data_aggregator = dspy.Predict(GenerateDataAggregation)
        self.d3_generator = dspy.Predict(PlanToD3)
        self.metadata_generator = dspy.Predict(GenerateChartMetadata)
        
    def get_relevant_styling(self, plan: str) -> List[Dict]:
        """Extract relevant styling instructions based on the plan."""
        relevant_styles = []
        for style_config in self.styling_instructions:
            if style_config.get("category") in plan:
                relevant_styles.append(style_config)
        return relevant_styles
    
    def extract_chart_type(self, plan: str) -> str:
        """Extract the primary chart type from the plan."""
        for style_config in self.styling_instructions:
            category = style_config.get("category")
            if category in plan:
                return category.replace("_", " ").title()
        return "Custom Chart"
    
    def safe_execute_aggregation(self, df: pd.DataFrame, code: str) -> Optional[pd.DataFrame]:
        """
        Safely execute pandas aggregation code.
        Returns None if execution fails.
        """
        try:
            # Create a safe execution environment
            local_vars = {"df": df, "pd": pd}
            exec(code, {"__builtins__": {}}, local_vars)
            
            # Try to get the result
            if "result" in local_vars:
                return local_vars["result"]
            else:
                # If no result variable, return original df
                return df
        except Exception as e:
            print(f"Aggregation execution failed: {e}")
            return None
    
    def forward(
        self, 
        query: str, 
        df: pd.DataFrame,
        return_aggregation_code: bool = False
    ) -> Dict[str, Any]:
        """
        Generate visualization from query and dataframe.
        
        Args:
            query: Natural language query
            df: Pandas DataFrame with the data
            return_aggregation_code: If True, includes aggregation code in response
            
        Returns:
            Dictionary with chart specification
        """
        # Prepare dataset context
        dataset_context = {
            "columns": df.columns.tolist(),
            "dtypes": {k: str(v) for k, v in df.dtypes.items()},
            "shape": {"rows": len(df), "columns": len(df.columns)},
            "sample_rows": df.head(5).to_dict('records'),
            "statistics": df.describe().to_dict() if len(df) > 0 else {}
        }
        dataset_context_str = json.dumps(dataset_context, indent=2)
        
        # Step 1: Validate query
        validation = self.validator(
            query=query,
            available_columns=str(df.columns.tolist()),
            column_types=str(df.dtypes.to_dict())
        )
        
        if not validation.is_valid:
            return {
                "type": "error",
                "message": validation.missing_info,
                "suggestions": validation.suggested_columns if hasattr(validation, 'suggested_columns') else []
            }
        
        # Step 2: Generate plan
        plan_result = self.planner(
            query=query,
            dataset_context=dataset_context_str
        )
        
        # Check if query is relevant
        if plan_result.relevant_query:  # True means NOT relevant
            return {
                "type": "error",
                "message": "Query is not about data visualization or analysis",
                "d3_code": FAIL_MESSAGE
            }
        
        # Step 3: Generate data aggregation (optional)
        aggregated_df = df
        aggregation_code = None
        
        if "aggregate" in plan_result.plan.lower() or "group" in plan_result.plan.lower():
            try:
                agg_result = self.data_aggregator(
                    plan=plan_result.plan,
                    dataset_context=dataset_context_str
                )
                aggregation_code = agg_result.aggregation_code
                
                # Try to execute aggregation
                result = self.safe_execute_aggregation(df, aggregation_code)
                if result is not None:
                    aggregated_df = result
            except Exception as e:
                print(f"Aggregation failed: {e}")
                # Continue with original data
        
        # Step 4: Get relevant styling
        relevant_styles = self.get_relevant_styling(plan_result.plan)
        
        # Step 5: Generate D3 code
        d3_result = self.d3_generator(
            plan=plan_result.plan,
            dataset_context=dataset_context_str,
            styling_instructions=str(relevant_styles)
        )
        
        # Step 6: Generate metadata
        metadata = self.metadata_generator(
            query=query,
            plan=plan_result.plan,
            chart_type=plan_result.chart_type if hasattr(plan_result, 'chart_type') else "unknown"
        )
        
        # Prepare response
        response = {
            "type": self.extract_chart_type(plan_result.plan),
            "data": aggregated_df.to_dict('records'),
            "spec": {
                "code": d3_result.d3_js_code,
                "styling": relevant_styles,
                "renderer": "d3"
            },
            "metadata": {
                "title": metadata.title if hasattr(metadata, 'title') else query,
                "x_label": metadata.x_label if hasattr(metadata, 'x_label') else "",
                "y_label": metadata.y_label if hasattr(metadata, 'y_label') else "",
                "description": metadata.description if hasattr(metadata, 'description') else "",
                "columns_used": validation.suggested_columns if hasattr(validation, 'suggested_columns') else [],
                "generated_by": "dspy_d3_module",
                "chart_category": plan_result.chart_type if hasattr(plan_result, 'chart_type') else "unknown"
            },
            "plan": plan_result.plan
        }
        
        if return_aggregation_code and aggregation_code:
            response["aggregation_code"] = aggregation_code
        
        return response


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def initialize_dspy(
    model: str = "gpt-4o-mini",
    api_key: Optional[str] = None
) -> D3VisualizationModule:
    """
    Initialize DSPy with a language model and return the module.
    
    Args:
        model: Model name (e.g., "gpt-4o-mini", "gpt-3.5-turbo")
        api_key: OpenAI API key (if not set in environment)
        
    Returns:
        Initialized D3VisualizationModule
    """
    import os
    
    if api_key:
        os.environ["OPENAI_API_KEY"] = api_key
    
    # Configure DSPy
    lm = dspy.OpenAI(model=model)
    dspy.settings.configure(lm=lm)
    
    # Return initialized module
    return D3VisualizationModule(STYLING_INSTRUCTIONS)


def generate_visualization(
    query: str,
    df: pd.DataFrame,
    module: Optional[D3VisualizationModule] = None
) -> Dict[str, Any]:
    """
    Convenience function to generate visualization.
    
    Args:
        query: Natural language query
        df: Pandas DataFrame
        module: Pre-initialized module (or will create new one)
        
    Returns:
        Chart specification dictionary
    """
    if module is None:
        module = initialize_dspy()
    
    return module.forward(query, df)


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    # Example usage
    import os
    
    # Initialize DSPy
    print("Initializing DSPy...")
    viz_module = initialize_dspy()
    
    # Create sample data
    sample_df = pd.DataFrame({
        "month": ["Jan", "Feb", "Mar", "Apr", "May"],
        "sales": [10000, 15000, 12000, 18000, 22000],
        "region": ["North", "North", "South", "South", "North"]
    })
    
    # Generate visualization
    print("Generating visualization...")
    result = viz_module.forward(
        query="Show me a bar chart of sales by month",
        df=sample_df
    )
    
    print(f"\nChart Type: {result['type']}")
    print(f"Title: {result['metadata']['title']}")
    print(f"\nD3 Code Preview:")
    print(result['spec']['code'][:200] + "...")

