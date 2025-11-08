# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
# Cloud Run requires port 8080 (set automatically via PORT env var)
# For local development, backend runs on port 3001
ENV PORT=8080

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Run the application
# Cloud Run sets PORT=8080 automatically
# For local Docker testing, you can override: docker run -e PORT=3001 ...
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}

