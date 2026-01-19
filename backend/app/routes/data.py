from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
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
import plotly.io

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


def clean_dataframe_for_json(df):
    """Replace NaN, inf, and -inf with None for JSON serialization"""
    return df.replace({np.nan: None, np.inf: None, -np.inf: None})
from ..services.dataset_service import dataset_service
from ..schemas.chat import FixVisualizationRequest
from ..services.agents import fix_plotly, clean_plotly_code, plotly_editor, plotly_adder_sig, ChartInsightsSignature
from ..services.chart_creator import execute_plotly_code
from ..services.credit_service import credit_service
from ..middleware.credit_check import require_credits, CreditCheckResult
from ..services.chart_insights import extract_figure_metadata
import dspy
import logging
import re
import difflib
import ast

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)  # Changed from INFO to WARNING to reduce logging
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)


router = APIRouter(prefix="/api/data", tags=["data"])


# Column name sanitization function
def sanitize_column_name(col_name: str) -> str:
    """
    Clean column names from dangerous strings and characters.
    Removes SQL injection, XSS, command injection patterns, and other dangerous content.
    """
    if not col_name:
        return "column"
    
    # Convert to string and strip whitespace
    col_name = str(col_name).strip()
    
    # Remove null bytes and control characters
    col_name = ''.join(char for char in col_name if ord(char) >= 32 or char in ['\t', '\n', '\r'])
    
    # List of dangerous patterns to remove (case-insensitive)
    dangerous_patterns = [
        # SQL injection patterns
        r"';?\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)",
        r"UNION\s+SELECT",
        r"--.*",  # SQL comments
        r"/\*.*?\*/",  # SQL block comments
        r";\s*",  # SQL statement separator
        r"'\s*OR\s*'1'\s*=\s*'1",
        r"'\s*AND\s*'1'\s*=\s*'1",
        
        # XSS patterns
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",  # onclick=, onerror=, etc.
        r"<iframe[^>]*>",
        r"<img[^>]*onerror",
        r"<svg[^>]*onload",
        
        # Command injection patterns
        r"[|&;`$<>]",
        r"\$\{.*?\}",  # ${command}
        r"`.*?`",  # backticks
        
        # Path traversal
        r"\.\./",
        r"\.\.\\",
        
        # Other dangerous characters
        r"\x00",  # Null byte
        r"\r\n",  # Line breaks that could be dangerous
        r"\n",
        r"\r",
    ]
    
    # Remove dangerous patterns
    import re
    for pattern in dangerous_patterns:
        col_name = re.sub(pattern, '', col_name, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove any remaining dangerous characters
    dangerous_chars = ['<', '>', '"', "'", '&', '|', ';', '`', '$', '{', '}', '(', ')', '[', ']']
    for char in dangerous_chars:
        col_name = col_name.replace(char, '_')
    
    # Clean up: remove multiple underscores/spaces, strip
    col_name = re.sub(r'[_\s]+', '_', col_name)
    col_name = col_name.strip('_').strip()
    
    # Ensure it's not empty and doesn't start with a number
    if not col_name or col_name[0].isdigit():
        col_name = f"col_{col_name}" if col_name else "column"
    
    # Limit length to prevent abuse
    if len(col_name) > 100:
        col_name = col_name[:100]
    
    return col_name


def sanitize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Sanitize all column names in a DataFrame.
    """
    if df is None or df.empty:
        return df
    
    try:
        # Get sanitized column names
        sanitized_columns = [sanitize_column_name(col) for col in df.columns]
        
        # Handle duplicate column names after sanitization
        seen = {}
        final_columns = []
        for col in sanitized_columns:
            if col in seen:
                seen[col] += 1
                final_columns.append(f"{col}_{seen[col]}")
            else:
                seen[col] = 0
                final_columns.append(col)
        
        df.columns = final_columns
        return df
    except Exception as e:
        logger.warning(f"Error sanitizing column names: {str(e)}")
        # Fallback: just ensure columns are strings
        try:
            df.columns = [str(c).strip() for c in df.columns]
        except Exception:
            pass
        return df


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
        # Ensure columns are strings and sanitize them
        df.columns = [str(c) for c in df.columns]
        df = sanitize_dataframe_columns(df)
        return df
    except Exception:
        try:
            df.columns = [str(c) for c in df.columns]
            df = sanitize_dataframe_columns(df)
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

class EditKPIRequest(BaseModel):
    kpi_index: int
    edit_request: str
    current_code: str
    dataset_id: str
    current_title: str

class AddChartRequest(BaseModel):
    query: str
    dataset_id: str
    color_theme: Optional[str] = None

class AddKPIRequest(BaseModel):
    description: str  # What metric to show, e.g., "average price", "total sales"
    dataset_id: str


class ApplyFilterRequest(BaseModel):
    chart_index: int
    filters: Dict[str, Any]  # {column: {type: 'number'|'date'|'string', min?, max?, from?, to?, values?: []}}
    dataset_id: str
    original_code: str


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
        """
        Read CSV with fast delimiter detection and smart fallback for edge cases.
        Only performs expensive quality checks when initial parse yields <= 2 columns.
        """
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
        
        # Track results with <= 2 columns for potential retry
        poor_results = []
        
        # Try different encoding and delimiter combinations (FAST PATH)
        for encoding in encodings:
            for delimiter in delimiters:
                try:
                    self.df = pd.read_csv(
                        self.filepath,
                        encoding=encoding,
                        delimiter=delimiter,
                        on_bad_lines='skip',
                        engine='python',
                        low_memory=False,
                        encoding_errors='ignore'
                    )
                    
                    # If we got MORE than 2 columns, it's likely correct - return immediately
                    if self.df.shape[1] > 2:
                        self.df = sanitize_dataframe_columns(self.df)
                        logger.info(f"Successfully read CSV with encoding={encoding}, delimiter='{delimiter}', columns={self.df.shape[1]}")
                        return self.df
                    
                    # If 1-2 columns, save for potential retry (might be wrong delimiter)
                    elif self.df.shape[1] >= 1:
                        poor_results.append({
                            'df': self.df.copy(),
                            'encoding': encoding,
                            'delimiter': delimiter,
                            'columns': self.df.shape[1]
                        })
                        
                except Exception as e:
                    continue
        
        # SLOW PATH: If we only found results with <= 2 columns, do smarter detection
        if poor_results:
            logger.info(f"Only found {len(poor_results)} results with ≤2 columns. Trying smarter detection...")
            
            # Try all delimiters again with quality scoring
            best_result = None
            best_score = -1
            
            for encoding in encodings[:3]:  # Only try top 3 encodings to save time
                for delimiter in delimiters:
                    try:
                        # Read a sample to score quality
                        sample_df = pd.read_csv(
                            self.filepath,
                            encoding=encoding,
                            delimiter=delimiter,
                            nrows=50,  # Small sample for speed
                            on_bad_lines='skip',
                            engine='python',
                            encoding_errors='ignore'
                        )
                        
                        if sample_df.shape[1] > 1:
                            # Calculate quality score
                            num_cols = sample_df.shape[1]
                            avg_col_name_length = sum(len(str(col)) for col in sample_df.columns) / num_cols
                            non_null_ratio = sample_df.notna().sum().sum() / (sample_df.shape[0] * sample_df.shape[1])
                            
                            # Quality = more columns + reasonable names + data filled
                            quality = num_cols * 100
                            if avg_col_name_length < 100:  # Reasonable column names
                                quality += 50
                            quality += non_null_ratio * 50
                            
                            if quality > best_score:
                                # Read full file with this delimiter
                                full_df = pd.read_csv(
                                    self.filepath,
                                    encoding=encoding,
                                    delimiter=delimiter,
                                    on_bad_lines='skip',
                                    engine='python',
                                    low_memory=False,
                                    encoding_errors='ignore'
                                )
                                best_result = full_df
                                best_score = quality
                                logger.info(f"Better result found: delimiter='{delimiter}', columns={num_cols}, quality={quality:.1f}")
                                
                    except Exception:
                        continue
            
            # Use best result from smart detection
            if best_result is not None and best_result.shape[1] > 2:
                self.df = sanitize_dataframe_columns(best_result)
                return self.df
            
            # If smart detection still only found ≤2 columns, use the best poor result
            if poor_results:
                best_poor = max(poor_results, key=lambda x: x['columns'])
                self.df = sanitize_dataframe_columns(best_poor['df'])
                logger.warning(f"Using result with {best_poor['columns']} column(s): encoding={best_poor['encoding']}, delimiter='{best_poor['delimiter']}'")
                return self.df
        
        # Last resort: read as single column
        try:
            self.df = pd.read_csv(
                self.filepath,
                encoding='latin-1',
                engine='python',
                on_bad_lines='skip',
                header=None,
                encoding_errors='ignore'
            )
            
            try:
                self.df = restore_headers_if_lost(self.df)
                self.df = sanitize_dataframe_columns(self.df)
            except Exception:
                pass
                
            logger.warning("Read CSV as single column - file may need manual parsing")
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
                # Sanitize column names
                self.df = sanitize_dataframe_columns(self.df)
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
        clean_df = clean_dataframe_for_json(df)
        
        # Return data info
        return {
            "message": "Sample housing data loaded",
            "filename": "housing_sample.csv",
            "rows": len(df),
            "columns": df.columns.tolist(),
            "data": clean_df.to_dict('records'),
            "preview": clean_df.head(10).to_dict('records'),
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
        
        # Sanitize column names
        df = sanitize_dataframe_columns(df)
        
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
            
            # Sanitize column names
            df = sanitize_dataframe_columns(df)
            
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
                    
                    # Clean and sanitize column names
                    if not sheet_df.empty:
                        sheet_df.columns = sheet_df.columns.str.strip()
                        sheet_df = sanitize_dataframe_columns(sheet_df)
                    
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
            first_sheet_clean = clean_dataframe_for_json(first_sheet)
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
                "preview": first_sheet_clean.head(5).to_dict('records'),
                "file_size_bytes": len(content),
                "processing_method": "robust_parser",
                "context_status": "pending"
            }
        else:
            # CSV or single-sheet Excel
            df_clean = clean_dataframe_for_json(df)
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
                "preview": df_clean.head(5).to_dict('records'),
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
    df_clean = clean_dataframe_for_json(first_sheet)
    
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
    df_clean = clean_dataframe_for_json(first_sheet)
    
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
    Uses Server-Sent Events (SSE) to stream charts as they're generated.
    
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
    
    # Get dataset context
    dataset_context = dataset_service.get_context(current_user.id, dataset_id)
    if not dataset_context:
        sheet_names = list(df.keys())
        first_sheet = df[sheet_names[0]]
        columns = [str(col) for col in first_sheet.columns.tolist()]
        dataset_context = f"Dataset with {len(first_sheet)} rows and {len(first_sheet.columns)} columns. Columns: {', '.join(columns)}. Available sheets: {', '.join(sheet_names)}"
    
    async def generate_stream():
        """Generator function that yields SSE-formatted events"""
        charts_data_for_db = []
        dashboard_title = None
        
        try:
            # Check for default housing visualizations
            is_default_housing = dataset_id.startswith("sample_housing_")
            default_query_patterns = [
                "comprehensive view of housing prices",
                "housing prices and how it relates",
                "build a dashboard",
                "construct a dashboard"
            ]
            is_default_query = any(pattern.lower() in request.query.lower() for pattern in default_query_patterns)
            
            if is_default_housing and is_default_query:
                # Load pre-built default visualizations from JSON file - instant!
                logger.info(f"Loading pre-built default housing visualizations for dataset {dataset_id}")
                default_dashboard_path = Path(__file__).parent.parent / "default_housing_dashboard.json"
                
                with open(default_dashboard_path, 'r') as f:
                    default_data = json.load(f)
                
                dashboard_title = default_data['dashboard_title']
                full_plan = default_data['full_plan']
                prebuilt_charts = default_data['charts']
                prebuilt_kpis = default_data.get('kpi_cards', [])
                
                total_items = len(prebuilt_kpis) + len(prebuilt_charts)
                
                # Send dashboard_info event first (include KPI count)
                dashboard_info_event = json.dumps({
                    'type': 'dashboard_info', 
                    'dashboard_title': dashboard_title, 
                    'full_plan': full_plan,
                    'kpi_count': len(prebuilt_kpis)
                })
                logger.info(f"Sending dashboard_info event: {dashboard_info_event[:100]}...")
                yield f"data: {dashboard_info_event}\n\n"
                
                # Stream KPI cards first
                for idx, kpi in enumerate(prebuilt_kpis):
                    kpi_event = json.dumps({
                        'type': 'kpi_card',
                        'kpi': kpi,
                        'progress': int(((idx + 1) / total_items) * 100)
                    })
                    logger.info(f"Sending KPI card {idx+1}/{len(prebuilt_kpis)}")
                    yield f"data: {kpi_event}\n\n"
                
                # Stream pre-built charts
                for idx, chart in enumerate(prebuilt_charts):
                    charts_data_for_db.append({
                        "chart_index": chart['chart_index'],
                        "code": chart['chart_spec'],
                        "figure": chart.get('figure'),  # Use .get() to handle missing figure
                        "title": chart['title'],
                        "chart_type": chart.get('chart_type', 'visualization'),  # Default to 'visualization' if not specified
                        "plan": chart['plan']
                    })
                    
                    progress = int(((len(prebuilt_kpis) + idx + 1) / total_items) * 100)
                    chart_event = json.dumps({'type': 'chart', 'chart': chart, 'progress': progress})
                    logger.info(f"Sending chart {idx+1}/{len(prebuilt_charts)}, event size: {len(chart_event)} bytes")
                    yield f"data: {chart_event}\n\n"
                
                complete_event = json.dumps({
                    'type': 'complete', 
                    'message': f'Loaded {len(prebuilt_kpis)} KPI card(s) and {len(prebuilt_charts)} chart(s)', 
                    'total_charts': len(prebuilt_charts),
                    'total_kpis': len(prebuilt_kpis),
                    'progress': 100
                })
                logger.info(f"Sending complete event")
                yield f"data: {complete_event}\n\n"
                
                logger.info("Used pre-built visualizations - credits will still be charged")
            else:
                # Generate charts using streaming function - charts streamed as they complete!
                from ..services.chart_creator import generate_chart_spec_streaming
                from ..services.dataset_service import dataset_service
                
                query = request.query + "/n use these colors " + str(request.color_theme)
                
                # Track dashboard info for DB storage
                dashboard_title = "Dashboard"
                full_plan = {}
                
                # Stream charts as they are generated (truly async!)
                async for event_type, chart_data, metadata in generate_chart_spec_streaming(
                    df=df,
                    query=query,
                    dataset_context=dataset_context,
                    user_id=current_user.id,
                    dataset_id=dataset_id
                ):
                    if event_type == 'dashboard_info':
                        dashboard_title = chart_data.get('dashboard_title', 'Dashboard')
                        full_plan = chart_data.get('full_plan', {})
                        
                        # Yield dashboard info event
                        yield f"data: {json.dumps({'type': 'dashboard_info', 'dashboard_title': dashboard_title, 'full_plan': full_plan, 'kpi_count': chart_data.get('kpi_count', 0)})}\n\n"
                    
                    elif event_type == 'kpi_card':
                        kpi = chart_data
                        kpi_index = kpi.get('chart_index', 0)
                        
                        # Store KPI metadata
                        try:
                            dataset_service.set_chart_metadata(
                                user_id=current_user.id,
                                dataset_id=dataset_id,
                                chart_index=kpi_index,
                                chart_spec=kpi.get('chart_spec', ''),
                                plan=kpi.get('plan', full_plan),
                                figure_data=kpi.get('figure'),
                                chart_type='kpi_card',
                                title=kpi.get('title', 'KPI')
                            )
                        except Exception as e:
                            logger.warning(f"Failed to store KPI metadata: {e}")
                        
                        charts_data_for_db.append({
                            "chart_index": kpi_index,
                            "code": kpi.get('chart_spec', ''),
                            "figure": kpi.get('figure'),
                            "title": kpi.get('title', 'KPI'),
                            "chart_type": 'kpi_card',
                            "plan": kpi.get('plan', full_plan),
                            "is_kpi": True
                        })
                        
                        # Yield KPI card event AS SOON AS IT'S READY
                        yield f"data: {json.dumps({'type': 'kpi_card', 'kpi': kpi, 'index': kpi_index})}\n\n"
                    
                    elif event_type == 'chart':
                        chart = chart_data
                        chart_index = chart.get('chart_index', 0)
                        progress = metadata.get('progress', 0)
                        
                        # Store chart metadata
                        try:
                            dataset_service.set_chart_metadata(
                                user_id=current_user.id,
                                dataset_id=dataset_id,
                                chart_index=chart_index,
                                chart_spec=chart.get('chart_spec', ''),
                                plan=chart.get('plan', full_plan),
                                figure_data=chart.get('figure'),
                                chart_type=chart.get('chart_type'),
                                title=chart.get('title', 'Visualization')
                            )
                        except Exception as e:
                            logger.warning(f"Failed to store chart metadata: {e}")
                        
                        charts_data_for_db.append({
                            "chart_index": chart_index,
                            "code": chart.get('chart_spec', ''),
                            "figure": chart.get('figure'),
                            "title": chart.get('title', 'Visualization'),
                            "chart_type": chart.get('chart_type'),
                            "plan": chart.get('plan', full_plan)
                        })
                        
                        # Yield chart event AS SOON AS IT'S READY (no waiting for other charts!)
                        yield f"data: {json.dumps({'type': 'chart', 'chart': chart, 'progress': progress})}\n\n"
                    
                    elif event_type == 'complete':
                        # Yield completion event
                        total_charts = chart_data.get('total_charts', len(charts_data_for_db))
                        kpi_count = chart_data.get('kpi_count', 0)
                        message = chart_data.get('message', f'Generated {kpi_count} KPI cards and {total_charts - kpi_count} chart(s)')
                        
                        yield f"data: {json.dumps({'type': 'complete', 'message': message, 'total_charts': total_charts, 'kpi_count': kpi_count, 'progress': 100})}\n\n"
                    
                    elif event_type == 'error':
                        yield f"data: {json.dumps({'type': 'error', 'message': chart_data.get('message', 'Error generating charts')})}\n\n"
            
            # Save dashboard query to DB (after all charts)
            if charts_data_for_db:
                try:
                    dataset_service.save_dashboard_query(
                        db,
                        current_user.id,
                        dataset_id,
                        request.query,
                        "analyze",
                        charts_data_for_db,
                        dashboard_title or 'Dashboard'
                    )
                except Exception as e:
                    logger.warning(f"Failed to save dashboard query: {e}")
            
            # Deduct credits for all analyses
            credit_service.deduct_credits(
                db,
                current_user.id,
                5,
                f"Data analysis: {request.query[:100]}",
                metadata={"dataset_id": dataset_id, "chart_count": len(charts_data_for_db)}
            )
            
        except Exception as e:
            logger.error(f"Error in streaming: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


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

def find_error_region_in_code(original_code, error_context, error_message, approximate_error_line=None):
    """
    Find the error region in the original code using diff-based matching.
    
    Args:
        original_code: The complete original code
        error_context: The error context window extracted from original code
        error_message: The error message (for additional context)
        approximate_error_line: Approximate error line number if known (0-indexed)
    
    Returns:
        tuple: (start_line, end_line) - Line indices of matched region (0-indexed, exclusive end)
               Returns (None, None) if no match found
    """
    original_lines = original_code.split('\n')
    context_lines = error_context.split('\n')
    
    # If we have an approximate error line, use it to narrow the search
    if approximate_error_line is not None:
        # Search within a window around the approximate error line
        search_start = max(0, approximate_error_line - 20)
        search_end = min(len(original_lines), approximate_error_line + 20)
        search_region = original_lines[search_start:search_end]
        
        # Use SequenceMatcher to find best match
        matcher = difflib.SequenceMatcher(None, context_lines, search_region)
        match = matcher.find_longest_match(0, len(context_lines), 0, len(search_region))
        
        if match.size >= len(context_lines) * 0.7:  # At least 70% match
            start_line = search_start + match.b
            end_line = start_line + match.size
            return start_line, end_line
    
    # Fallback: search entire code
    matcher = difflib.SequenceMatcher(None, context_lines, original_lines)
    match = matcher.find_longest_match(0, len(context_lines), 0, len(original_lines))
    
    if match.size >= len(context_lines) * 0.7:  # At least 70% match
        return match.b, match.b + match.size
    
    # Try fuzzy matching with individual lines
    best_match_start = None
    best_match_score = 0.0
    best_match_size = 0
    
    for i in range(len(original_lines) - len(context_lines) + 1):
        candidate = original_lines[i:i + len(context_lines)]
        matcher = difflib.SequenceMatcher(None, context_lines, candidate)
        ratio = matcher.ratio()
        
        if ratio > best_match_score and ratio >= 0.7:
            best_match_score = ratio
            best_match_start = i
            best_match_size = len(context_lines)
    
    if best_match_start is not None:
        return best_match_start, best_match_start + best_match_size
    
    return None, None


def integrate_fix_with_original(original_code, fix_code, start_line, end_line):
    """
    Integrate fixed code into the original code by replacing the matched region.
    
    Args:
        original_code: The complete original code
        fix_code: The fixed code snippet
        start_line: Start line of region to replace (0-indexed)
        end_line: End line of region to replace (0-indexed, exclusive)
    
    Returns:
        str: The integrated code with fix applied
    """
    original_lines = original_code.split('\n')
    fix_lines = fix_code.split('\n')
    
    # Determine base indentation from the first line of the replaced region
    if start_line < len(original_lines) and original_lines[start_line].strip():
        # Get base indentation from first non-empty line of original region
        base_indent = len(original_lines[start_line]) - len(original_lines[start_line].lstrip())
    else:
        # Fallback: look for indentation in surrounding context
        base_indent = 0
        for i in range(max(0, start_line - 3), min(len(original_lines), start_line + 3)):
            if original_lines[i].strip():
                base_indent = len(original_lines[i]) - len(original_lines[i].lstrip())
                break
    
    # Find minimum indentation in fix code (to normalize it)
    fix_min_indent = float('inf')
    for fix_line in fix_lines:
        if fix_line.strip():
            indent = len(fix_line) - len(fix_line.lstrip())
            fix_min_indent = min(fix_min_indent, indent)
    
    if fix_min_indent == float('inf'):
        fix_min_indent = 0
    
    # Adjust fix code indentation to match original
    adjusted_fix_lines = []
    for fix_line in fix_lines:
        if fix_line.strip():  # Non-empty line
            # Remove minimum indent from fix line
            current_indent = len(fix_line) - len(fix_line.lstrip())
            relative_indent = current_indent - fix_min_indent
            # Apply base indent + relative indent
            adjusted_line = ' ' * (base_indent + relative_indent) + fix_line.lstrip()
            adjusted_fix_lines.append(adjusted_line)
        else:
            adjusted_fix_lines.append('')
    
    # Replace the region
    integrated_lines = (
        original_lines[:start_line] +
        adjusted_fix_lines +
        original_lines[end_line:]
    )
    
    return '\n'.join(integrated_lines)


def replace_code_block_ast(original_code, fix_code, error_line):
    """
    Use AST-based approach to replace code block containing error.
    This is a fallback when diff matching fails.
    
    Args:
        original_code: The complete original code
        fix_code: The fixed code snippet
        error_line: Approximate error line number (0-indexed)
    
    Returns:
        str: The integrated code, or None if AST parsing fails
    """
    try:
        # Parse original code to AST
        original_ast = ast.parse(original_code)
        
        # Find the statement/node at the error line
        original_lines = original_code.split('\n')
        
        # Walk AST to find node containing error line
        class ErrorNodeVisitor(ast.NodeVisitor):
            def __init__(self, target_line):
                self.target_line = target_line
                self.found_node = None
                self.found_start = None
                self.found_end = None
            
            def visit(self, node):
                if hasattr(node, 'lineno'):
                    # Check if node contains the error line
                    node_start = node.lineno - 1  # Convert to 0-indexed
                    
                    # Handle end_lineno (Python 3.8+)
                    if hasattr(node, 'end_lineno'):
                        node_end = node.end_lineno  # Already 1-indexed, exclusive
                    else:
                        # Fallback: estimate end line (not perfect but better than nothing)
                        node_end = node_start + 1
                    
                    if node_start <= self.target_line < node_end:
                        if self.found_node is None or (
                            node_start <= (self.found_start or 0) and
                            node_end >= (self.found_end or len(original_lines))
                        ):
                            self.found_node = node
                            self.found_start = node_start
                            self.found_end = node_end
                self.generic_visit(node)
        
        visitor = ErrorNodeVisitor(error_line)
        visitor.visit(original_ast)
        
        if visitor.found_node and visitor.found_start is not None:
            # Replace the found node's code with fix code
            return integrate_fix_with_original(
                original_code,
                fix_code,
                visitor.found_start,
                visitor.found_end
            )
        
    except SyntaxError:
        # Original code has syntax errors, can't use AST
        pass
    except Exception as e:
        logger.warning(f"AST-based replacement failed: {str(e)}")
    
    return None


def extract_error_context(plotly_code, error_message):
    """
    Extract a broader error context around the suspected error location,
    but return ONLY raw code lines (no "Line X:" markers).
    Default: 15 lines before and 15 lines after. Falls back to a middle slice.
    
    Returns:
        tuple: (context_window, error_line_number, start_line, end_line)
        - context_window: The extracted code context as a string
        - error_line_number: The approximate error line (0-indexed), or None
        - start_line: Start line of context window (0-indexed)
        - end_line: End line of context window (0-indexed, exclusive)
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
    context_window = '\n'.join(context_lines)
    
    return context_window, error_line, start, end


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
        # Extract error context (15 lines above/below error)
        error_context, error_line, context_start, context_end = extract_error_context(
            request.plotly_code, 
            request.error_message
        )
        logger.info(f"Extracted error context:\n{error_context}")
        logger.info(f"Error line: {error_line}, Context window: lines {context_start}-{context_end}")

        # Use Claude for code fixing
        lm = dspy.LM("anthropic/claude-3-7-sonnet-latest", api_key=os.getenv("ANTHROPIC_API_KEY"), max_tokens=4000)

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
        stitched_code = None
        
        # Step 1: Try diff-based matching to find error region
        start_line, end_line = find_error_region_in_code(
            request.plotly_code,
            error_context,
            request.error_message,
            approximate_error_line=error_line
        )
        
        if start_line is not None and end_line is not None:
            logger.info(f"Found error region using diff matching: lines {start_line}-{end_line}")
            stitched_code = integrate_fix_with_original(
                request.plotly_code,
                fix_code,
                start_line,
                end_line
            )
            logger.info("Successfully integrated fix using diff matching")
        else:
            # Step 2: Fallback to AST-based replacement
            logger.info("Diff matching failed, trying AST-based approach")
            if error_line is not None:
                stitched_code = replace_code_block_ast(
                    request.plotly_code,
                    fix_code,
                    error_line
                )
                if stitched_code:
                    logger.info("Successfully integrated fix using AST-based approach")
            
            # Step 3: Final fallback - line-number-based replacement
            if not stitched_code:
                logger.info("AST-based approach failed, using line-number fallback")
                original_lines = request.plotly_code.splitlines()
                
                if error_line is not None and error_line < len(original_lines):
                    # Replace a window around the error line
                    window_size = min(len(error_context.splitlines()), 10)
                    replace_start = max(0, error_line - window_size // 2)
                    replace_end = min(len(original_lines), error_line + window_size // 2 + 1)
                    
                    stitched_code = integrate_fix_with_original(
                        request.plotly_code,
                        fix_code,
                        replace_start,
                        replace_end
                    )
                    logger.info(f"Used line-number fallback: replaced lines {replace_start}-{replace_end}")
                else:
                    # Last resort: return fix code as-is (may be incomplete)
                    logger.warning("Could not integrate fix, returning fix code as-is")
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
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1800)):
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
                metadata={"dataset_id": request.dataset_id, "chart_index": request.chart_index}
            )
            
            # Get chart metadata for DB storage
            try:
                chart_metadata = dataset_service.get_chart_metadata(
                    current_user.id,
                    request.dataset_id,
                    request.chart_index
                )
                title = chart_metadata.get('title', 'Visualization') if chart_metadata else 'Visualization'
                chart_type = chart_metadata.get('chart_type', 'plotly') if chart_metadata else 'plotly'
            except:
                title = 'Visualization'
                chart_type = 'plotly'
            
            # Save dashboard query to DB
            try:
                charts_data = [{
                    "chart_index": request.chart_index,
                    "code": edited_code,
                    "figure": execution_result.get('figure'),
                    "title": title,
                    "chart_type": chart_type
                }]
                dataset_service.save_dashboard_query(
                    db,
                    current_user.id,
                    request.dataset_id,
                    request.edit_request,
                    "edit",
                    charts_data
                )
            except Exception as e:
                logger.warning(f"Failed to save dashboard query: {e}")
        
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


@router.post("/edit-kpi")
async def edit_kpi(
    request: EditKPIRequest,
    credits: CreditCheckResult = Depends(require_credits(1)),
    db: Session = Depends(get_db)
):
    """
    Edit a KPI card using natural language instructions.
    Uses the kpi_editor DSPy module to generate edited code.
    
    Costs: 1 credit per edit
    """
    from ..services.agents import kpi_editor, clean_plotly_code
    
    current_user = credits.user
    try:
        # Get dataset
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get dataset context
        data_context = dataset_service.get_context(current_user.id, request.dataset_id)
        
        if not data_context:
            if isinstance(df, dict):
                sheet_names = list(df.keys())
                first_sheet = df[sheet_names[0]]
                columns = [str(col) for col in first_sheet.columns.tolist()]
                data_context = f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet columns: {', '.join(columns)}"
            else:
                columns = [str(col) for col in df.columns.tolist()]
                data_context = f"Dataset with {len(df)} rows. Columns: {', '.join(columns)}"
        
        # Call kpi_editor module
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=800)):
            editor = dspy.Predict(kpi_editor)
            result = editor(
                user_query=request.edit_request,
                current_code=request.current_code,
                dataset_context=data_context
            )
        
        # Clean the edited code
        edited_code = clean_plotly_code(result.edited_code)
        new_title = getattr(result, 'new_title', request.current_title) or request.current_title
        
        # Execute edited code to get figure
        execution_result = execute_plotly_code(edited_code, df)
        
        # Deduct credits after successful edit
        if execution_result.get('success'):
            credit_service.deduct_credits(
                db,
                current_user.id,
                1,
                f"KPI edit: {request.edit_request[:100]}",
                metadata={"dataset_id": request.dataset_id, "kpi_index": request.kpi_index}
            )
        
        return {
            "edited_code": edited_code,
            "title": new_title.strip('"').strip("'") if new_title else request.current_title,
            "figure": execution_result.get('figure'),
            "success": execution_result.get('success'),
            "error": execution_result.get('error') if not execution_result.get('success') else None
        }
        
    except Exception as e:
        logger.error(f"Error editing KPI: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to edit KPI: {str(e)}")


@router.post("/add-kpi")
async def add_kpi(
    request: AddKPIRequest,
    credits: CreditCheckResult = Depends(require_credits(1)),
    db: Session = Depends(get_db)
):
    """
    Add a new KPI card based on a description.
    Uses the kpi_card_plotly DSPy signature to generate the code.
    
    Costs: 1 credit per creation
    """
    from ..services.agents import kpi_card_plotly, clean_plotly_code
    
    current_user = credits.user
    try:
        # Get dataset
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get dataset context
        data_context = dataset_service.get_context(current_user.id, request.dataset_id)
        
        if not data_context:
            if isinstance(df, dict):
                sheet_names = list(df.keys())
                first_sheet = df[sheet_names[0]]
                columns = [str(col) for col in first_sheet.columns.tolist()]
                data_context = f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet columns: {', '.join(columns)}"
            else:
                columns = [str(col) for col in df.columns.tolist()]
                data_context = f"Dataset with {len(df)} rows. Columns: {', '.join(columns)}"
        
        # Call kpi_card_plotly module
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=800)):
            kpi_generator = dspy.Predict(kpi_card_plotly)
            result = kpi_generator(
                plan=request.description,
                styling="minimal, mode='number' only",
                dataset_context=data_context
            )
        
        # Clean the generated code
        kpi_code = clean_plotly_code(result.plotly_code)
        
        # Execute code to get figure
        execution_result = execute_plotly_code(kpi_code, df)
        
        # Deduct credits after successful creation
        if execution_result.get('success'):
            credit_service.deduct_credits(
                db,
                current_user.id,
                1,
                f"KPI created: {request.description[:100]}",
                metadata={"dataset_id": request.dataset_id}
            )
        
        return {
            "chart_spec": kpi_code,
            "title": request.description.title()[:30],  # Use description as title (truncated)
            "chart_type": "kpi_card",
            "figure": execution_result.get('figure'),
            "success": execution_result.get('success'),
            "error": execution_result.get('error') if not execution_result.get('success') else None
        }
        
    except Exception as e:
        logger.error(f"Error adding KPI: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add KPI: {str(e)}")


@router.post("/apply-filter")
async def apply_filter(
    request: ApplyFilterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Apply filters to a chart by prepending filter code to the original chart code
    and re-executing it.
    
    Filter types:
    - number: {column_min: value, column_max: value}
    - date: {column_from: 'YYYY-MM-DD', column_to: 'YYYY-MM-DD'}
    - string: {column: ['value1', 'value2', ...]}
    
    No credits charged for filtering.
    """
    try:
        # Get dataset
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Generate filter code from filter specifications
        filter_conditions = []
        
        for key, value in request.filters.items():
            if value is None:
                continue
                
            # Handle range filters (number) - keys end with _min or _max
            if key.endswith('_min'):
                column = key[:-4]  # Remove '_min'
                filter_conditions.append(f"(df['{column}'] >= {value})")
            elif key.endswith('_max'):
                column = key[:-4]  # Remove '_max'
                filter_conditions.append(f"(df['{column}'] <= {value})")
            
            # Handle date filters - keys end with _from or _to
            elif key.endswith('_from'):
                column = key[:-5]  # Remove '_from'
                filter_conditions.append(f"(pd.to_datetime(df['{column}']) >= pd.to_datetime('{value}'))")
            elif key.endswith('_to'):
                column = key[:-3]  # Remove '_to'
                filter_conditions.append(f"(pd.to_datetime(df['{column}']) <= pd.to_datetime('{value}'))")
            
            # Handle category filters (string) - value is a list of selected values
            elif isinstance(value, list) and len(value) > 0:
                column = key
                values_str = ', '.join([f"'{v}'" for v in value])
                filter_conditions.append(f"(df['{column}'].isin([{values_str}]))")
        
        # Build the filter code
        if filter_conditions:
            filter_code = f"# Apply filters\ndf = df[{' & '.join(filter_conditions)}].copy()\n\n"
        else:
            filter_code = ""
        
        # Prepend filter code to original chart code
        combined_code = filter_code + request.original_code
        
        logger.info(f"Applying filter to chart {request.chart_index}")
        logger.info(f"Filter code: {filter_code}")
        
        # Execute the combined code
        execution_result = execute_plotly_code(combined_code, df)
        
        if execution_result.get('success'):
            return {
                "success": True,
                "figure": execution_result.get('figure'),
                "filtered_code": combined_code,
                "filter_code": filter_code
            }
        else:
            return {
                "success": False,
                "error": execution_result.get('error'),
                "figure": None
            }
        
    except Exception as e:
        logger.error(f"Error applying filter: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply filter: {str(e)}")


@router.post("/add-chart")
async def add_chart(
    request: AddChartRequest,
    credits: CreditCheckResult = Depends(require_credits(int(os.getenv("CREDITS_PER_CHART_ADD", "2")))),
    db: Session = Depends(get_db)
):
    """
    Add a new chart to an existing dashboard using natural language instructions.
    Uses the plotly_adder_sig DSPy module to generate new chart code.
    
    Costs: 2 credits per chart addition (configurable via CREDITS_PER_CHART_ADD env var)
    """
    current_user = credits.user
    try:
        # Get dataset
        df = dataset_service.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get dataset context
        data_context = dataset_service.get_context(current_user.id, request.dataset_id)
        
        if not data_context:
            # Provide basic fallback context if not available
            if isinstance(df, dict):
                sheet_names = list(df.keys())
                first_sheet = df[sheet_names[0]]
                columns = [str(col) for col in first_sheet.columns.tolist()]
                data_context = f"Multi-sheet Excel with {len(df)} sheets: {', '.join(sheet_names)}. First sheet has {len(first_sheet)} rows and columns: {', '.join(columns)}"
            else:
                columns = [str(col) for col in df.columns.tolist()]
                data_context = f"Dataset with {len(df)} rows and {len(df.columns)} columns. Columns: {', '.join(columns)}"
        
        # Get next available chart_index
        dataset_store = dataset_service._store.get(current_user.id, {}).get(request.dataset_id, {})
        existing_charts = dataset_store.get("charts", {})
        if existing_charts:
            # Convert all keys to ints and find max
            chart_indices = []
            for k in existing_charts.keys():
                try:
                    chart_indices.append(int(k))
                except (ValueError, TypeError):
                    continue
            next_chart_index = max(chart_indices) + 1 if chart_indices else 0
        else:
            next_chart_index = 0
        
        # Prepare query with color theme if provided
        query = request.query
        if request.color_theme:
            query = query + "\n use these colors " + str(request.color_theme)
        
        # Call plotly_adder_sig module to generate chart code
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=1400)):
            adder = dspy.Predict(plotly_adder_sig)
            result = adder(
                user_query=query,
                dataset_context=data_context
            )
        
        # Clean the chart code
        chart_code = clean_plotly_code(result.chart_code)
        
        # Execute chart code to get figure
        execution_result = execute_plotly_code(chart_code, df)
        
        if not execution_result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to execute chart code: {execution_result.get('error', 'Unknown error')}"
            )
        
        # Extract chart type and title from the code or use defaults
        chart_type = "unknown"
        title = "New Chart"
        
        # Try to infer chart type from code
        if "px.bar" in chart_code or "go.Bar" in chart_code:
            chart_type = "bar_chart"
        elif "px.line" in chart_code or "go.Scatter" in chart_code and "mode='lines'" in chart_code:
            chart_type = "line_chart"
        elif "px.scatter" in chart_code or "go.Scatter" in chart_code:
            chart_type = "scatter_plot"
        elif "px.histogram" in chart_code or "go.Histogram" in chart_code:
            chart_type = "histogram"
        
        # Try to extract title from figure layout if available
        figure_data = execution_result.get('figure')
        if figure_data and isinstance(figure_data, dict):
            layout = figure_data.get('layout', {})
            if layout and 'title' in layout:
                title = layout.get('title', {}).get('text', 'New Chart') if isinstance(layout.get('title'), dict) else str(layout.get('title', 'New Chart'))
        
        # Store chart metadata
        dataset_service.set_chart_metadata(
            user_id=current_user.id,
            dataset_id=request.dataset_id,
            chart_index=next_chart_index,
            chart_spec=chart_code,
            plan={},  # Empty plan for added charts
            figure_data=figure_data,
            chart_type=chart_type,
            title=title
        )
        
        # Deduct credits after successful chart addition
        credit_service.deduct_credits(
            db,
            current_user.id,
            int(os.getenv("CREDITS_PER_CHART_ADD", "2")),
            f"Add chart: {request.query[:100]}",
            metadata={"dataset_id": request.dataset_id, "chart_index": next_chart_index}
        )
        
        # Save dashboard query to DB
        try:
            charts_data = [{
                "chart_index": next_chart_index,
                "code": chart_code,
                "figure": figure_data,
                "title": title,
                "chart_type": chart_type
            }]
            dataset_service.save_dashboard_query(
                db,
                current_user.id,
                request.dataset_id,
                request.query,
                "add",
                charts_data
            )
        except Exception as e:
            logger.warning(f"Failed to save dashboard query: {e}")
        
        # Return chart spec in same format as analyze endpoint
        return {
            "chart_spec": chart_code,
            "chart_type": chart_type,
            "title": title,
            "chart_index": next_chart_index,
            "figure": figure_data,
            "reasoning": getattr(result, 'reasoning', 'Chart added successfully')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding chart: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add chart: {str(e)}")


@router.delete("/datasets/{dataset_id}/charts/{chart_index}")
async def delete_chart(
    dataset_id: str,
    chart_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a chart from the dashboard.
    
    Args:
        dataset_id: Dataset identifier
        chart_index: Chart index to delete
    """
    try:
        # Delete chart metadata from memory
        success = dataset_service.delete_chart_metadata(
            current_user.id,
            dataset_id,
            chart_index
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Chart not found")
        
        return {
            "message": "Chart deleted successfully",
            "dataset_id": dataset_id,
            "chart_index": chart_index
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chart: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete chart: {str(e)}")


@router.post("/datasets/{dataset_id}/charts/{chart_index}/notes")
async def update_chart_notes(
    dataset_id: str,
    chart_index: int,
    request: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update notes for a specific chart.
    """
    notes = request.get("notes", "")
    
    try:
        dataset_service.update_chart_notes(
            current_user.id,
            dataset_id,
            chart_index,
            notes
        )
        return {"success": True, "message": "Notes updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update notes: {str(e)}")


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
        "notes": metadata.get("notes", ""),
        "created_at": metadata.get("created_at")
    }


@router.post("/datasets/{dataset_id}/charts/{chart_index}/insights")
async def generate_chart_insights(
    dataset_id: str,
    chart_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate AI insights for a chart based on its figure metadata.
    This is a free endpoint (no credits required).
    """
    try:
        # Get chart metadata
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
        
        figure_data = metadata.get("figure")
        if not figure_data:
            raise HTTPException(
                status_code=400,
                detail="Chart figure data not available"
            )
        
        # Extract metadata from figure
        figure_metadata = extract_figure_metadata(figure_data)
        
        # Format metadata as string for DSPy
        metadata_str = json.dumps(figure_metadata, indent=2)
        
        # Generate insights using DSPy
        with dspy.context(lm=dspy.LM("openai/gpt-4o-mini", max_tokens=500)):
            insights_module = dspy.Predict(ChartInsightsSignature)
            result = insights_module(figure_metadata=metadata_str)
            insights = str(result.insights).strip()
        
        return {
            "success": True,
            "insights": insights,
            "metadata": figure_metadata
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating insights: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate insights: {str(e)}"
        )


@router.post("/datasets/{dataset_id}/share")
async def share_dashboard(
    dataset_id: str,
    request: dict,  # Expecting {"figures_data": [...], "dashboard_title": "..."}
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a public dashboard share link.
    Only called when user clicks share button.
    
    Args:
        dataset_id: Dataset identifier
        request: Dict with "figures_data" (array of chart figures) and optional "dashboard_title"
    
    Returns:
        Dict with share_token and public_url
    """
    try:
        figures_data = request.get("figures_data", [])
        dashboard_title = request.get("dashboard_title")
        background_color = request.get("background_color", "#ffffff")
        text_color = request.get("text_color", "#1a1a1a")
        background_opacity = request.get("background_opacity", 1.0)
        use_gradient = request.get("use_gradient", False)
        gradient_color_2 = request.get("gradient_color_2", "#e5e7eb")
        container_colors = request.get("container_colors", {})
        chart_colors = request.get("chart_colors", {})
        chart_opacities = request.get("chart_opacities", {})
        apply_to_containers = request.get("apply_to_containers", True)
        
        if not figures_data:
            raise HTTPException(status_code=400, detail="No figures data provided")
        
        # Check user's plan to determine expiry
        from ..services.subscription_service import subscription_service
        from ..services.plan_service import plan_service
        
        subscription = subscription_service.get_user_subscription(db, current_user.id)
        is_free = True  # Default to free
        
        if subscription and subscription.plan_id:
            plan = plan_service.get_plan_by_id(db, subscription.plan_id)
            if plan:
                is_free = plan.name.lower() == "free"
        
        hours_valid = 24 if is_free else None
        
        # Create public dashboard
        public_dashboard = dataset_service.create_public_dashboard(
            db,
            current_user.id,
            dataset_id,
            figures_data,
            dashboard_title,
            hours_valid,
            background_color,
            text_color,
            background_opacity,
            use_gradient,
            gradient_color_2,
            container_colors,
            chart_colors,
            chart_opacities,
            apply_to_containers
        )
        
        # Build public URL
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        public_url = f"{frontend_url}/shared/{public_dashboard.share_token}"
        
        return {
            "share_token": public_dashboard.share_token,
            "public_url": public_url,
            "expires_at": public_dashboard.expires_at.isoformat() if public_dashboard.expires_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating public dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create share link: {str(e)}")


@router.get("/public/dashboard/{token}")
async def get_public_dashboard(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get public dashboard by token.
    No authentication required.
    
    Args:
        token: Share token
    
    Returns:
        Dict with dashboard data or error
    """
    try:
        result = dataset_service.get_public_dashboard(db, token)
        
        if result is None:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        if isinstance(result, dict) and result.get("error") == "expired":
            raise HTTPException(
                status_code=410, 
                detail="😢 Sorry! The dashboard was hosted on the free plan and is no longer available. Please ask politely for whoever shared it to upgrade their plan!"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching public dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard: {str(e)}")


@router.get("/dashboards/recent")
async def get_recent_dashboards(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent dashboards for the current user.
    
    Args:
        limit: Maximum number of recent dashboards to return (default 10)
    
    Returns:
        List of recent dashboards with metadata
    """
    try:
        dashboards = dataset_service.get_recent_dashboards(db, current_user.id, limit)
        return {"dashboards": dashboards}
    except Exception as e:
        logger.error(f"Error fetching recent dashboards: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent dashboards: {str(e)}")


@router.get("/dashboards/{query_id}")
async def get_dashboard_by_id(
    query_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific dashboard by query ID.
    
    Args:
        query_id: Dashboard query ID
    
    Returns:
        Dashboard data with charts
    """
    try:
        dashboard = dataset_service.get_dashboard_by_query_id(db, current_user.id, query_id)
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        return dashboard
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard: {str(e)}")


@router.post("/datasets/{dataset_id}/suggest-queries")
async def suggest_query(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a single AI-powered query suggestion based on dataset context.
    For sample housing data, returns a hardcoded query suggestion.
    
    Args:
        dataset_id: Dataset identifier
    
    Returns:
        Dict with a single suggestion string
    """
    # Check if this is sample housing data - return hardcoded query
    if dataset_id.startswith("sample_housing_"):
        return {
            "suggestion": "give me a comprehensive view of housing prices and how it relates to each variable, build a dashboard. - construct a dashboard showing this"
        }
    
    # Otherwise, generate AI suggestion
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
