# Legal Metrology Compliance Assistant — System Architecture

## Architecture Overview

```
                                  +-----------------------+
                                  | SmartCaptureCamera UI |
                                  +-----------+-----------+
                                              |
                                              v (Upload / Webhook)
                                  +-----------+-----------+
                                  |    n8n Workflow       |
                                  |   Orchestrator        |
                                  +-----------+-----------+
                                              |
                        +---------------------+---------------------+
                        |                                           |
                        v                                           v
           +------------+------------+                 +------------+------------+
           | Gemini 1.5 Vision API   |                 | Gemini 1.5 Vision API   |
           | (Visual Compliance)     |                 | (Structured Field OCR)  |
           +------------+------------+                 +------------+------------+
                        |                                           |
                        +---------------------+---------------------+
                                              |
                                              v (Parallel Async Response)
                                  +-----------+-----------+
                                  |    FastAPI Backend    |
                                  +-----------+-----------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
   +-----------------+-----------------+             +-----------------+-----------------+
   |    Deterministic Validator        |             |         FAISS RAG LLM Judge      |
   | (Objective Rule 6 Regex & Math)   |             | (Subjective Layout & Legal Ref) |
   +-----------------+-----------------+             +-----------------+-----------------+
                     |                                                 |
                     +------------------------+------------------------+
                                              |
                                              v
                                  +-----------+-----------+
                                  |  GTIN Product Master  |
                                  |  (MRP Mismatch Flag)  |
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------+-----------+
                                  |  MongoDB Atlas Store  |
                                  +-----------------------+
```

## Key Architectural Principles

1. **Gemini 1.5 Vision Dual Call**:
   - `run_visual_compliance_check`: Evaluates layout, grouping, prominence, and font ratio.
   - `run_structured_extraction`: Transcribes Rule 6 mandatory declaration fields.
2. **Hybrid Rule Engine**:
   - Objective validation (MRP tax clause, Net Qty units, Mfg Date format, unit-price math).
   - RAG LLM Judge using local FAISS vector store over Legal Metrology Rules 2011 PDF.
3. **GTIN Cross-Seller MRP Inconsistency Detection**:
   - Registers product master entries keyed by barcode to flag price discrepancies across sellers/locations.
