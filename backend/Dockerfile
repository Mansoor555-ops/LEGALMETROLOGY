# Dockerfile for Legal Metrology Compliance Assistant Backend
FROM python:3.12-slim

# Install system dependencies (OpenCV GL/EGL dependencies + Tesseract OCR binary fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    libtesseract-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment settings
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Run Uvicorn ASGI production server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
