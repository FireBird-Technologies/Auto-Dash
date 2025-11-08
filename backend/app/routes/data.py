from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel
import pandas as pd
import numpy as np
import io
import json
import chardet
import tempfile
import os
from dotenv import load_dotenv

# Load .env file from the parent directory (above 'app')
from pathlib import Path
import os

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


import uuid
import asyncio
from pathlib import Path
from datetime import datetime

from ..core.db import get_db
from ..core.security import get_current_user
from ..models import User, Dataset as DatasetModel
from ..services.dataset_service import dataset_service
from ..schemas.chat import FixVisualizationRequest
from ..services.agents import fix_d3
import logging
import re
import dspy


# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])


# Automatic data type conversion functions
def try_convert_to_numeric(series: pd.Series, col_name: str) -> pd.Series:
    """
    Attempts to convert a series to numeric by cleaning string values.
    Removes commas, dollar signs, parentheses, and other common characters.
    """
    try:
        # Skip if already numeric
        if pd.api.types.is_numeric_dtype(series):
            return series
        
        # Try direct conversion first
        try:
            return pd.to_numeric(series, errors='raise')
        except:
            pass
        
        # Clean string values if they contain numbers
        if series.dtype == 'object':
            # Check if any value contains digits
            has_digits = series.astype(str).str.contains(r'\d', na=False).any()
            
            if has_digits:
                # Remove common characters: commas, dollar signs, spaces, parentheses, etc.
                cleaned = series.astype(str).str.replace(r'[\$,\s\(\)]', '', regex=True)
                
                # Handle percentages
                is_percentage = cleaned.str.contains('%', na=False).any()
                cleaned = cleaned.str.replace('%', '', regex=False)
                
                # Try to convert to numeric
                converted = pd.to_numeric(cleaned, errors='coerce')
                
                # If percentage, divide by 100
                if is_percentage:
                    converted = converted / 100
                
                # Only return converted if we successfully converted at least some values
                if converted.notna().sum() > 0:
                    logger.info(f"✓ Converted '{col_name}' to numeric (float)")
                    return converted
        
        return series
        
    except Exception as e:
        logger.warning(f"✗ Could not convert '{col_name}' to numeric: {e}")
        return series


def try_convert_to_datetime(series: pd.Series, col_name: str) -> pd.Series:
    """
    Attempts to convert a series to datetime format.
    Tries multiple common datetime formats.
    """
    try:
        # Skip if already datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return series
        
        # Try pandas automatic datetime conversion
        converted = pd.to_datetime(series, errors='coerce', infer_datetime_format=True)
        
        # Only return converted if we successfully converted at least some values
        if converted.notna().sum() > 0:
            logger.info(f"✓ Converted '{col_name}' to datetime")
            return converted
        
        return series
        
    except Exception as e:
        logger.warning(f"✗ Could not convert '{col_name}' to datetime: {e}")
        return series


def auto_convert_datatypes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Automatically converts DataFrame columns to appropriate data types.
    
    - Converts string columns with numbers to float (removes commas, $, etc.)
    - Converts columns with 'time', 'date', etc. in name to datetime if they match a datetime format
    
    Args:
        df: Input DataFrame
        
    Returns:
        DataFrame with converted columns
    """
    logger.info(f"Starting automatic data type conversion for {len(df.columns)} columns")
    
    # Process each column
    for col in df.columns:
        # Check if column name suggests it's a date/time column
        if any(keyword in col.lower() for keyword in ['date', 'time', 'datetime', 'timestamp']):
            df[col] = try_convert_to_datetime(df[col], col)
        
        # Try to convert string columns with numbers to float
        elif df[col].dtype == 'object':
            df[col] = try_convert_to_numeric(df[col], col)
    
    logger.info(f"Data type conversion complete")
    
    return df


# Request/Response models
class FirstQueryRequest(BaseModel):
    query: str
    color_theme:Optional[str] = None
    dataset_id: Optional[str] = None

class ChatQueryRequest(BaseModel):
    query:str
    dataset_id:Optional[str] = None


class ChartResponse(BaseModel):
    chart_type: str
    data: Any
    spec: Dict[str, Any]


class FileProcessor:
    """Robust file processor with multiple fallback strategies"""
    
    def __init__(self, filepath: str):
        self.filepath = filepath
        self.df = None
    
    def detect_encoding(self, sample_size=100000):
        """Detect file encoding for CSV files"""
        with open(self.filepath, 'rb') as f:
            raw_data = f.read(sample_size)
            result = chardet.detect(raw_data)
            return result['encoding']
    
    def read_csv(self):
        """Read CSV with multiple fallback strategies"""
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        delimiters = [',', ';', '\t', '|', ':', ' ']
        
        # Try auto-detect encoding first
        try:
            detected_encoding = self.detect_encoding()
            if detected_encoding and detected_encoding not in encodings:
                encodings.insert(0, detected_encoding)
        except Exception as e:
            logger.warning(f"Encoding detection failed: {str(e)}")
        
        # Try different encoding and delimiter combinations
        for encoding in encodings:
            for delimiter in delimiters:
                try:
                    self.df = pd.read_csv(
                        self.filepath,
                        encoding=encoding,
                        delimiter=delimiter,
                        on_bad_lines='skip',  # Skip bad lines instead of failing
                        engine='python',  # More flexible parser
                        low_memory=False,
                        encoding_errors='replace'  # Replace problematic characters
                    )
                    
                    # Check if we got meaningful data (more than 1 column)
                    if self.df.shape[1] > 1:
                        print(f"✓ Successfully read CSV with encoding={encoding}, delimiter='{delimiter}'")
                        return self.df
                except Exception as e:
                    continue
        
        # Last resort: read as single column and try to split
        try:
            self.df = pd.read_csv(
                self.filepath,
                encoding='latin-1',
                engine='python',
                on_bad_lines='skip',
                header=None
            )
            print("✓ Read CSV as single column (may need manual parsing)")
            return self.df
        except Exception as e:
            raise Exception(f"Failed to read CSV: {str(e)}")
    
    def read_excel(self):
        """Read Excel with multiple fallback strategies"""
        engines = ['openpyxl', 'xlrd']
        
        for engine in engines:
            try:
                # Try reading all sheets first
                self.df = pd.read_excel(
                    self.filepath,
                    engine=engine,
                    sheet_name=0  # Read first sheet
                )
                print(f"✓ Successfully read Excel with engine={engine}")
                return self.df
            except Exception as e:
                continue
        
        # Try reading as CSV if Excel fails (sometimes .xlsx are actually CSV)
        try:
            print("Excel engines failed, trying as CSV...")
            return self.read_csv()
        except:
            raise Exception("Failed to read Excel file with all available methods")


@router.get("/sample")
async def get_sample_data():
    """
    Get sample housing data from housing_sample.csv
    """
    try:
        # Path to housing_sample.csv
        sample_file = Path(__file__).parent.parent / "housing_sample.csv"
        
        if not sample_file.exists():
            raise HTTPException(status_code=404, detail="Sample data file not found")
        
        # Read the CSV
        df = pd.read_csv(sample_file)
        
        # Replace NaN with None (which becomes null in JSON)
        clean_df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # Return data info
        return {
            "message": "Sample housing data loaded",
            "filename": "housing_sample.csv",
            "rows": len(df),
            "columns": df.columns.tolist(),
            "data": df_clean.to_dict('records'),
            "preview": df_clean.head(10).to_dict('records'),
            "data_types": df.dtypes.astype(str).to_dict()
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading sample data: {str(e)}"
        )


@router.post("/sample/load")
async def load_sample_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Load sample housing data into user's workspace.
    Reuses pre-generated context if available from any previous load.
    """
    try:
        # Path to housing_sample.csv
        sample_file = Path(__file__).parent.parent / "housing_sample.csv"
        
        if not sample_file.exists():
            raise HTTPException(status_code=404, detail="Sample data file not found")
        
        # Read the CSV
        df = pd.read_csv(sample_file)
        
        # Replace NaN with None (which becomes null in JSON)
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # Use consistent dataset ID for sample data (per user)
        # This allows us to reuse context across sessions
        dataset_id = f"sample_housing_{current_user.id}"
        
        # Check if this user already has this sample dataset
        existing_dataset = db.query(DatasetModel).filter(
            DatasetModel.dataset_id == dataset_id,
            DatasetModel.user_id == current_user.id
        ).first()
        
        if existing_dataset:
            # Dataset already exists, update it and reuse context if available
            existing_dataset.row_count = len(df)
            existing_dataset.column_count = len(df.columns)
            existing_dataset.file_size_bytes = sample_file.stat().st_size
            db.commit()
            db.refresh(existing_dataset)
            
            # Store in in-memory data store (for fast access)
            info = dataset_service.store_dataset(
                user_id=current_user.id,
                dataset_id=dataset_id,
                df=df,
                filename="housing_sample.csv"
            )
            
            # If context already exists, load it into memory
            if existing_dataset.context and existing_dataset.context_status == "completed":
                # Context exists in DB, load it into memory
                if current_user.id in dataset_service._store and dataset_id in dataset_service._store[current_user.id]:
                    dataset_service._store[current_user.id][dataset_id]["context"] = existing_dataset.context
                    dataset_service._store[current_user.id][dataset_id]["context_status"] = "completed"
                
                return {
                    "message": "Sample data loaded successfully with pre-generated context.",
                    "dataset_id": dataset_id,
                    "dataset_info": info,
                    "context_status": "completed",
                    "context_reused": True
                }
            else:
                # Context doesn't exist or failed, regenerate
                asyncio.create_task(
                    dataset_service.generate_context_async(dataset_id, df.copy(), current_user.id)
                )
                
                return {
                    "message": "Sample data loaded successfully. Context generation in progress.",
                    "dataset_id": dataset_id,
                    "dataset_info": info,
                    "context_status": "pending",
                    "context_reused": False
                }
        else:
            # First time loading sample for this user
            # Check if ANY user has generated context for this sample (to share context)
            any_sample_with_context = db.query(DatasetModel).filter(
                DatasetModel.filename == "housing_sample.csv",
                DatasetModel.context_status == "completed",
                DatasetModel.context.isnot(None)
            ).first()
            
            # Create new database record for this user
            db_dataset = DatasetModel(
                user_id=current_user.id,
                dataset_id=dataset_id,
                filename="housing_sample.csv",
                row_count=len(df),
                column_count=len(df.columns),
                file_size_bytes=sample_file.stat().st_size,
                context_status="pending"
            )
            
            # If we found a pre-generated context from another user, copy it
            if any_sample_with_context:
                db_dataset.context = any_sample_with_context.context
                db_dataset.context_status = "completed"
                db_dataset.context_generated_at = datetime.utcnow()
                db_dataset.columns_info = any_sample_with_context.columns_info
            
            db.add(db_dataset)
            db.commit()
            db.refresh(db_dataset)
            
            # Store in in-memory data store (for fast access)
            info = dataset_service.store_dataset(
                user_id=current_user.id,
                dataset_id=dataset_id,
                df=df,
                filename="housing_sample.csv"
            )
            
            # Load existing context into memory if we copied it
            if db_dataset.context_status == "completed":
                if current_user.id in dataset_service._store and dataset_id in dataset_service._store[current_user.id]:
                    dataset_service._store[current_user.id][dataset_id]["context"] = db_dataset.context
                    dataset_service._store[current_user.id][dataset_id]["context_status"] = "completed"
                
                return {
                    "message": "Sample data loaded successfully with pre-generated context.",
                    "dataset_id": dataset_id,
                    "dataset_info": info,
                    "context_status": "completed",
                    "context_reused": True
                }
            else:
                # Generate context asynchronously (updates both DB and memory)
                asyncio.create_task(
                    dataset_service.generate_context_async(dataset_id, df.copy(), current_user.id)
                )
                
                return {
                    "message": "Sample data loaded successfully. Context generation in progress.",
                    "dataset_id": dataset_id,
                    "dataset_info": info,
                    "context_status": "pending",
                    "context_reused": False
                }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading sample data: {str(e)}"
        )


@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload CSV/Excel data file for processing with robust parsing.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    allowed_extensions = ['.csv', '.xlsx', '.xls']
    file_extension = file.filename.lower().split('.')[-1]
    
    if f'.{file_extension}' not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail="File must be CSV or Excel format"
        )
    
    # Create temporary file for robust processing
    temp_file = None
    try:
        # Read file content
        content = await file.read()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Use robust file processor
        processor = FileProcessor(temp_file_path)
        
        # Parse based on file type
        if file_extension == 'csv':
            df = processor.read_csv()
        else:  # Excel files
            df = processor.read_excel()
        
        # Automatically convert data types (numeric, datetime, etc.)
        df = auto_convert_datatypes(df)
        
        # Replace NaN with None (which becomes null in JSON)
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # Generate unique dataset ID
        dataset_id = f"upload_{uuid.uuid4().hex[:8]}"
        
        # Create database record FIRST for persistence
        db_dataset = DatasetModel(
            user_id=current_user.id,
            dataset_id=dataset_id,
            filename=file.filename,
            row_count=len(df),
            column_count=len(df.columns),
            file_size_bytes=len(content),
            context_status="pending"
        )
        db.add(db_dataset)
        db.commit()
        db.refresh(db_dataset)
        
        # Store in in-memory data store (for fast access during session)
        info = dataset_service.store_dataset(
            user_id=current_user.id,
            dataset_id=dataset_id,
            df=df,
            filename=file.filename
        )
        
        # Generate context asynchronously (with user_id for DB updates)
        asyncio.create_task(
            dataset_service.generate_context_async(dataset_id, df.copy(), current_user.id)
        )
        
        # Basic data info
        data_info = {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "data_types": df.dtypes.astype(str).to_dict(),
            "preview": df.head(5).to_dict('records'),
            "file_size_bytes": len(content),
            "processing_method": "robust_parser",
            "context_status": "pending"
        }
        
        return {
            "message": "File uploaded successfully. Context generation in progress.",
            "user_id": current_user.id,
            "dataset_id": dataset_id,
            "file_info": data_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Error processing file: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except:
                pass


@router.get("/datasets/{dataset_id}/context")
def get_dataset_context(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the generated context for a dataset"""
    dataset = db.query(DatasetModel).filter(
        DatasetModel.dataset_id == dataset_id,
        DatasetModel.user_id == current_user.id
    ).first()
    
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "dataset_id": dataset_id,
        "filename": dataset.filename,
        "context": dataset.context,
        "context_status": dataset.context_status,
        "context_generated_at": dataset.context_generated_at.isoformat() if dataset.context_generated_at else None,
        "columns_info": dataset.columns_info,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "created_at": dataset.created_at.isoformat()
    }


@router.get("/datasets")
def list_user_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all datasets for the current user"""
    datasets = db.query(DatasetModel).filter(
        DatasetModel.user_id == current_user.id
    ).order_by(DatasetModel.created_at.desc()).all()
    
    return {
        "datasets": [
            {
                "dataset_id": ds.dataset_id,
                "filename": ds.filename,
                "row_count": ds.row_count,
                "column_count": ds.column_count,
                "context_status": ds.context_status,
                "created_at": ds.created_at.isoformat()
            }
            for ds in datasets
        ]
    }


@router.get("/datasets/{dataset_id}")
async def get_dataset_info(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get information about a specific dataset.
    """
    info = dataset_service.get_dataset_info(current_user.id, dataset_id)
    
    if not info:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return info


@router.get("/datasets/{dataset_id}/preview")
async def get_dataset_preview(
    dataset_id: str,
    rows: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a preview of the dataset (first N rows).
    """
    df = dataset_service.get_dataset(current_user.id, dataset_id)
    
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Replace NaN with None (which becomes null in JSON)
    df_clean = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    
    return {
        "dataset_id": dataset_id,
        "preview": df_clean.head(rows).to_dict('records'),
        "total_rows": len(df)
    }


@router.get("/datasets/{dataset_id}/full")
async def get_full_dataset(
    dataset_id: str,
    limit: Optional[int] = 5000,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the full dataset (or limited number of rows).
    Use this for visualizations that need complete data.
    
    Args:
        dataset_id: The dataset identifier
        limit: Optional limit on number of rows (default: 5000, use 0 for unlimited)
    """
    df = dataset_service.get_dataset(current_user.id, dataset_id)
    
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Store original row count
    total_rows = len(df)


    
    # Apply limit (default 5000 rows for performance)
    # Use limit=0 in query params to get unlimited rows
    if total_rows > limit:
        df = df.sample(n=limit) 
    
    # Replace NaN with None (which becomes null in JSON)
    df_clean = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    
    return {
        "dataset_id": dataset_id,
        "data": df_clean.to_dict('records'),
        "rows": len(df_clean),
        "columns": df_clean.columns.tolist(),
        "total_rows_in_dataset": total_rows,
        "limited": len(df_clean) < total_rows
    }


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a dataset.
    """
    success = dataset_service.delete_dataset(current_user.id, dataset_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "message": "Dataset deleted successfully",
        "dataset_id": dataset_id
    }


@router.post("/datasets/{dataset_id}/prepare-context")
async def prepare_dataset_context(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Proactively trigger context generation for a dataset.
    Call this when user starts typing to ensure context is ready.
    """
    # Check if context already exists or is being generated
    status = dataset_service.get_context_status(current_user.id, dataset_id)
    
    if status in ["completed", "generating"]:
        return {
            "message": "Context already available or in progress",
            "status": status
        }
    
    # Get the dataset
    df = dataset_service.get_dataset(current_user.id, dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Trigger context generation if pending or failed
    if status in ["pending", "failed", "not_found"]:
        asyncio.create_task(
            dataset_service.generate_context_async(dataset_id, df.copy(), current_user.id)
        )
        return {
            "message": "Context generation started",
            "status": "generating"
        }
    
    return {
        "message": "Context status checked",
        "status": status
    }


@router.post("/analyze")
async def analyze_data(
    request: FirstQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initial visualization generation endpoint - used for first chart after upload.
    Generates a complete D3.js visualization from natural language query.
    """
    # Get the dataset
    if request.dataset_id:
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        dataset_id = request.dataset_id
    else:
        # Use the most recent dataset
        result = dataset_service.get_latest_dataset(current_user.id)
        if result is None:
            raise HTTPException(
                status_code=400,
                detail="No dataset available. Please upload a file first."
            )
        dataset_id, df = result
    
    # Get the dataset context from memory
    dataset_context = dataset_service.get_context(current_user.id, dataset_id)
    
    # If context not available yet, provide basic fallback info
    if not dataset_context:
        columns = [str(col) for col in df.columns.tolist()]
        dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
    
    # Generate chart specification using DSPy agents with context
    from ..services.chart_creator import generate_chart_spec

    query = request.query + "/n use these colors "+ str(request.color_theme)
    
    try:
        chart_spec = await generate_chart_spec(df, query, dataset_context)
        
        return {
            "message": "Chart generated successfully",
            "query": request.query,
            "dataset_id": dataset_id,
            "chart_spec": chart_spec
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating chart: {str(e)}"
        )


@router.post("/chat")
async def chat_with_data(
    request: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Conversational refinement endpoint - used after initial visualization.
    Allows users to refine, modify, or ask questions about existing visualizations.
    """
    # Get the dataset
    if request.dataset_id:
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        dataset_id = request.dataset_id
    else:
        # Use the most recent dataset
        result = dataset_service.get_latest_dataset(current_user.id)
        if result is None:
            raise HTTPException(
                status_code=400,
                detail="No dataset available. Please upload a file first."
            )
        dataset_id, df = result
    
    # Get the dataset context from memory
    dataset_context = dataset_service.get_context(current_user.id, dataset_id)
    
    # If context not available yet, provide basic fallback info
    if not dataset_context:
        columns = [str(col) for col in df.columns.tolist()]
        dataset_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
    
    # Generate chart specification using DSPy agents with context
    from ..services.chart_creator import generate_chart_spec
    
    try:
        chart_spec = await generate_chart_spec(df, request.query, dataset_context)
        
        return {
            "message": "Visualization updated",
            "query": request.query,
            "dataset_id": dataset_id,
            "chart_spec": chart_spec
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating visualization: {str(e)}"
        )
def d3_fix_metric(example, pred, trace=None) -> float:
    """
    Metric for DSPy Refine to evaluate D3.js error fixes.
    
    Args:
        example: Contains 'd3_code' and 'error'
        pred: Contains 'fix'
    
    Returns:
        float: Score between 0.0 and 1.0
    """
    # Handle both dict and object inputs
    original_code = example.get('d3_code') if isinstance(example, dict) else example.d3_code
    error_message = example.get('error') if isinstance(example, dict) else example.error
    fixed_code = pred.get('fix') if isinstance(pred, dict) else (pred.fix if hasattr(pred, 'fix') else pred)
    
    score = 0.0
    
    # 1. Code was modified (0.1)
    if fixed_code.strip() != original_code.strip():
        score += 0.1
    else:
        return 0.0
    
    # 2. Common D3 error patterns (0.3)
    error_lower = error_message.lower()
    
    if "cannot read property" in error_lower or "undefined" in error_lower:
        if "d3.select" in fixed_code or "d3.selectAll" in fixed_code:
            score += 0.1
        if ".empty()" in fixed_code or "if (" in fixed_code:
            score += 0.1
    
    if "is not a function" in error_lower:
        if re.search(r"\.attr\s*\(|\.style\s*\(|\.append\s*\(|\.data\s*\(", fixed_code):
            score += 0.1
    
    if "d3.scale" in error_lower or "d3.svg" in error_lower:
        if "d3.scaleLinear" in fixed_code or "d3.scaleOrdinal" in fixed_code:
            score += 0.1
    
    # 3. D3 best practices (0.3)
    if re.search(r"\.data\s*\([^)]+\)", fixed_code):
        score += 0.075
    if re.search(r"\.enter\s*\(\s*\)", fixed_code):
        score += 0.075
    if re.search(r"\.exit\s*\(\s*\)\.remove\s*\(\s*\)", fixed_code):
        score += 0.075
    if re.search(r"function\s*\(d\)|d\s*=>|datum", fixed_code):
        score += 0.075
    
    # 4. Error terms addressed (0.3)
    error_terms = re.findall(r"'(\w+)'|\"(\w+)\"|`(\w+)`", error_message)
    error_terms = [t for group in error_terms for t in group if t]
    
    if error_terms:
        changes_count = sum(1 for term in error_terms if term in fixed_code)
        score += 0.3 * (changes_count / len(error_terms))
    
    return min(score, 1.0)

def extract_error_context(d3_code, error_message):
    """
    Extract 5 lines above and below the error line from D3 code.
    Returns the relevant context with line numbers for easier debugging.
    """
    import re
    
    lines = d3_code.split('\n')
    
    # Try to extract line number from various error message formats
    error_line = None
    
    # Pattern 1: "line X" or "at line X"
    line_match = re.search(r'(?:at\s+)?line\s+(\d+)', error_message, re.IGNORECASE)
    if line_match:
        error_line = int(line_match.group(1)) - 1  # Convert to 0-indexed
    
    # Pattern 2: "Line X:" format
    elif re.search(r'Line\s+(\d+):', error_message, re.IGNORECASE):
        line_match = re.search(r'Line\s+(\d+):', error_message, re.IGNORECASE)
        error_line = int(line_match.group(1)) - 1
    
    # Pattern 3: Column:Line format (e.g., "15:23" means line 15, column 23)
    elif re.search(r'(\d+):\d+', error_message):
        line_match = re.search(r'(\d+):\d+', error_message)
        error_line = int(line_match.group(1)) - 1
    
    # Pattern 4: Look for specific error patterns in the code itself
    else:
        # Common D3 error patterns to look for in code
        error_patterns = [
            r'\.select\([^)]*\)\s*$',  # Incomplete select statements
            r'\.append\([^)]*\)\s*$',  # Incomplete append statements
            r'undefined',              # Undefined variables
            r'null\s*\.',             # Null reference errors
        ]
        
        for i, line in enumerate(lines):
            for pattern in error_patterns:
                if re.search(pattern, line.strip()):
                    error_line = i
                    break
            if error_line is not None:
                break
    
    # If we still can't find the error line, return a portion of the code
    if error_line is None or error_line >= len(lines):
        # Return middle portion of code if error location unknown
        mid_point = len(lines) // 2
        start = max(0, mid_point - 5)
        end = min(len(lines), mid_point + 6)
        error_line = mid_point
    else:
        # Calculate start and end lines (5 above, 5 below)
        start = max(0, error_line - 5)
        end = min(len(lines), error_line + 6)
    
    # Build context with line numbers and error highlighting
    context_lines = []
    for i in range(start, end):
        line_num = i + 1
        line_content = lines[i] if i < len(lines) else ""
        
        if i == error_line:
            context_lines.append(f">>> Line {line_num}: {line_content}")
        else:
            context_lines.append(f"    Line {line_num}: {line_content}")
    
    return '\n'.join(context_lines)


@router.post("/fix-visualization")
async def fix_visualization_error(
    request: FixVisualizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fix a failed visualization by analyzing the error and regenerating corrected D3 code.
    
    Args:
        request: Contains the original D3 code and error message
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Request data with extracted error context for you to implement the module logic
    """
    # try:
        
        
    # Extract only the relevant error context (5 lines above/below error)
    error_context = extract_error_context(request.d3_code, request.error_message)
    # Use Claude for D3 code fixing, async thread-safe execution (like deep_coder example)
    lm = dspy.Claude(model="claude-3-7-sonnet-latest", api_key=os.getenv("ANTHROPIC_API_KEY"), max_tokens=4000)

    print(dspy.settings.lm)

    logger.info("Starting D3 code fixing with GPT-4o-mini...")
    start_time = datetime.now()
    logger.info(f"Code fixing started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    refine_fixer = dspy.Refine(module=dspy.Predict(fix_d3), reward_fn=d3_fix_metric, N=5, threshold=0.7)

    def run_refine_fixer():
        with dspy.settings.context(lm=lm):
            return refine_fixer(d3_code=error_context, error=request.error_message)

    response = await asyncio.to_thread(run_refine_fixer)
    # lm = dspy.LM('openai/gpt-4o-mini', max_tokens=3000, api_key= os.getenv("OPENAI_API_KEY"))

    # with dspy.settings.context(lm=lm):
    

    fix_code = response.fix
    
    # Strip markdown formatting if present
    if fix_code.startswith('```javascript'):
        fix_code = fix_code.replace('```javascript', '').replace('```', '').strip()
    elif fix_code.startswith('```js'):
        fix_code = fix_code.replace('```js', '').replace('```', '').strip()
    elif fix_code.startswith('```'):
        fix_code = fix_code.replace('```', '').strip()

    # Stitch the fix to the original code at the error location
    original_lines = request.d3_code.splitlines()
    error_lines = error_context.splitlines()
    # Find the error line in the context (marked by >>> Line X:)
    error_line_nums = [
        int(line.split(':')[0].replace('>>> Line', '').strip())
        for line in error_lines if line.startswith('>>> Line')
    ]
    if error_line_nums:
        fix_insertion_idx = error_line_nums[0] - 1  # 0-indexed
        # Replace just the error line with fix_code, keep rest
        stitched_lines = []
        for i, line in enumerate(original_lines):
            if i == fix_insertion_idx:
                stitched_lines.append(fix_code)
            else:
                stitched_lines.append(line)
        stitched_code = '\n'.join(stitched_lines)
    else:
        # If cannot localize, just return the fix as whole
        stitched_code = fix_code

    
    logger.info("Extracted error context for D3 code fix")
    
    return {
        "fixed_complete_code": stitched_code,  
        "user_id": current_user.id,
        "fix_failed": False
    }
    
    # except Exception as e:
    #     logger.error(f"Error fixing D3 visualization: {str(e)}")
        
    #     # Check for specific DSPy errors
    #     error_msg = str(e)
        
    #     # Fallback to original code if fixing fails
    #     return {
    #         "fixed_complete_code": request.d3_code,  # Return original code as fallback
    #         "user_id": current_user.id,
    #         "fix_failed": True,
    #         "error_reason": error_msg,
    #         "original_error_message": request.error_message
    #     }


@router.get("/dashboard-count")
async def get_dashboard_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get count of dashboards per user.
    """
    # Count datasets as dashboards for now
    datasets = dataset_service.list_datasets(current_user.id)
    
    return {
        "user_id": current_user.id,
        "dashboard_count": len(datasets),
        "message": "Dashboard count endpoint ready"
    }
