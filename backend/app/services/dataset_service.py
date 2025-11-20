"""
Unified dataset service for in-memory storage and context generation.
Handles dataset storage, retrieval, and asynchronous context generation using DSPy.
"""
import asyncio
import re
from typing import Dict, Optional, List, Tuple, Any
import pandas as pd
import dspy
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Dataset
from ..core.db import SessionLocal
from .agents import CreateDatasetContext


def clean_sheet_name(name: str) -> str:
    """
    Clean sheet/file name for use as Python variable.
    - Replace spaces with underscore
    - Remove numbers
    - Remove file extension
    """
    # Remove file extension
    name = re.sub(r'\.(csv|xlsx?|xls)$', '', name, flags=re.IGNORECASE)
    # Replace spaces with underscore
    name = name.replace(' ', '_')
    # Remove numbers
    name = re.sub(r'\d+', '', name)
    # Remove multiple underscores
    name = re.sub(r'_+', '_', name)
    # Remove leading/trailing underscores
    name = name.strip('_')
    # Ensure not empty
    return name if name else 'data'


class DatasetService:
    """
    Unified service for dataset management.
    Provides in-memory storage and asynchronous context generation.
    """
    
    def __init__(self):
        # In-memory storage: {user_id: {dataset_id: {df, metadata}}}
        self._store: Dict[int, Dict[str, dict]] = {}
        
        # DSPy context generator
        self.context_creator = dspy.Predict(CreateDatasetContext)
    
    # ==================== Data Storage Methods ====================
    
    def store_dataset(
        self, 
        user_id: int, 
        dataset_id: str, 
        df: pd.DataFrame | Dict[str, pd.DataFrame], 
        filename: str,
        file_type: str = "csv"
    ) -> dict:
        """
        Store a dataset in memory for a user.
        Normalizes all data to dict format: {sheet_name: DataFrame}
        For CSV: wraps in dict with cleaned filename as key
        For Excel: keeps as dict with cleaned sheet names as keys
        Returns metadata about the stored dataset.
        """
        if user_id not in self._store:
            self._store[user_id] = {}
        
        # Normalize to dict format
        if isinstance(df, dict):
            # Excel: clean sheet names
            cleaned_data = {clean_sheet_name(name): sheet_df for name, sheet_df in df.items()}
            is_multisheet = len(cleaned_data) > 1
        else:
            # CSV: wrap in dict with cleaned filename
            cleaned_name = clean_sheet_name(filename)
            cleaned_data = {cleaned_name: df}
            is_multisheet = False
        
        # Get sheet names and metadata
        sheet_names = list(cleaned_data.keys())
        total_rows = sum(len(sheet_df) for sheet_df in cleaned_data.values())
        
        # Use first sheet for column info
        first_sheet = cleaned_data[sheet_names[0]]
        columns = first_sheet.columns.tolist()
        column_count = len(columns)
        
        self._store[user_id][dataset_id] = {
            "df": cleaned_data,  # Always a dict now
            "filename": filename,
            "file_type": file_type,
            "is_multisheet": is_multisheet,
            "sheet_names": sheet_names,  # Cleaned names
            "uploaded_at": datetime.utcnow(),
            "row_count": total_rows,
            "column_count": column_count,
            "columns": columns,
            "context": None,  # Will be populated after context generation
            "context_status": "pending",
            "refine_attempts": 0,
        }
        
        return self.get_dataset_info(user_id, dataset_id)
    
    def get_dataset(self, user_id: int, dataset_id: str) -> Optional[Dict[str, pd.DataFrame]]:
        """Retrieve a dataset from memory (always returns dict format)"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            return self._store[user_id][dataset_id]["df"]
        return None

    def reset_refine_attempts(self, user_id: int, dataset_id: str) -> None:
        """Reset refine attempt counter for a dataset."""
        if user_id in self._store and dataset_id in self._store[user_id]:
            self._store[user_id][dataset_id]["refine_attempts"] = 0

    def increment_refine_attempt(self, user_id: int, dataset_id: str, limit: int) -> bool:
        """
        Increment refine attempts for a dataset.
        Returns True if under limit, False if limit exceeded.
        """
        if user_id not in self._store or dataset_id not in self._store[user_id]:
            return False

        entry = self._store[user_id][dataset_id]
        attempts = entry.get("refine_attempts", 0)

        if attempts >= limit:
            return False

        entry["refine_attempts"] = attempts + 1
        return True
    
    def get_dataset_info(self, user_id: int, dataset_id: str) -> Optional[dict]:
        """Get metadata about a dataset without returning the full DataFrame"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            data = self._store[user_id][dataset_id]
            return {
                "dataset_id": dataset_id,
                "filename": data["filename"],
                "file_type": data.get("file_type", "csv"),
                "is_multisheet": data.get("is_multisheet", False),
                "sheet_names": data.get("sheet_names"),
                "uploaded_at": data["uploaded_at"].isoformat(),
                "row_count": data["row_count"],
                "column_count": data["column_count"],
                "columns": data["columns"],
                "context": data.get("context"),
                "context_status": data.get("context_status", "pending"),
                "refine_attempts": data.get("refine_attempts", 0),
            }
        return None
    
    def list_datasets(self, user_id: int) -> List[dict]:
        """List all datasets for a user"""
        if user_id not in self._store:
            return []
        
        return [
            self.get_dataset_info(user_id, dataset_id)
            for dataset_id in self._store[user_id].keys()
        ]
    
    def delete_dataset(self, user_id: int, dataset_id: str) -> bool:
        """Delete a dataset from memory"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            del self._store[user_id][dataset_id]
            return True
        return False
    
    # ==================== Chart Metadata Methods ====================
    
    def set_chart_metadata(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int,
        chart_spec: str,
        plan: dict,
        figure_data: Optional[Dict[str, Any]] = None,
        chart_type: Optional[str] = None,
        title: Optional[str] = None
    ) -> None:
        """
        Store chart metadata including plan, code, and figure data.
        
        Args:
            user_id: User ID
            dataset_id: Dataset identifier
            chart_index: Chart index (0, 1, 2, etc.)
            chart_spec: Plotly code for the chart
            plan: The visualization plan (dict) for this chart
            figure_data: Optional executed figure data
            chart_type: Optional chart type (bar_chart, line_chart, etc.)
            title: Optional chart title
        """
        if user_id not in self._store:
            self._store[user_id] = {}
        
        if dataset_id not in self._store[user_id]:
            raise ValueError(f"Dataset {dataset_id} not found. Upload dataset first.")
        
        dataset = self._store[user_id][dataset_id]
        
        # Initialize charts metadata if first time
        if "charts" not in dataset:
            dataset["charts"] = {}
        
        # Store chart metadata
        dataset["charts"][chart_index] = {
            "chart_spec": chart_spec,
            "plan": plan,
            "figure": figure_data,
            "chart_type": chart_type,
            "title": title,
            "created_at": datetime.utcnow().isoformat()
        }
    
    def get_chart_metadata(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get chart metadata including plan, code, and figure.
        
        Returns:
            Dict with chart metadata or None if not found
        """
        if user_id in self._store and dataset_id in self._store[user_id]:
            charts = self._store[user_id][dataset_id].get("charts", {})
            return charts.get(chart_index)
        return None
    
    def get_chart_plan(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int
    ) -> Optional[dict]:
        """Get the plan for a specific chart."""
        metadata = self.get_chart_metadata(user_id, dataset_id, chart_index)
        return metadata.get("plan") if metadata else None
    
    def get_chart_code(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int
    ) -> Optional[str]:
        """Get the code for a specific chart."""
        metadata = self.get_chart_metadata(user_id, dataset_id, chart_index)
        return metadata.get("chart_spec") if metadata else None
    
    def get_latest_dataset(self, user_id: int) -> Optional[Tuple[str, pd.DataFrame]]:
        """Get the most recently uploaded dataset for a user"""
        if user_id not in self._store or not self._store[user_id]:
            return None
        
        # Find the most recent dataset
        latest = max(
            self._store[user_id].items(),
            key=lambda x: x[1]["uploaded_at"]
        )
        
        return (latest[0], latest[1]["df"])  # (dataset_id, DataFrame)
    
    def get_context(self, user_id: int, dataset_id: str) -> Optional[str]:
        """Get the generated context for a dataset from memory"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            return self._store[user_id][dataset_id].get("context")
        return None
    
    def get_context_status(self, user_id: int, dataset_id: str) -> str:
        """Get the context generation status for a dataset"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            return self._store[user_id][dataset_id].get("context_status", "pending")
        return "not_found"
    
    # ==================== Context Generation Methods ====================
    
    async def generate_context_async(
        self, 
        dataset_id: str, 
        df: pd.DataFrame,
        user_id: Optional[int] = None
    ) -> str:
        """
        Generate context asynchronously and update database and memory.
        Returns the generated context string.
        """
        # Run in thread pool to not block async loop
        loop = asyncio.get_event_loop()
        context = await loop.run_in_executor(
            None, 
            self._generate_context_sync, 
            dataset_id, 
            df,
            user_id
        )
        
        return context
    
    def _generate_context_sync(
        self, 
        dataset_id: str, 
        df: pd.DataFrame | Dict[str, pd.DataFrame],
        user_id: Optional[int] = None
    ) -> str:
        """Synchronous context generation using DSPy. Handles both single DataFrames and multi-sheet Excel."""
        db = SessionLocal()
        
        try:
            # Update database status to 'generating'
            dataset = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
            if dataset:
                dataset.context_status = "generating"
                db.commit()
                user_id = user_id or dataset.user_id
            
            # Update in-memory status
            if user_id and user_id in self._store and dataset_id in self._store[user_id]:
                self._store[user_id][dataset_id]["context_status"] = "generating"
            
            # Data is always a dict now (normalized in store_dataset)
            # Prepare dataframe info for all sheets
            sheet_names_list = list(df.keys())
            is_multisheet = len(sheet_names_list) > 1
            
            sheets_info = {}
            for sheet_name, sheet_df in df.items():
                sheets_info[sheet_name] = {
                    "columns": sheet_df.columns.tolist(),
                    "dtypes": sheet_df.dtypes.astype(str).to_dict(),
                    "shape": sheet_df.shape,
                    "sample_values": sheet_df.head(2).to_dict('records'),
                    "statistics": sheet_df.describe().to_dict() if len(sheet_df) > 0 else {}
                }
            
            # Create DSPy input with available sheet names
            context_info = {
                "available_sheets": sheet_names_list,
                "is_multisheet": is_multisheet,
                "sheets": {
                    name: {
                        "columns": info["columns"],
                        "shape": info["shape"],
                        "sample": df[name].head(2).to_markdown()
                    }
                    for name, info in sheets_info.items()
                }
            }
            
            # Add execution environment info to context
            execution_info = (
                f"\n\nIMPORTANT - Available DataFrames in execution environment:\n"
                f"- Available sheets: {', '.join(sheet_names_list)}\n"
                f"- Default DataFrame: 'df' (contains: {sheet_names_list[0]})\n"
                f"- Access specific sheets by name: {', '.join([f\"'{name}'\" for name in sheet_names_list])}\n"
            )
            
            # Generate context using DSPy
            with dspy.context(lm = dspy.LM('openai/gpt-4o-mini', max_tokens =2500)):
                result = self.context_creator(
                    dataframe_info=str(context_info) + execution_info
                )
            
            generated_context = result.dataset_context
            
            # Update database with generated context
            if dataset:
                dataset.context = generated_context
                dataset.context_generated_at = datetime.utcnow()
                dataset.context_status = "completed"
                dataset.columns_info = dataframe_info
                db.commit()
            
            # Update in-memory context
            if user_id and user_id in self._store and dataset_id in self._store[user_id]:
                self._store[user_id][dataset_id]["context"] = generated_context
                self._store[user_id][dataset_id]["context_status"] = "completed"
                
            return generated_context
            
        except Exception as e:
            # Mark as failed in database
            if dataset:
                dataset.context_status = "failed"
                db.commit()
            
            # Mark as failed in memory
            if user_id and user_id in self._store and dataset_id in self._store[user_id]:
                self._store[user_id][dataset_id]["context_status"] = "failed"
            
            raise e
        finally:
            db.close()
    
    # ==================== Combined Operations ====================
    
    def store_and_generate_context(
        self,
        user_id: int,
        dataset_id: str,
        df: pd.DataFrame,
        filename: str
    ) -> dict:
        """
        Convenience method to store dataset and trigger context generation.
        Returns dataset info immediately while context generates in background.
        """
        # Store the dataset in memory
        info = self.store_dataset(user_id, dataset_id, df, filename)
        
        # Note: Context generation should be triggered separately using
        # asyncio.create_task() in the calling route to avoid blocking
        
        return info


# Global singleton instance
dataset_service = DatasetService()

# Backward compatibility exports
data_store = dataset_service
context_generator = dataset_service

