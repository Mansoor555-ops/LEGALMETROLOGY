# Orchestration Architecture & n8n Integration Roadmap

## Executive Overview
This document evaluates the integration points where **n8n** (an open-source workflow automation tool) can replace custom backend orchestration glue code within the **Legal Metrology Compliance Assistant** platform (`SIH PS 26034`).

---

## 1. Candidate Workflows for n8n

### A. Inspection Pipeline Orchestration
Currently, `POST /api/inspect` in `backend/app/main.py` sequentially handles:
1. File upload saving
2. Quality verification & YOLO region cropping
3. Multi-panel OCR text extraction
4. Rule 6 legal metrology evaluation
5. ReportLab PDF report generation
6. SQLite database record persistence

**n8n Workflow Design**:
- An HTTP Webhook trigger receives field inspection form submissions.
- Sequential HTTP request nodes invoke isolated Python microservices:
  - `POST /services/quality-check`
  - `POST /services/ocr-extract`
  - `POST /services/rule-evaluator`
  - `POST /services/pdf-generator`
- A Database node writes the final inspection record to PostgreSQL/SQLite.

### B. Manufacturer Notification & Rectification Routing
Currently, `POST /api/manufacturer/rectify` in `backend/app/main.py` directly handles rectification remarks.

**n8n Workflow Design**:
- When an inspection result is marked as `FAIL` or `NON_COMPLIANT`, an n8n webhook triggers:
  - **Email / SMS Dispatch**: Sends official Legal Metrology Notice of Violation to the registered manufacturer email address.
  - **Rectification Portal Tracking**: Generates a secure response link with a 15-day deadline timer.
  - **Escalation Trigger**: If no response is received within 15 days, automatically escalates the file to the District Legal Metrology Officer.

---

## 2. Technical Boundaries & Guidelines

> [!IMPORTANT]
> **n8n Capabilities & Scope**
> - **Compute Boundary**: n8n **cannot** perform computer vision (OpenCV/PyTorch) or deep learning OCR internally. It acts strictly as an HTTP/event orchestrator calling the Python backend microservice endpoints.
> - **Accuracy Pre-requisite**: Workflow orchestration does **not** alter or improve OCR or rule accuracy. The underlying Python computer vision engine must operate correctly before connecting n8n.
> - **Execution Strategy**: Keep heavy image binary processing inside the Python FastAPI service, passing image paths or pre-extracted JSON structures through n8n nodes.
