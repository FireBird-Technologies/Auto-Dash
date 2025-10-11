"""
Unified dataset service for in-memory storage and context generation.
Handles dataset storage, retrieval, and asynchronous context generation using DSPy.
"""
import asyncio
from typing import Dict, Optional, List, Tuple
import pandas as pd
import dspy
from sqlalchemy.orm import Session
from datetime import datetime
from ..models import Dataset
from ..core.db import SessionLocal
from .agents import CreateDatasetContext


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
        df: pd.DataFrame, 
        filename: str
    ) -> dict:
        """
        Store a dataset in memory for a user.
        Returns metadata about the stored dataset.
        """
        if user_id not in self._store:
            self._store[user_id] = {}
        
        self._store[user_id][dataset_id] = {
            "df": df,
            "filename": filename,
            "uploaded_at": datetime.utcnow(),
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": df.columns.tolist(),
            "context": None,  # Will be populated after context generation
            "context_status": "pending",
        }
        
        return self.get_dataset_info(user_id, dataset_id)
    
    def get_dataset(self, user_id: int, dataset_id: str) -> Optional[pd.DataFrame]:
        """Retrieve a dataset DataFrame from memory"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            return self._store[user_id][dataset_id]["df"]
        return None
    
    def get_dataset_info(self, user_id: int, dataset_id: str) -> Optional[dict]:
        """Get metadata about a dataset without returning the full DataFrame"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            data = self._store[user_id][dataset_id]
            return {
                "dataset_id": dataset_id,
                "filename": data["filename"],
                "uploaded_at": data["uploaded_at"].isoformat(),
                "row_count": data["row_count"],
                "column_count": data["column_count"],
                "columns": data["columns"],
                "context": data.get("context"),
                "context_status": data.get("context_status", "pending"),
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
        df: pd.DataFrame,
        user_id: Optional[int] = None
    ) -> str:
        """Synchronous context generation using DSPy"""
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
            
            # Prepare dataframe info
            dataframe_info = {
                "columns": df.columns.tolist(),
                "dtypes": df.dtypes.astype(str).to_dict(),
                "shape": df.shape,
                "sample_values": df.head(3).to_dict('records'),
                "statistics": df.describe().to_dict() if len(df) > 0 else {}
            }
            
            # Generate context using DSPy
            context_info ={"columns": df.describe().to_dict(), "sample_values": df.head(2).to_markdown(), }
            with dspy.context(lm = dspy.LM('openai/gpt-4o-mini', max_tokens =2500)):
                result = self.context_creator(
                    dataframe_info=str(context_info)
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

