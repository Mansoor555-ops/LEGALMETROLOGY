# Legal Metrology (Packaged Commodities) Compliance Assistant

Production-grade monorepo system for automated Legal Metrology (Packaged Commodities) Rules, 2011 enforcement checking powered by **Google Gemini 1.5 Vision API**, **n8n workflow orchestration**, **MongoDB Atlas**, and a **Hybrid RAG Rule Engine**.

## Repository Structure

```
legal-metrology-compliance/
├── frontend/             # Next.js 14 App Router Government UI Portal
│   └── src/
│       ├── app/          # Main routes and dashboard pages
│       ├── components/   # Capture, Dashboard, Inspection & Shared components
│       ├── lib/          # API & Webhook client utilities
│       └── types/        # TypeScript interfaces
├── backend/              # FastAPI Async Microservice
│   └── src/
│       ├── main.py       # FastAPI entrypoint
│       ├── api/routes/   # Inspections, Products, Webhooks, Reports
│       ├── services/     # Gemini Vision client, Hybrid Rule Engine, RAG, PDF Generator
│       ├── models/       # Pydantic data schemas
│       └── db/           # Motor Async MongoDB client
│   └── data/             # Legal Metrology 2011 Rules & FAISS Index
├── n8n/
│   └── workflows/        # Exported n8n inspection pipeline JSON workflow
├── docs/                 # System Architecture & Setup Guides
├── docker-compose.yml    # Full stack orchestration (Backend + n8n + MongoDB)
└── README.md
```

## Key Features

1. **Gemini 1.5 Vision Integration**: Dual parallel calls for visual compliance checking and structured Rule 6 extraction.
2. **Hybrid Rule Engine**: Objective deterministic validation (MRP tax clause, Net Qty metric units, Mfg Date format, Unit-Price math) combined with FAISS RAG LLM Judge citing exact Legal Metrology 2011 clauses.
3. **GTIN Product Master & Cross-Seller MRP Tracker**: Detects when identical commodities declared under the same GTIN have conflicting MRPs across sellers/locations.
4. **Self-Hosted n8n Workflow Orchestration**: Checked-in JSON workflow for asynchronous processing pipelines.
5. **Government-Aligned UI/UX**: Dense tabular data views, official color palette, regional violation heatmaps, and officer override workflows.
