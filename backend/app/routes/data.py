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
import plotly.graph_objects as go
import plotly

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
from ..services.agents import fix_plotly, clean_plotly_code, plotly_editor
from ..services.chart_creator import execute_plotly_code
from ..services.credit_service import credit_service
from ..middleware.credit_check import require_credits, CreditCheckResult
import logging
import re
import dspy

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)


router = APIRouter(prefix="/api/data", tags=["data"])


# Automatic data type conversion functions
def restore_headers_if_lost(df: pd.DataFrame) -> pd.DataFrame:
    """
    If column names are numeric (likely lost headers), try to promote the first row
    to headers when it looks like valid names. Always normalize columns to strings.
    """
    try:
        if df is None or df.empty:
            return df
        numeric_like = all(isinstance(c, (int, np.integer)) for c in df.columns)
        if numeric_like and len(df) > 0:
            first_row = df.iloc[0]
            proposed = [str(v).strip() for v in first_row.tolist()]
            unique = len(set(proposed)) == len(proposed)
            looks_textual = any(any(ch.isalpha() for ch in name) for name in proposed)
            # Avoid promoting if many empty names
            non_empty_ratio = sum(1 for n in proposed if n) / max(1, len(proposed))
            if unique and looks_textual and non_empty_ratio > 0.7:
                df = df.iloc[1:].reset_index(drop=True)
                df.columns = proposed
        # Ensure columns are strings
        df.columns = [str(c) for c in df.columns]
        return df
    except Exception:
        try:
            df.columns = [str(c) for c in df.columns]
        except Exception:
            pass
        return df

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
                    logger.info(f"Converted '{col_name}' to numeric (float)")
                    return converted
        
        return series
        
    except Exception as e:
        logger.warning(f"Could not convert '{col_name}' to numeric: {e}")
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
            logger.info(f"Converted '{col_name}' to datetime")
            return converted
        
        return series
        
    except Exception as e:
        logger.warning(f"Could not convert '{col_name}' to datetime: {e}")
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
        # Ensure col is a string for name checking
        col_name = str(col)
        
        # Check if column name suggests it's a date/time column
        if any(keyword in col_name.lower() for keyword in ['date', 'time', 'datetime', 'timestamp']):
            df[col] = try_convert_to_datetime(df[col], col_name)
        
        # Try to convert string columns with numbers to float
        elif df[col].dtype == 'object':
            df[col] = try_convert_to_numeric(df[col], col_name)
    
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


class EditChartRequest(BaseModel):
    chart_index: int
    edit_request: str
    current_code: str
    dataset_id: str


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
        encodings = [
            'utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'ascii',
            'iso-8859-1', 'iso-8859-2', 'iso-8859-3', 'iso-8859-4', 'iso-8859-5',
            'iso-8859-6', 'iso-8859-7', 'iso-8859-8', 'iso-8859-9', 'iso-8859-15',
            'cp1250', 'cp1251', 'cp1254', 'cp1255', 'cp1256', 'cp1257',
            'cp932', 'shift_jis', 'euc-jp', 'euc-kr',
            'gb2312', 'gbk', 'gb18030', 'big5', 'mac-roman',
            'koi8-r', 'koi8-u'
        ]
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
                        encoding_errors='ignore'  # Skip undecodable bytes rather than replace
                    )
                    
                    # Check if we got meaningful data (more than 1 column)
                    if self.df.shape[1] > 1:
                        print(f"Successfully read CSV with encoding={encoding}, delimiter='{delimiter}'")
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
                header=None,
                encoding_errors='ignore'
            )
            # Attempt to promote first row to headers if they look like column names
            try:
                self.df = restore_headers_if_lost(self.df)
            except Exception:
                pass
            print("Read CSV as single column (may need manual parsing)")
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
                print(f"Successfully read Excel with engine={engine}")
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
                filename="housing_sample.csv",
                file_type="csv"
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
                filename="housing_sample.csv",
                file_type="csv"
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
        
        # Parse based on file type
        if file_extension == 'csv':
            # CSV files - single DataFrame
            processor = FileProcessor(temp_file_path)
            df = processor.read_csv()
            
            # Automatically convert data types
            df = auto_convert_datatypes(df)
            
            # Replace NaN with None
            df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            file_type = "csv"
            total_rows = len(df)
            total_columns = len(df.columns)
            
        else:  # Excel files - read all sheets
            import io as iolib
            
            # Read all sheets from Excel
            excel_file = pd.ExcelFile(iolib.BytesIO(content))
            sheet_names = excel_file.sheet_names
            
            datasets_dict = {}
            for sheet_name in sheet_names:
                try:
                    # Read each sheet
                    sheet_df = pd.read_excel(iolib.BytesIO(content), sheet_name=sheet_name)
                    
                    # Preprocessing
                    sheet_df.dropna(how='all', inplace=True)  # Drop empty rows
                    sheet_df.dropna(how='all', axis=1, inplace=True)  # Drop empty columns
                    
                    # Clean column names
                    if not sheet_df.empty:
                        sheet_df.columns = sheet_df.columns.str.strip()
                    
                    # Skip empty sheets
                    if sheet_df.empty:
                        continue
                    
                    # Replace NaN/inf
                    sheet_df = sheet_df.replace({np.nan: None, np.inf: None, -np.inf: None})
                    
                    # Auto-convert datatypes
                    sheet_df = auto_convert_datatypes(sheet_df)
                    
                    datasets_dict[sheet_name] = sheet_df
                    
                except Exception as e:
                    logger.warning(f"Error processing sheet '{sheet_name}': {str(e)}")
                    continue
            
            # Use dict of DataFrames for multi-sheet Excel
            df = datasets_dict if len(datasets_dict) > 1 else list(datasets_dict.values())[0]
            file_type = "excel"
            
            # Calculate total rows and columns
            if isinstance(df, dict):
                total_rows = sum(len(sheet_df) for sheet_df in df.values())
                total_columns = len(list(df.values())[0].columns) if df else 0
            else:
                total_rows = len(df)
                total_columns = len(df.columns)
        
        # Generate unique dataset ID
        dataset_id = f"upload_{uuid.uuid4().hex[:8]}"
        
        # Create database record FIRST for persistence
        db_dataset = DatasetModel(
            user_id=current_user.id,
            dataset_id=dataset_id,
            filename=file.filename,
            row_count=total_rows,
            column_count=total_columns,
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
            filename=file.filename,
            file_type=file_type
        )
        
        # Generate context asynchronously (with user_id for DB updates)
        df_copy = {k: v.copy() for k, v in df.items()} if isinstance(df, dict) else df.copy()
        asyncio.create_task(
            dataset_service.generate_context_async(dataset_id, df_copy, current_user.id)
        )
        
        # Basic data info - handle both dict and DataFrame
        if isinstance(df, dict):
            # Multi-sheet Excel
            first_sheet = list(df.values())[0]
            data_info = {
                "dataset_id": dataset_id,
                "filename": file.filename,
                "file_type": file_type,
                "is_multisheet": True,
                "sheet_names": list(df.keys()),
                "rows": total_rows,
                "columns": total_columns,
                "column_names": first_sheet.columns.tolist(),
                "data_types": first_sheet.dtypes.astype(str).to_dict(),
                "preview": first_sheet.head(5).to_dict('records'),
                "file_size_bytes": len(content),
                "processing_method": "robust_parser",
                "context_status": "pending"
            }
        else:
            # CSV or single-sheet Excel
            data_info = {
                "dataset_id": dataset_id,
                "filename": file.filename,
                "file_type": file_type,
                "is_multisheet": False,
                "sheet_names": None,
                "rows": total_rows,
                "columns": total_columns,
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
    
    # Get first sheet (df is now always a dict)
    sheet_names = list(df.keys())
    first_sheet = df[sheet_names[0]]
    
    # Replace NaN with None (which becomes null in JSON)
    df_clean = first_sheet.replace({np.nan: None, np.inf: None, -np.inf: None})
    
    return {
        "dataset_id": dataset_id,
        "preview": df_clean.head(rows).to_dict('records'),
        "total_rows": len(first_sheet),
        "sheet_name": sheet_names[0]
    }


@router.get("/datasets/{dataset_id}/full")
async def get_full_dataset(
    dataset_id: str,
    limit: Optional[int] = 1000,
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
    
    # Get first sheet (df is now always a dict)
    sheet_names = list(df.keys())
    first_sheet = df[sheet_names[0]]
    
    # Store original row count
    total_rows = len(first_sheet)
    
    # Replace NaN with None (which becomes null in JSON)
    df_clean = first_sheet.replace({np.nan: None, np.inf: None, -np.inf: None})
    
    return {
        "dataset_id": dataset_id,
        "data": df_clean.to_dict('records'),
        "rows": len(df_clean),
        "columns": df_clean.columns.tolist(),
        "total_rows_in_dataset": total_rows,
        "sheet_name": sheet_names[0],
        "available_sheets": sheet_names
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
    credits: CreditCheckResult = Depends(require_credits(5)),
    db: Session = Depends(get_db)
):
    """
    Initial visualization generation endpoint - used for first chart after upload.
    Generates Plotly visualizations from natural language query.
    
    Costs: 5 credits per analysis
    """
    current_user = credits.user
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
    # df is always a dict now
    if not dataset_context:
        sheet_names = list(df.keys())
        first_sheet = df[sheet_names[0]]
        columns = [str(col) for col in first_sheet.columns.tolist()]
        dataset_context = f"Dataset with {len(first_sheet)} rows and {len(first_sheet.columns)} columns. Columns: {', '.join(columns)}. Available sheets: {', '.join(sheet_names)}"
    
    # Generate chart specification using DSPy agents with context
    from ..services.chart_creator import generate_chart_spec

    query = request.query + "/n use these colors "+ str(request.color_theme)
    
    # try:
    chart_specs, full_plan, dashboard_title = await generate_chart_spec(
        df=df, 
        query=query, 
        dataset_context=dataset_context,
        user_id=current_user.id,
        dataset_id=dataset_id
    )
    
    # Store chart metadata including plans
    if isinstance(chart_specs, list):
        for chart in chart_specs:
            chart_index = chart.get('chart_index', 0)
            chart_spec = chart.get('chart_spec', '')
            chart_plan = chart.get('plan', full_plan)  # Use chart-specific plan or fallback to full plan
            figure_data = chart.get('figure')
            chart_type = chart.get('chart_type')
            title = chart.get('title', 'Visualization')
            
            try:
                dataset_service.set_chart_metadata(
                    user_id=current_user.id,
                    dataset_id=dataset_id,
                    chart_index=chart_index,
                    chart_spec=chart_spec,
                    plan=chart_plan,
                    figure_data=figure_data,
                    chart_type=chart_type,
                    title=title
                )
            except Exception as e:
                logger.warning(f"Failed to store chart metadata for chart {chart_index}: {e}")
        
        # Deduct credits after successful analysis
        credit_service.deduct_credits(
            db, 
            current_user.id, 
            5, 
            f"Data analysis: {request.query[:100]}",
            metadata={"dataset_id": dataset_id, "chart_count": len(chart_specs)}
        )
        
        return {
            "message": f"{len(chart_specs)} chart(s) generated successfully",
            "query": request.query,
            "dataset_id": dataset_id,
            "dashboard_title": dashboard_title,
            "charts": chart_specs  # Array of chart specs
        }
    else:
        # Backward compatibility for single chart
        # Deduct credits after successful analysis
        credit_service.deduct_credits(
            db, 
            current_user.id, 
            5, 
            f"Data analysis: {request.query[:100]}",
            metadata={"dataset_id": dataset_id}
        )
        
        return {
            "message": "Chart generated successfully",
            "query": request.query,
            "dataset_id": dataset_id,
            "chart_spec": chart_specs
        }
    # except Exception as e:
    #     raise HTTPException(
    #         status_code=500,
    #         detail=f"Error generating chart: {str(e)}"
    #     )


def plotly_fix_metric(example, pred, trace=None) -> float:
    """
    Simple code scorer that checks if Plotly code runs successfully.
    Penalizes code that tries to modify data or includes fig.show().
    
    Returns:
        float: Score (0.0=error, 1.0=success)
    """
    try:
        # Import clean_plotly_code and re for pattern matching
        from ..services.agents import clean_plotly_code
        import re
        
        # Handle both dict and object inputs
        original_code = example.get('plotly_code') if isinstance(example, dict) else example.plotly_code
        fixed_code = pred.get('fix') if isinstance(pred, dict) else (pred.fix if hasattr(pred, 'fix') else str(pred))
        
        # Clean the fixed code to remove fig.show() calls
        fixed_code = clean_plotly_code(fixed_code)
        
        # Comment out any remaining fig.show() calls before executing
        # This ensures they're visible but don't execute
        fixed_code = re.sub(r'(fig\.show\s*\([^)]*\))', r'# \1  # Commented out to prevent opening browser tab', fixed_code)
        fixed_code = re.sub(r'(\.show\s*\(\s*\))', r'# \1  # Commented out to prevent opening browser tab', fixed_code)
        fixed_code = re.sub(r'(plotly\.io\.show\([^)]*\))', r'# \1  # Commented out to prevent opening browser tab', fixed_code)
        fixed_code = re.sub(r'(pio\.show\([^)]*\))', r'# \1  # Commented out to prevent opening browser tab', fixed_code)
        
        # If code wasn't modified, return 0
        if fixed_code.strip() == original_code.strip():
            return 0.0
        
        # Check if code tries to modify/load data (should use existing df/data)
        data_modification_patterns = [
            r'pd\.read_csv\s*\(',
            r'pd\.read_excel\s*\(',
            r'pd\.read_',
            r'pd\.DataFrame\s*\(',
            r'data\s*=\s*pd\.',
            r'df\s*=\s*pd\.',
            r'data\s*=\s*data\[',  # Reassigning data
            r'df\s*=\s*data\s*$',  # Reassigning df from data
        ]
        
        for pattern in data_modification_patterns:
            if re.search(pattern, fixed_code, re.MULTILINE | re.IGNORECASE):
                # Penalize heavily - this will trigger retry
                return 0.0
        
        # Create no-op functions to prevent show() calls
        def noop_show(*args, **kwargs):
            pass
        
        def noop_display(*args, **kwargs):
            pass
        
        # Try to execute the fixed code
        exec_globals = {
            'pd': pd,
            'np': np,
            'go': go,
            'plotly': plotly,
            'show': noop_show,
            'display': noop_display,
        }
        
        # Try to import plotly.express
        try:
            import plotly.express as px
            exec_globals['px'] = px
        except:
            pass
        
        # Execute the code to test if it works
        exec(fixed_code, exec_globals)
        
        # Check if 'fig' variable was created
        if 'fig' in exec_globals:
            return 1.0  # Success
        else:
            return 0.0  # No figure created
            
    except Exception as e:
        return 0.0  # Error during execution

def extract_error_context(plotly_code, error_message):
    """
    Extract a broader error context around the suspected error location,
    but return ONLY raw code lines (no "Line X:" markers).
    Default: 15 lines before and 15 lines after. Falls back to a middle slice.
    """
    import re
    
    lines = plotly_code.split('\n')
    
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
        # Common Plotly error patterns to look for in code
        error_patterns = [
            r'go\.Figure\([^)]*\)',     # Incomplete Figure creation
            r'px\.(bar|scatter|line|histogram)',  # Incomplete Plotly Express calls
            r'\.add_trace\([^)]*\)',    # Incomplete add_trace calls
            r'\.update_layout\([^)]*\)', # Incomplete update_layout calls
            r'undefined',               # Undefined variables
            r'None\s*\.',               # None reference errors
        ]
        
        for i, line in enumerate(lines):
            for pattern in error_patterns:
                if re.search(pattern, line.strip()):
                    error_line = i
                    break
            if error_line is not None:
                break
    
    # Window size around the error line
    window = 15

    # If we still can't find the error line, return a portion of the code
    if error_line is None or error_line >= len(lines):
        # Return middle portion of code if error location unknown
        mid_point = len(lines) // 2
        start = max(0, mid_point - window)
        end = min(len(lines), mid_point + window + 1)
        error_line = mid_point
    else:
        # Calculate start and end lines (window above and below)
        start = max(0, error_line - window)
        end = min(len(lines), error_line + window + 1)
    
    # Build plain code context (no line labels)
    context_lines = [lines[i] if i < len(lines) else "" for i in range(start, end)]
    return '\n'.join(context_lines)


@router.post("/fix-visualization")
async def fix_visualization_error(
    request: FixVisualizationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fix a failed visualization by analyzing the error and regenerating corrected Plotly code.
    Executes the fixed code and returns the figure data for immediate display.
    
    Args:
        request: Contains the original Plotly code, error message, and dataset_id
        current_user: Authenticated user
        db: Database session
    
    Returns:
        Fixed Plotly code AND executed figure data for immediate display
    """
    try:
        # Extract error context (5 lines above/below error)
        error_context = extract_error_context(request.plotly_code, request.error_message)
        logger.info(f"Extracted error context:\n{error_context}")

        # Use Claude for code fixing
        lm = dspy.LM("anthropic/claude-3-7-sonnet-latest", api_key=os.getenv("ANTHROPIC_API_KEY"), max_tokens=8000)

        logger.info("Starting Plotly code fixing...")
        start_time = datetime.now()
        logger.info(f"Code fixing started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

        refine_fixer = dspy.Refine(module=dspy.Predict(fix_plotly), reward_fn=plotly_fix_metric, N=5, threshold=0.3)
        logger.info("Refine fixer instantiated with dspy.Predict(fix_plotly)")

        def run_refine_fixer():
            logger.info("Calling Refine fixer...")
            with dspy.settings.context(lm=lm):
                # Truncate error message to 500 characters
                truncated_error = request.error_message[:500]
                result = refine_fixer(plotly_code=error_context, error=truncated_error)
                logger.info(f"Refine fixer result: {result}")
                return result

        response = await asyncio.to_thread(run_refine_fixer)
        fix_code = response.fix
        
        # Clean the fixed code using the utility function
        fix_code = clean_plotly_code(fix_code)

        # Stitch the fix to the original code at the error location
        original_lines = request.plotly_code.splitlines()
        error_lines = error_context.splitlines()
        
        # Find the error line in the context (marked by >>> Line X:)
        error_line_nums = [
            int(line.split(':')[0].replace('>>> Line', '').strip())
            for line in error_lines if line.startswith('>>> Line')
        ]
        
        if error_line_nums:
            fix_insertion_idx = error_line_nums[0] - 1  # 0-indexed
            # Replace the error line with fix_code
            stitched_lines = []
            for i, line in enumerate(original_lines):
                if i == fix_insertion_idx:
                    stitched_lines.append(fix_code)
                else:
                    stitched_lines.append(line)
            stitched_code = '\n'.join(stitched_lines)
        else:
            # If cannot localize, return the fix as whole
            stitched_code = fix_code
        
        # Clean the stitched code again to ensure no fig.show() calls remain
        stitched_code = clean_plotly_code(stitched_code)
        
        # Execute the fixed code to get figure data
        figure_data = None
        execution_success = False
        
        if request.dataset_id:
            try:
                # Get the dataset
                df = dataset_service.get_dataset(current_user.id, request.dataset_id)
                
                if df is not None:
                    # Execute the fixed code
                    execution_result = execute_plotly_code(stitched_code, df)
                    
                    if execution_result.get('success'):
                        figure_data = execution_result.get('figure')
                        execution_success = True
                        logger.info(f"Successfully executed fixed code for chart")
                    else:
                        logger.warning(f"Fixed code execution failed: {execution_result.get('error')[:200]}")
                else:
                    logger.warning(f"Dataset not found for user {current_user.id}, dataset_id: {request.dataset_id}")
            except Exception as exec_error:
                logger.error(f"Error executing fixed code: {str(exec_error)}")
        
        logger.info("Extracted error context for Plotly code fix")
        
        return {
            "fixed_complete_code": stitched_code,
            "figure": figure_data,
            "execution_success": execution_success,
            "user_id": current_user.id,
            "fix_failed": False
        }
    except Exception as e:
        logger.error(f"Error fixing Plotly visualization: {str(e)}")
        return {
            "fixed_complete_code": request.plotly_code,  # Return original code as fallback
            "user_id": current_user.id,
            "fix_failed": True,
            "error_reason": str(e),
            "original_error_message": request.error_message
        }
    
    # Old error handling code (kept for reference)
    # except Exception as e:
    #     logger.error(f"Error fixing Plotly visualization: {str(e)}")
    #     return {
    #         "fixed_complete_code": request.plotly_code,  # Return original code as fallback
    #         "user_id": current_user.id,
    #         "fix_failed": True,
    #         "error_reason": str(e),
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


@router.post("/execute-code")
async def execute_code(
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute code from chat endpoint - either plotly edit or analysis code.
    
    Costs: 2 credits per execution (both plotly_edit and analysis)
    """
    code = request.get("code")
    dataset_id = request.get("dataset_id")
    code_type = request.get("code_type")
    
    if not code or not code_type or not dataset_id:
        raise HTTPException(status_code=400, detail="Missing required parameters")
    
    # Check credits before execution (2 credits for both types)
    if not credit_service.check_sufficient_credits(db, current_user.id, 2):
        credits_info = credit_service.get_balance_info(db, current_user.id)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "insufficient_credits",
                "message": f"Insufficient credits. Required: 2, Available: {credits_info['balance']}",
                "required": 2,
                "balance": credits_info['balance']
            }
        )
    
    df = dataset_service.get_dataset(current_user.id, dataset_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if code_type == "plotly_edit":
        # Use the same function as /analyze
        from ..services.chart_creator import execute_plotly_code
        
        try:
            result = execute_plotly_code(code, df)
            
            if result.get("success"):
                # Deduct credits after successful execution
                credit_service.deduct_credits(
                    db,
                    current_user.id,
                    2,
                    "Plotly code execution",
                    metadata={"dataset_id": dataset_id, "code_type": "plotly_edit"}
                )
                return {
                    "success": True,
                    "code_type": "plotly_edit",
                    "figure": result.get("figure")
                }
            else:
                return {
                    "success": False,
                    "code_type": "plotly_edit",
                    "error": result.get("error")
                }
        except Exception as e:
            return {
                "success": False,
                "code_type": "plotly_edit",
                "error": str(e)
            }
    
    elif code_type == "analysis":
        # Execute analysis code with proper data setup
        try:
            import io
            import sys
            from contextlib import redirect_stdout
            import traceback
            import re
            
            # Validate code - check for forbidden imports
            forbidden_libraries = [
                'matplotlib', 'plotly', 'seaborn', 'bokeh', 'altair', 
                'holoviews', 'ggplot', 'pygal', 'dash', 'streamlit'
            ]
            
            # Check for import statements
            for lib in forbidden_libraries:
                # Match various import patterns
                if re.search(rf'\bimport\s+{lib}\b|\bfrom\s+{lib}\b', code, re.IGNORECASE):
                    return {
                        "success": False,
                        "code_type": "analysis",
                        "error": f"Error: Importing '{lib}' is not allowed in analysis mode. Please use only pandas and numpy for data analysis. For visualizations, use the chart editor instead."
                    }
            
            # Set up execution environment similar to execute_plotly_code
            sheet_names = list(df.keys())
            first_sheet_df = df[sheet_names[0]]
            
            exec_globals = {
                'pd': pd,
                'np': np,
                'json': json,
                'data': df,
                'df': first_sheet_df,  # Default df is first sheet
                '__builtins__': __builtins__,  # Required for exec
            }
            
            # Make all sheets available by their names
            for sheet_name, sheet_df in df.items():
                exec_globals[sheet_name] = sheet_df
            
            logger.info(f"Executing analysis code with {len(sheet_names)} sheet(s): {sheet_names}")
            logger.info(f"Analysis code:\n{code}")
            
            # Capture stdout (print statements)
            output_buffer = io.StringIO()
            
            with redirect_stdout(output_buffer):
                exec(code, exec_globals)
            
            # Collect results
            results = []
            section_count = 0
            
            # 1. Captured print output
            printed_output = output_buffer.getvalue()
            if printed_output.strip():
                section_count += 1
                # Add section header with emoji
                results.append(f"### Analysis Output\n\n{printed_output.strip()}")
            
            # 2. Check for 'result' variable
            if 'result' in exec_globals:
                result_val = exec_globals['result']
                section_count += 1
                
                if isinstance(result_val, pd.DataFrame):
                    # Format DataFrame as markdown table (first 20 rows)
                    df_preview = result_val.head(20)
                    row_info = f"{len(result_val)} rows x {len(result_val.columns)} columns"
                    if len(result_val) > 20:
                        row_info += f" (showing first 20)"
                    
                    results.append(
                        f"### Result\n\n"
                        f"*{row_info}*\n\n"
                        f"{df_preview.to_markdown(index=False)}"
                    )
                elif isinstance(result_val, pd.Series):
                    results.append(
                        f"### Result\n\n"
                        f"*{len(result_val)} values*\n\n"
                        f"{result_val.to_markdown()}"
                    )
                else:
                    results.append(f"### Result\n\n```\n{result_val}\n```")
            
            # 3. Check for 'display' or 'output' variables
            for var_name in ['display', 'output', 'summary']:
                if var_name in exec_globals and var_name not in ['pd', 'np', 'json', 'data', 'df'] and not var_name.startswith('_'):
                    val = exec_globals[var_name]
                    section_count += 1
                    
                    if isinstance(val, pd.DataFrame):
                        df_preview = val.head(20)
                        row_info = f"{len(val)} rows x {len(val.columns)} columns"
                        if len(val) > 20:
                            row_info += f" (showing first 20)"
                        
                        results.append(
                            f"### {var_name.title()}\n\n"
                            f"*{row_info}*\n\n"
                            f"{df_preview.to_markdown(index=False)}"
                        )
                    elif isinstance(val, pd.Series):
                        results.append(
                            f"### {var_name.title()}\n\n"
                            f"*{len(val)} values*\n\n"
                            f"{val.to_markdown()}"
                        )
                    else:
                        results.append(f"### {var_name.title()}\n\n```\n{val}\n```")
            
            # Combine all results with section dividers
            if results:
                final_result = "\n\n---\n\n".join(results)
            else:
                final_result = "Code executed successfully (no output)"
            
            logger.info(f"Analysis completed successfully. Output length: {len(final_result)}")
            
            # Deduct credits after successful execution
            credit_service.deduct_credits(
                db,
                current_user.id,
                2,
                "Data analysis code execution",
                metadata={"dataset_id": dataset_id, "code_type": "analysis"}
            )
            
            return {
                "success": True,
                "code_type": "analysis",
                "result": final_result
            }
        except Exception as e:
            import traceback
            error_msg = f"{str(e)}\n\n**Traceback:**\n```\n{traceback.format_exc()}\n```"
            logger.error(f"Analysis execution failed: {e}")
            return {
                "success": False,
                "code_type": "analysis",
                "error": error_msg
            }
    
    raise HTTPException(status_code=400, detail=f"Invalid code_type: {code_type}")


@router.post("/edit-chart")
async def edit_chart(
    request: EditChartRequest,
    credits: CreditCheckResult = Depends(require_credits(2)),
    db: Session = Depends(get_db)
):
    """
    Edit a chart using natural language instructions.
    Uses the plotly_editor DSPy module to generate edited code.
    
    Costs: 2 credits per edit
    """
    current_user = credits.user
    try:
        # Get dataset context
        data_context = dataset_service.get_context(current_user.id, request.dataset_id)
        
        if not data_context:
            # Provide basic fallback context if not available
            df = dataset_service.get_dataset(current_user.id, request.dataset_id)
            if df is None:
                raise HTTPException(status_code=404, detail="Dataset not found")
            
            if isinstance(df, dict):
                sheet_names = list(df.keys())
                first_sheet = df[sheet_names[0]]
                columns = [str(col) for col in first_sheet.columns.tolist()]
                data_context = f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet has {len(first_sheet)} rows and columns: {', '.join(columns)}"
            else:
                columns = [str(col) for col in df.columns.tolist()]
                data_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
        else:
            # Get dataset for execution
            df = dataset_service.get_dataset(current_user.id, request.dataset_id)
            if df is None:
                raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Call plotly_editor module with session LM
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1400)):
            editor = dspy.Predict(plotly_editor)
            result = editor(
                user_query=request.edit_request,
                plotly_code=request.current_code,
                dataset_context=data_context
            )
        
        # Clean the edited code
        edited_code = clean_plotly_code(result.edited_code)
        
        # Execute edited code to get figure
        execution_result = execute_plotly_code(edited_code, df)
        
        # Deduct credits after successful edit
        if execution_result.get('success'):
            credit_service.deduct_credits(
                db,
                current_user.id,
                2,
                f"Chart edit: {request.edit_request[:100]}",
                metadata={"dataset_id": request.dataset_id}
            )
        
        return {
            "edited_code": edited_code,
            "reasoning": getattr(result, 'reasoning', 'Chart edited successfully'),
            "figure": execution_result.get('figure'),
            "success": execution_result.get('success'),
            "error": execution_result.get('error') if not execution_result.get('success') else None
        }
        
    except Exception as e:
        logger.error(f"Error editing chart: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to edit chart: {str(e)}")


@router.get("/datasets/{dataset_id}/charts/{chart_index}")
async def get_chart_info(
    dataset_id: str,
    chart_index: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get chart metadata including plan, code, and figure for a specific chart.
    
    Args:
        dataset_id: Dataset identifier
        chart_index: Chart index (0, 1, 2, etc.)
    
    Returns:
        Dict with chart metadata including plan, code, type, title, and figure
    """
    metadata = dataset_service.get_chart_metadata(
        current_user.id,
        dataset_id,
        chart_index
    )
    
    if not metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Chart {chart_index} not found for dataset {dataset_id}"
        )
    
    return {
        "chart_index": chart_index,
        "dataset_id": dataset_id,
        "chart_spec": metadata.get("chart_spec"),
        "plan": metadata.get("plan"),
        "chart_type": metadata.get("chart_type"),
        "title": metadata.get("title"),
        "figure": metadata.get("figure"),
        "created_at": metadata.get("created_at")
    }


@router.post("/datasets/{dataset_id}/suggest-queries")
async def suggest_query(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a single AI-powered query suggestion based on dataset context.
    
    Args:
        dataset_id: Dataset identifier
    
    Returns:
        Dict with a single suggestion string
    """
    from ..services.agents import SuggestQueries
    
    # Initialize DSPy module locally
    quick_lm = dspy.LM('openai/gpt-4o-mini', max_tokens=100, api_key=os.getenv('OPENAI_API_KEY'))
    with dspy.context(lm=quick_lm):
        program = dspy.Predict(SuggestQueries)
        
        # Get dataset from memory
        data_dict = dataset_service.get_dataset(current_user.id, dataset_id)
        if not data_dict:
            raise HTTPException(404, "Dataset not in memory; please re-upload")
        
        # Extract first sheet/dataframe
        sheet_name, df = next(iter(data_dict.items()))
        
        # Create dataset context for DSPy
        dataset_context = df.head(5).to_markdown()
        
        # Generate single suggestion
        result = program(dataset_context=dataset_context)
        suggestion = str(result.suggestion).strip()
        
        return {"suggestion": suggestion +" - construct a dashboard showing this"}