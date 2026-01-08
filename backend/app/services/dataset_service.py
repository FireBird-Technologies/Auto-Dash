"""
Unified dataset service for in-memory storage and context generation.
Handles dataset storage, retrieval, and asynchronous context generation using DSPy.
"""
import asyncio
import re
from typing import Dict, Optional, List, Tuple, Any
import pandas as pd
import numpy as np
import dspy
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from ..models import Dataset, DashboardQuery, ChatMessage, PublicDashboard
from ..core.db import SessionLocal
from .agents import CreateDatasetContext
import secrets


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
        # Preserve existing notes if updating other fields
        existing_notes = ""
        if chart_index in dataset.get("charts", {}):
            existing_notes = dataset["charts"][chart_index].get("notes", "")
        
        dataset["charts"][chart_index] = {
            "chart_spec": chart_spec,
            "plan": plan,
            "figure": figure_data,
            "chart_type": chart_type,
            "title": title,
            "notes": existing_notes,
            "created_at": datetime.utcnow().isoformat()
        }
    
    def update_chart_notes(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int,
        notes: str
    ) -> None:
        """
        Update notes for a specific chart.
        
        Args:
            user_id: User ID
            dataset_id: Dataset identifier
            chart_index: Chart index
            notes: Notes content (markdown string)
        """
        if user_id not in self._store:
            self._store[user_id] = {}
        
        if dataset_id not in self._store[user_id]:
            raise ValueError(f"Dataset {dataset_id} not found. Upload dataset first.")
        
        dataset = self._store[user_id][dataset_id]
        
        # Initialize charts metadata if first time
        if "charts" not in dataset:
            dataset["charts"] = {}
        
        # Initialize chart if doesn't exist
        if chart_index not in dataset["charts"]:
            dataset["charts"][chart_index] = {}
        
        # Update notes
        dataset["charts"][chart_index]["notes"] = notes
        dataset["charts"][chart_index]["notes_updated_at"] = datetime.utcnow().isoformat()
    
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
    
    def delete_chart_metadata(
        self,
        user_id: int,
        dataset_id: str,
        chart_index: int
    ) -> bool:
        """
        Delete metadata for a specific chart.
        
        Args:
            user_id: User ID
            dataset_id: Dataset identifier
            chart_index: Chart index to delete
            
        Returns:
            True if chart was deleted, False if not found
        """
        if user_id in self._store and dataset_id in self._store[user_id]:
            charts = self._store[user_id][dataset_id].get("charts", {})
            if chart_index in charts:
                del charts[chart_index]
                # Re-index remaining charts to maintain sequential order
                new_charts = {}
                for i, (idx, chart_data) in enumerate(sorted(charts.items())):
                    new_charts[i] = {**chart_data, "chart_index": i}
                self._store[user_id][dataset_id]["charts"] = new_charts
                return True
        return False
    
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
        df: pd.DataFrame | Dict[str, pd.DataFrame],
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
        
        # Helper function to convert pandas/numpy objects to JSON-serializable types
        def make_json_serializable(obj):
            """Convert pandas/numpy objects to JSON-serializable types"""
            if isinstance(obj, (pd.Timestamp, datetime)):
                return obj.isoformat()
            elif isinstance(obj, (np.integer, np.floating)):
                return float(obj)
            elif pd.isna(obj):
                return None
            elif isinstance(obj, dict):
                return {k: make_json_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [make_json_serializable(item) for item in obj]
            return obj
        
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
            
            # Normalize df to dict format if it's a plain DataFrame
            if isinstance(df, dict):
                # Already a dict, use as-is
                df_dict = df
            else:
                # Plain DataFrame - wrap it in a dict
                # Use a generic name since we don't have the filename here
                df_dict = {"data": df}
            
            # Data is always a dict now (normalized above)
            # Prepare dataframe info for all sheets
            sheet_names_list = list(df_dict.keys())
            is_multisheet = len(sheet_names_list) > 1
            
            sheets_info = {}
            for sheet_name, sheet_df in df_dict.items():
                # Convert sample values to JSON-serializable format
                sample_records = sheet_df.head(2).to_dict('records')
                sample_records_clean = [
                    {k: make_json_serializable(v) for k, v in record.items()}
                    for record in sample_records
                ]
                
                # Convert statistics to JSON-serializable format
                stats = sheet_df.describe().to_dict() if len(sheet_df) > 0 else {}
                stats_clean = {k: make_json_serializable(v) for k, v in stats.items()}
                
                sheets_info[sheet_name] = {
                    "columns": sheet_df.columns.tolist(),
                    "dtypes": sheet_df.dtypes.astype(str).to_dict(),
                    "shape": sheet_df.shape,
                    "sample_values": sample_records_clean,
                    "statistics": stats_clean
                }
            
            # Create DSPy input with available sheet names
            context_info = {
                "available_sheets": sheet_names_list,
                "is_multisheet": is_multisheet,
                "sheets": {
                    name: {
                        "columns": info["columns"],
                        "shape": info["shape"],
                        "sample": df_dict[name].head(2).to_markdown()
                    }
                    for name, info in sheets_info.items()
                }
            }

            # Add execution environment info to context
            sheet_names_str = ", ".join(sheet_names_list)
            sheet_names_quoted = ", ".join([f"'{name}'" for name in sheet_names_list])
            execution_info = (
                "\n\nIMPORTANT - Available DataFrames in execution environment:\n"
                f"- Available sheets: {sheet_names_str}\n"
                f"- Default DataFrame: 'df' (contains: {sheet_names_list[0]})\n"
                f"- Access specific sheets by name: {sheet_names_quoted}\n"
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
                dataset.columns_info = sheets_info
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
    
    # ==================== Dashboard Query Persistence ====================
    
    def save_dashboard_query(
        self,
        db: Session,
        user_id: int,
        dataset_id: str,
        query: str,
        query_type: str,
        charts_data: List[Dict[str, Any]],
        dashboard_title: Optional[str] = None,
        background_color: Optional[str] = None,
        text_color: Optional[str] = None
    ) -> DashboardQuery:
        """
        Save a dashboard query (analyze/edit/add) with per-chart code breakdown.
        
        Args:
            db: Database session
            user_id: User ID
            dataset_id: Dataset identifier (string)
            query: User's request text
            query_type: "analyze", "edit", or "add"
            charts_data: List of chart objects with code, figure, title, chart_type, chart_index
            dashboard_title: Optional dashboard title
            background_color: Optional dashboard background color (hex code)
            text_color: Optional dashboard text color (hex code)
        """
        # Find dataset by dataset_id string
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        dashboard_query = DashboardQuery(
            dataset_id=dataset.id,
            user_id=user_id,
            query=query,
            query_type=query_type,
            dashboard_title=dashboard_title,
            charts_data=charts_data,
            background_color=background_color,
            text_color=text_color
        )
        
        db.add(dashboard_query)
        db.commit()
        db.refresh(dashboard_query)
        
        return dashboard_query
    
    def get_dashboard_history(
        self,
        db: Session,
        user_id: int,
        dataset_id: str
    ) -> List[Dict[str, Any]]:
        """Get all dashboard queries for a dataset."""
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            return []
        
        queries = db.query(DashboardQuery).filter(
            DashboardQuery.dataset_id == dataset.id
        ).order_by(DashboardQuery.created_at).all()
        
        return [
            {
                "id": q.id,
                "query": q.query,
                "query_type": q.query_type,
                "dashboard_title": q.dashboard_title,
                "charts_data": q.charts_data,
                "background_color": q.background_color,
                "text_color": q.text_color,
                "created_at": q.created_at.isoformat()
            }
            for q in queries
        ]
    
    def update_dashboard_colors(
        self,
        db: Session,
        user_id: int,
        dataset_id: str,
        background_color: str,
        text_color: str
    ) -> Optional[DashboardQuery]:
        """
        Update colors for the latest dashboard query.
        
        Args:
            db: Database session
            user_id: User ID
            dataset_id: Dataset identifier (string)
            background_color: Dashboard background color (hex code)
            text_color: Dashboard text color (hex code)
        
        Returns:
            Updated DashboardQuery or None if not found
        """
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            return None
        
        # Get the latest dashboard query
        latest_query = db.query(DashboardQuery).filter(
            DashboardQuery.dataset_id == dataset.id
        ).order_by(DashboardQuery.created_at.desc()).first()
        
        if latest_query:
            latest_query.background_color = background_color
            latest_query.text_color = text_color
            db.commit()
            db.refresh(latest_query)
            return latest_query
        
        return None
    
    # ==================== Chat Message Persistence ====================
    
    def save_chat_message(
        self,
        db: Session,
        user_id: int,
        dataset_id: str,
        role: str,
        content: str,
        query_type: Optional[str] = None,
        code: Optional[str] = None,
        chart_index: Optional[int] = None
    ) -> ChatMessage:
        """
        Save a chat message (user or assistant).
        
        Args:
            db: Database session
            user_id: User ID
            dataset_id: Dataset identifier (string)
            role: "user" or "assistant"
            content: Message content
            query_type: Query type tag ("edit", "add", "data_analysis", etc.)
            code: Executable code if applicable
            chart_index: Chart index if related to a chart
        """
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        chat_message = ChatMessage(
            dataset_id=dataset.id,
            user_id=user_id,
            role=role,
            content=content,
            query_type=query_type,
            code=code,
            chart_index=chart_index
        )
        
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
        
        return chat_message
    
    def get_chat_history(
        self,
        db: Session,
        user_id: int,
        dataset_id: str
    ) -> List[Dict[str, Any]]:
        """Get chat history for a dataset."""
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            return []
        
        messages = db.query(ChatMessage).filter(
            ChatMessage.dataset_id == dataset.id
        ).order_by(ChatMessage.created_at).all()
        
        return [
            {
                "id": msg.id,
                "type": msg.role,
                "message": msg.content,
                "query_type": msg.query_type,
                "code": msg.code,
                "chart_index": msg.chart_index,
                "created_at": msg.created_at.isoformat()
            }
            for msg in messages
        ]
    
    # ==================== Public Dashboard Sharing ====================
    
    def create_public_dashboard(
        self,
        db: Session,
        user_id: int,
        dataset_id: str,
        figures_data: List[Dict[str, Any]],
        dashboard_title: Optional[str] = None,
        hours_valid: Optional[int] = None,
        background_color: str = "#ffffff",
        text_color: str = "#1a1a1a",
        container_colors: Optional[Dict] = None
    ) -> PublicDashboard:
        """
        Create a public dashboard entry.
        Only called when user clicks share button.
        
        Args:
            db: Database session
            user_id: User ID
            dataset_id: Dataset identifier (string)
            figures_data: Array of chart figures [{chart_index, figure, title, chart_type}, ...]
            dashboard_title: Dashboard title
            hours_valid: Hours until expiry (None for no expiry)
            background_color: Dashboard background color (hex code)
        """
        dataset = db.query(Dataset).filter(
            and_(
                Dataset.user_id == user_id,
                Dataset.dataset_id == dataset_id
            )
        ).first()
        
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Generate unique token
        share_token = secrets.token_urlsafe(32)
        
        # Check if public dashboard already exists for this dataset
        existing = db.query(PublicDashboard).filter(
            PublicDashboard.dataset_id == dataset.id,
            PublicDashboard.is_public == True
        ).first()
        
        if existing:
            # Update existing
            existing.share_token = share_token
            existing.figures_data = figures_data
            existing.dashboard_title = dashboard_title
            existing.background_color = background_color
            existing.text_color = text_color
            existing.updated_at = datetime.utcnow()
            if hours_valid:
                existing.expires_at = datetime.utcnow() + timedelta(hours=hours_valid)
            else:
                existing.expires_at = None
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # Create new
            public_dashboard = PublicDashboard(
                dataset_id=dataset.id,
                user_id=user_id,
                share_token=share_token,
                figures_data=figures_data,
                dashboard_title=dashboard_title,
                background_color=background_color,
                text_color=text_color,
                container_colors=container_colors or {},
                is_public=True,
                expires_at=datetime.utcnow() + timedelta(hours=hours_valid) if hours_valid else None
            )
            db.add(public_dashboard)
            db.commit()
            db.refresh(public_dashboard)
            return public_dashboard
    
    def get_public_dashboard(
        self,
        db: Session,
        token: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get public dashboard by token.
        Returns None if not found, expired, or not public.
        """
        public_dashboard = db.query(PublicDashboard).filter(
            PublicDashboard.share_token == token
        ).first()
        
        if not public_dashboard:
            return None
        
        if not public_dashboard.is_public:
            return None
        
        if public_dashboard.expires_at and datetime.utcnow() > public_dashboard.expires_at:
            return {"error": "expired"}
        
        # Ensure figures_data includes notes if they exist
        figures_data = public_dashboard.figures_data or []
        for fig_data in figures_data:
            # Notes should already be in figures_data from share request, but ensure it's present
            if "notes" not in fig_data:
                fig_data["notes"] = ""
        
        return {
            "dataset_id": public_dashboard.dataset.dataset_id,
            "filename": public_dashboard.dataset.filename,
            "dashboard_title": public_dashboard.dashboard_title,
            "background_color": public_dashboard.background_color or "#ffffff",
            "text_color": public_dashboard.text_color or "#1a1a1a",
            "container_colors": public_dashboard.container_colors or {},
            "figures_data": figures_data,
            "owner_name": public_dashboard.dataset.user.name if public_dashboard.dataset.user else "Anonymous",
            "created_at": public_dashboard.created_at.isoformat()
        }
    
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

