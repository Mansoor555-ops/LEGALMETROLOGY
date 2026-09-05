# Legal Metrology Compliance Assistant (SIH PS 26034)

Official Legal Metrology (Packaged Commodities) Rules 2011 Compliance Enforcement Tool for Field Inspectors.

## Architecture & Deployment Setup

### Architecture Overview
- **Frontend**: Next.js 14+ (React 18, TypeScript, Tailwind CSS) — Deployed on Vercel.
- **Backend**: Python 3.12, FastAPI, Uvicorn, EasyOCR, PyTesseract, OpenCV, Ultralytics YOLOv8, ReportLab PDF — Deployed as a long-running container service (Docker / Railway / Render / VM).

> [!IMPORTANT]
> **Deployment Architecture & Memory Requirements**
> - The Python backend must **NOT** be deployed as a Vercel Serverless Function because PyTorch/EasyOCR exceeds serverless size (500MB+) and execution timeout limits.
> - **Minimum System Hardware**: Minimum **2GB RAM** (4GB recommended) for EasyOCR neural network model inference and image processing.
> - **System Dependencies**: If using PyTesseract as a secondary OCR fallback, ensure the system Tesseract binary is installed (`apt-get install tesseract-ocr`). EasyOCR runs natively out-of-the-box via PyTorch.

### Local Development Setup

#### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # On Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Docker Deployment
```bash
cd backend
docker build -t legal-metrology-backend .
docker run -d -p 8000:8000 --name legal-metrology-api legal-metrology-backend
```
