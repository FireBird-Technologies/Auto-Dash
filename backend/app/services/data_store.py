"""
In-memory data store for uploaded CSV files.
Each user session maintains their uploaded datasets.
"""
from typing import Dict, Optional, List
import pandas as pd
import numpy as np
from datetime import datetime


class DataStore:
    """Simple in-memory storage for uploaded datasets"""
    
    def __init__(self):
        # Structure: {user_id: {dataset_id: {"df": DataFrame, "filename": str, "uploaded_at": datetime}}}
        self._store: Dict[int, Dict[str, dict]] = {}
    
    def store_dataset(
        self, 
        user_id: int, 
        dataset_id: str, 
        df: pd.DataFrame, 
        filename: str
    ) -> dict:
        """Store a dataset for a user"""
        if user_id not in self._store:
            self._store[user_id] = {}
        
        self._store[user_id][dataset_id] = {
            "df": df,
            "filename": filename,
            "uploaded_at": datetime.utcnow(),
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": df.columns.tolist(),
        }
        
        return self.get_dataset_info(user_id, dataset_id)
    
    def get_dataset(self, user_id: int, dataset_id: str) -> Optional[pd.DataFrame]:
        """Retrieve a dataset"""
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
        """Delete a dataset"""
        if user_id in self._store and dataset_id in self._store[user_id]:
            del self._store[user_id][dataset_id]
            return True
        return False
    
    def get_latest_dataset(self, user_id: int) -> Optional[tuple]:
        """Get the most recently uploaded dataset for a user"""
        if user_id not in self._store or not self._store[user_id]:
            return None
        
        # Find the most recent dataset
        latest = max(
            self._store[user_id].items(),
            key=lambda x: x[1]["uploaded_at"]
        )
        
        return (latest[0], latest[1]["df"])  # (dataset_id, DataFrame)


# Global singleton instance
data_store = DataStore()

