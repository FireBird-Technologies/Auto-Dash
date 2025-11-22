"""
Export routes for downloading charts as PNG, ZIP, or PDF
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import plotly.graph_objects as go
import os
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
import io
from PIL import Image
import base64

# ReportLab imports
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.utils import ImageReader

router = APIRouter(prefix="/api/export", tags=["export"])

# Path to logo
LOGO_PATH = Path(__file__).parent.parent.parent / "images" / "AutoDash.png"


class ChartExportRequest(BaseModel):
    """Request model for chart export"""
    charts: List[Dict[str, Any]]  # List of chart specs with figure data
    titles: Optional[List[str]] = None  # Optional custom titles


class ChartImageRequest(BaseModel):
    """Request with pre-rendered chart images (avoids kaleido issues)"""
    charts: List[Dict[str, str]]  # [{"title": "...", "imageData": "data:image/png;base64,..."}]


@router.post("/charts-zip-from-images")
async def export_charts_zip_from_images(request: ChartImageRequest):
    """
    Create ZIP from pre-rendered chart images (no kaleido needed!)
    Frontend exports charts using Plotly.toImage() and sends base64 data
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            png_files = []
            
            for idx, chart in enumerate(request.charts, 1):
                try:
                    title = chart.get('title', f'chart_{idx}')
                    image_data = chart.get('imageData', '')
                    
                    # Remove data URL prefix if present
                    if 'base64,' in image_data:
                        image_data = image_data.split('base64,')[1]
                    
                    # Decode base64 to bytes
                    img_bytes = base64.b64decode(image_data)
                    
                    # Sanitize filename
                    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                    safe_title = safe_title.replace(' ', '_').lower()
                    filename = f"{idx:02d}_{safe_title}.png"
                    filepath = os.path.join(temp_dir, filename)
                    
                    # Write image
                    with open(filepath, 'wb') as f:
                        f.write(img_bytes)
                    
                    png_files.append(filepath)
                    print(f"[SUCCESS] Added chart {idx} to ZIP: {filename}")
                    
                except Exception as e:
                    print(f"[ERROR] Error processing chart {idx}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            if not png_files:
                raise HTTPException(status_code=400, detail="No charts could be processed")
            
            # Create ZIP
            zip_path = os.path.join(temp_dir, f"autodash_charts_{timestamp}.zip")
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for filepath in png_files:
                    zipf.write(filepath, os.path.basename(filepath))
            
            print(f"[SUCCESS] Created ZIP with {len(png_files)} charts")
            
            with open(zip_path, 'rb') as f:
                zip_data = f.read()
        
        return Response(
            content=zip_data,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=autodash_charts_{timestamp}.zip"}
        )
        
    except Exception as e:
        print(f"[ERROR] Error creating ZIP: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dashboard-pdf-from-images")
async def export_pdf_from_images(request: ChartImageRequest):
    """
    Create PDF from pre-rendered chart images (no kaleido needed!)
    Includes Auto-Dash logo on every page
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, f"autodash_report_{timestamp}.pdf")
            
            c = pdf_canvas.Canvas(pdf_path, pagesize=letter)
            page_width, page_height = letter
            
            # Load logo
            logo_img = None
            if LOGO_PATH.exists():
                try:
                    logo_img = Image.open(LOGO_PATH)
                except Exception as e:
                    print(f"Could not load logo: {e}")
            
            for idx, chart in enumerate(request.charts, 1):
                try:
                    print(f"[INFO] Adding chart {idx} to PDF...")
                    
                    title = chart.get('title', f'Chart {idx}')
                    image_data = chart.get('imageData', '')
                    
                    # Remove data URL prefix
                    if 'base64,' in image_data:
                        image_data = image_data.split('base64,')[1]
                    
                    # Decode and load image
                    img_bytes = base64.b64decode(image_data)
                    chart_img = Image.open(io.BytesIO(img_bytes))
                    
                    # === ADD LOGO (CENTERED AT TOP) ===
                    if logo_img:
                        # Smaller logo size
                        logo_height = 25
                        logo_aspect = logo_img.width / logo_img.height
                        logo_width = logo_height * logo_aspect
                        
                        # Center logo horizontally
                        logo_x = (page_width - logo_width) / 2
                        logo_y = page_height - logo_height - 15
                        
                        logo_buffer = io.BytesIO()
                        logo_img.save(logo_buffer, format='PNG')
                        logo_buffer.seek(0)
                        
                        c.drawImage(ImageReader(logo_buffer), logo_x, logo_y,
                                   width=logo_width, height=logo_height,
                                   preserveAspectRatio=True, mask='auto')
                        
                        # Center "Auto-Dash" text below logo
                        c.setFont("Helvetica-Bold", 12)
                        c.setFillColorRGB(0.2, 0.2, 0.2)
                        c.drawCentredString(page_width / 2, logo_y - 15, "Auto-Dash")
                        
                        # Center subtitle below
                        c.setFont("Helvetica", 9)
                        c.setFillColorRGB(0.5, 0.5, 0.5)
                        c.drawCentredString(page_width / 2, logo_y - 28, "Analytics Dashboard")
                    
                    # === ADD CHART ===
                    img_width, img_height = chart_img.size
                    aspect_ratio = img_width / img_height
                    margin = 36
                    top_margin = 70 if logo_img else 36  # Smaller margin for centered compact logo
                    bottom_margin = 60
                    available_width = page_width - (2 * margin)
                    available_height = page_height - top_margin - bottom_margin
                    
                    if available_width / available_height > aspect_ratio:
                        scaled_height = available_height
                        scaled_width = scaled_height * aspect_ratio
                    else:
                        scaled_width = available_width
                        scaled_height = scaled_width / aspect_ratio
                    
                    # Center chart horizontally and vertically
                    chart_x = (page_width - scaled_width) / 2
                    chart_y = bottom_margin + (available_height - scaled_height) / 2
                    
                    chart_buffer = io.BytesIO()
                    chart_img.save(chart_buffer, format='PNG')
                    chart_buffer.seek(0)
                    
                    c.drawImage(ImageReader(chart_buffer), chart_x, chart_y,
                               width=scaled_width, height=scaled_height)
                    
                    # === ADD FOOTER ===
                    c.setFont("Helvetica", 10)
                    c.setFillColorRGB(0.4, 0.4, 0.4)
                    c.drawCentredString(page_width / 2, 25, f"Page {idx} of {len(request.charts)}")
                    c.setFont("Helvetica", 9)
                    c.drawString(margin, 25, title)
                    c.setFont("Helvetica", 8)
                    c.drawRightString(page_width - margin, 25,
                                     datetime.now().strftime("%B %d, %Y %I:%M %p"))
                    
                    if idx < len(request.charts):
                        c.showPage()
                    
                    print(f"[SUCCESS] Chart {idx} added to PDF successfully")
                    
                except Exception as e:
                    print(f"[ERROR] Error adding chart {idx}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            c.save()
            print(f"[SUCCESS] PDF created with {len(request.charts)} pages")
            
            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=autodash_report_{timestamp}.pdf"}
        )
        
    except Exception as e:
        print(f"[ERROR] Error creating PDF: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/charts-zip")
async def export_charts_as_zip(request: ChartExportRequest):
    """
    Export all charts as individual PNG files bundled in a ZIP
    
    Returns: ZIP file containing all chart PNGs
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            png_files = []
            
            # Export each chart as PNG
            for idx, chart_data in enumerate(request.charts, 1):
                try:
                    print(f"[INFO] Processing chart {idx}...")
                    
                    # Get figure data
                    figure = chart_data.get('figure')
                    if not figure:
                        print(f"[WARNING] Chart {idx}: No figure data, skipping")
                        continue
                    
                    # Create Plotly figure
                    fig = go.Figure(figure)
                    print(f"[SUCCESS] Chart {idx}: Created Plotly figure")
                    
                    # Generate filename
                    title = request.titles[idx-1] if request.titles and len(request.titles) >= idx else f"chart_{idx}"
                    # Sanitize title for filename
                    safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip()
                    safe_title = safe_title.replace(' ', '_').lower()
                    
                    filename = f"{idx:02d}_{safe_title}.png"
                    filepath = os.path.join(temp_dir, filename)
                    
                    print(f"[INFO] Exporting chart {idx} to bytes...")
                    
                    # Export to PNG using to_image (doesn't hang like write_image)
                    img_bytes = fig.to_image(
                        format='png',
                        width=1000,
                        height=800,
                        scale=2,
                        engine='kaleido'
                    )
                    
                    # Write bytes to file
                    with open(filepath, 'wb') as f:
                        f.write(img_bytes)
                    
                    png_files.append(filepath)
                    print(f"[SUCCESS] Chart {idx} exported successfully: {filename}")
                    
                except Exception as e:
                    print(f"[ERROR] Error exporting chart {idx}: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            if not png_files:
                raise HTTPException(status_code=400, detail="No charts could be exported")
            
            # Create ZIP file
            zip_path = os.path.join(temp_dir, f"autodash_charts_{timestamp}.zip")
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for filepath in png_files:
                    zipf.write(filepath, os.path.basename(filepath))
            
            # Read ZIP file into memory
            with open(zip_path, 'rb') as f:
                zip_data = f.read()
        
        # Return ZIP file
        return Response(
            content=zip_data,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=autodash_charts_{timestamp}.zip"
            }
        )
        
    except Exception as e:
        print(f"Error creating ZIP: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP: {str(e)}")


@router.post("/dashboard-pdf")
async def export_dashboard_as_pdf(request: ChartExportRequest):
    """
    Export all charts as a single PDF with each chart on a separate page.
    Includes Auto-Dash logo on every page.
    
    Returns: PDF file
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, f"autodash_report_{timestamp}.pdf")
            
            # Create PDF
            c = pdf_canvas.Canvas(pdf_path, pagesize=letter)
            page_width, page_height = letter  # 612 x 792 points
            
            # Load logo
            logo_img = None
            if LOGO_PATH.exists():
                try:
                    logo_img = Image.open(LOGO_PATH)
                except Exception as e:
                    print(f"Could not load logo: {e}")
            
            # Process each chart
            for idx, chart_data in enumerate(request.charts, 1):
                try:
                    print(f"[INFO] Processing PDF page {idx}...")
                    
                    # Get figure data
                    figure = chart_data.get('figure')
                    if not figure:
                        print(f"[WARNING] Chart {idx}: No figure data, skipping")
                        continue
                    
                    # Create Plotly figure
                    fig = go.Figure(figure)
                    print(f"[SUCCESS] Chart {idx}: Created Plotly figure for PDF")
                    
                    # Get chart title
                    chart_title = request.titles[idx-1] if request.titles and len(request.titles) >= idx else f"Chart {idx}"
                    
                    # === ADD LOGO (CENTERED AT TOP) ===
                    if logo_img:
                        # Smaller logo size
                        logo_height = 25
                        logo_aspect = logo_img.width / logo_img.height
                        logo_width = logo_height * logo_aspect
                        
                        # Center logo horizontally
                        logo_x = (page_width - logo_width) / 2
                        logo_y = page_height - logo_height - 15
                        
                        logo_buffer = io.BytesIO()
                        logo_img.save(logo_buffer, format='PNG')
                        logo_buffer.seek(0)
                        logo_reader = ImageReader(logo_buffer)
                        
                        c.drawImage(
                            logo_reader,
                            logo_x, logo_y,
                            width=logo_width,
                            height=logo_height,
                            preserveAspectRatio=True,
                            mask='auto'
                        )
                        
                        # Center "Auto-Dash" text below logo
                        # c.setFont("Helvetica-Bold", 12)
                        # c.setFillColorRGB(0.2, 0.2, 0.2)
                        # c.drawCentredString(page_width / 2, logo_y - 15, "Auto-Dash")
                        
                        # # Center subtitle below
                        # c.setFont("Helvetica", 9)
                        # c.setFillColorRGB(0.5, 0.5, 0.5)
                        # c.drawCentredString(page_width / 2, logo_y - 28, "Analytics Dashboard")
                    
                    # === ADD CHART ===
                    # Export chart to PNG bytes
                    print(f"[INFO] Exporting chart {idx} to bytes for PDF...")
                    img_bytes = fig.to_image(format='png', width=1000, height=800, scale=2, engine='kaleido')
                    chart_img = Image.open(io.BytesIO(img_bytes))
                    print(f"[SUCCESS] Chart {idx} exported to bytes successfully")
                    
                    img_width, img_height = chart_img.size
                    aspect_ratio = img_width / img_height
                    
                    # Calculate available space
                    margin = 36
                    top_margin = 70 if logo_img else 36  # Smaller margin for centered compact logo
                    bottom_margin = 60
                    
                    available_width = page_width - (2 * margin)
                    available_height = page_height - top_margin - bottom_margin
                    
                    # Scale to fit
                    if available_width / available_height > aspect_ratio:
                        scaled_height = available_height
                        scaled_width = scaled_height * aspect_ratio
                    else:
                        scaled_width = available_width
                        scaled_height = scaled_width / aspect_ratio
                    
                    # Center chart
                    # Center chart horizontally and vertically
                    chart_x = (page_width - scaled_width) / 2
                    chart_y = bottom_margin + (available_height - scaled_height) / 2
                    
                    # Draw chart
                    chart_buffer = io.BytesIO()
                    chart_img.save(chart_buffer, format='PNG')
                    chart_buffer.seek(0)
                    chart_reader = ImageReader(chart_buffer)
                    
                    c.drawImage(
                        chart_reader,
                        chart_x, chart_y,
                        width=scaled_width,
                        height=scaled_height,
                        preserveAspectRatio=True
                    )
                    
                    # === ADD FOOTER ===
                    c.setFont("Helvetica", 10)
                    c.setFillColorRGB(0.4, 0.4, 0.4)
                    c.drawCentredString(
                        page_width / 2, 25,
                        f"Page {idx} of {len(request.charts)}"
                    )
                    
                    c.setFont("Helvetica", 9)
                    c.drawString(margin, 25, chart_title)
                    
                    c.setFont("Helvetica", 8)
                    c.drawRightString(
                        page_width - margin, 25,
                        datetime.now().strftime("%B %d, %Y %I:%M %p")
                    )
                    
                    # New page if not last
                    if idx < len(request.charts):
                        c.showPage()
                        
                except Exception as e:
                    print(f"[ERROR] Error adding chart {idx} to PDF: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            # Save PDF
            c.save()
            
            # Read PDF into memory
            with open(pdf_path, 'rb') as f:
                pdf_data = f.read()
        
        # Return PDF
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=autodash_report_{timestamp}.pdf"
            }
        )
        
    except Exception as e:
        print(f"Error creating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create PDF: {str(e)}")

