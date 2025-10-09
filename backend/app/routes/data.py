from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel
import pandas as pd
import io
import json
import chardet
import tempfile
import os
import uuid
from pathlib import Path

from ..core.db import get_db
from ..core.security import get_current_user
from ..models import User
from ..services.data_store import data_store

router = APIRouter(prefix="/api/data", tags=["data"])


# Request/Response models
class QueryRequest(BaseModel):
    query: str
    dataset_id: Optional[str] = None


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
        encodings = [None, 'utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
        delimiters = [',', ';', '\t', '|']
        
        # Try auto-detect encoding first
        try:
            detected_encoding = self.detect_encoding()
            if detected_encoding:
                encodings.insert(0, detected_encoding)
        except:
            pass
        
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
        
        # Return data info
        return {
            "message": "Sample housing data loaded",
            "filename": "housing_sample.csv",
            "rows": len(df),
            "columns": df.columns.tolist(),
            "data": df.to_dict('records'),
            "preview": df.head(10).to_dict('records'),
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
    Load sample housing data into user's workspace
    """
    try:
        # Path to housing_sample.csv
        sample_file = Path(__file__).parent.parent / "housing_sample.csv"
        
        if not sample_file.exists():
            raise HTTPException(status_code=404, detail="Sample data file not found")
        
        # Read the CSV
        df = pd.read_csv(sample_file)
        
        # Store in data store
        dataset_id = f"sample_{uuid.uuid4().hex[:8]}"
        info = data_store.store_dataset(
            user_id=current_user.id,
            dataset_id=dataset_id,
            df=df,
            filename="housing_sample.csv"
        )
        
        return {
            "message": "Sample data loaded successfully",
            "dataset_id": dataset_id,
            "dataset_info": info
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
        
        # Generate unique dataset ID
        dataset_id = f"upload_{uuid.uuid4().hex[:8]}"
        
        # Store in data store
        info = data_store.store_dataset(
            user_id=current_user.id,
            dataset_id=dataset_id,
            df=df,
            filename=file.filename
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
            "processing_method": "robust_parser"
        }
        
        return {
            "message": "File uploaded and processed successfully",
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


@router.get("/datasets")
async def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all datasets for the current user.
    """
    datasets = data_store.list_datasets(current_user.id)
    
    return {
        "user_id": current_user.id,
        "count": len(datasets),
        "datasets": datasets
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
    info = data_store.get_dataset_info(current_user.id, dataset_id)
    
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
    df = data_store.get_dataset(current_user.id, dataset_id)
    
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "dataset_id": dataset_id,
        "preview": df.head(rows).to_dict('records'),
        "total_rows": len(df)
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
    success = data_store.delete_dataset(current_user.id, dataset_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "message": "Dataset deleted successfully",
        "dataset_id": dataset_id
    }


@router.post("/analyze")
async def analyze_data(
    request: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze data and generate chart specification based on natural language query.
    This endpoint will use the chart_creator module (to be provided by user).
    """
    # Get the dataset
    if request.dataset_id:
        df = data_store.get_dataset(current_user.id, request.dataset_id)
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
    else:
        # Use the most recent dataset
        result = data_store.get_latest_dataset(current_user.id)
        if result is None:
            raise HTTPException(
                status_code=400,
                detail="No dataset available. Please upload a file first."
            )
        dataset_id, df = result
    
    # Generate chart specification using DSPy agents
    from ..services.chart_creator import generate_chart_spec
    
    try:
        chart_spec = generate_chart_spec(df, request.query)
        
        return {
            "message": "Chart generated successfully",
            "query": request.query,
            "dataset_id": request.dataset_id or dataset_id if not request.dataset_id else request.dataset_id,
            "chart_spec": chart_spec
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating chart: {str(e)}"
        )


@router.get("/dashboard-count")
async def get_dashboard_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get count of dashboards per user.
    """
    # Count datasets as dashboards for now
    datasets = data_store.list_datasets(current_user.id)
    
    return {
        "user_id": current_user.id,
        "dashboard_count": len(datasets),
        "message": "Dashboard count endpoint ready"
    }
