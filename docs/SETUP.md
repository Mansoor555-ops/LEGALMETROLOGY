# Legal Metrology Compliance Assistant — Local Dev & Production Setup

## Environment Requirements

- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (Optional for n8n + MongoDB orchestration)

## Environment Variables (.env)

Create a `.env` file in `backend/`:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=legal_metrology_db
N8N_WEBHOOK_URL=http://localhost:5678/webhook/inspection-pipeline
```

Create a `.env.local` file in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_N8N_WEBHOOK_URL=http://localhost:5678/webhook/inspection-pipeline
```

## Running Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Building RAG FAISS Vector Index

Place `legal_metrology_rules_2011.pdf` inside `backend/data/`, then run:

```bash
python -m src.services.rag.ingest
```

## Running Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

## Docker Compose Setup

To start Backend + n8n + MongoDB simultaneously:

```bash
docker-compose up --build
```
