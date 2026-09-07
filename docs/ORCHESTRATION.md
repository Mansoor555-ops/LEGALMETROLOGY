# Legal Metrology Compliance Assistant — n8n Orchestration Specification

This document details the production n8n workflow architecture for asynchronous inspection ingestion, webhook routing, non-compliance alerting, and PDF report dispatch.

---

## 🚀 Workflow Sequence Diagram

```text
[ Capture App / Mobile Officer ]
               │
               ▼ (HTTP Multipart POST / Webhook)
      ┌─────────────────┐
      │ n8n Webhook Node│
      └────────┬────────┘
               │
               ▼ (HTTP Node: POST /api/inspect)
      ┌─────────────────┐
      │ FastAPI Backend │ ◄── [Gemini Dual Engine + RAG Rule Engine]
      └────────┬────────┘
               │ (Returns JSON Verdict)
               ▼
      ┌─────────────────┐
      │ n8n Switch Node │
      └────────┬────────┘
               ├── [overall_status == 'PASS'] ─────────────────► [Log Audit Success]
               │
               └── [overall_status in ['FAIL', 'NON_COMPLIANT']]
                       │
                       ├──► [HTTP Node: Dispatch Compliance Notice PDF]
                       └──► [Twilio / Email Node: Alert Enforcement Officer]
```

---

## 🛠️ Key Pipeline Nodes

1. **Webhook Ingestion Trigger**:
   - URL: `http://localhost:5678/webhook/legal-metrology-inspect`
   - Method: `POST`
   - Content Type: `multipart/form-data`

2. **FastAPI Processing Request**:
   - HTTP Node: `POST http://localhost:8000/api/inspect`
   - Direct Execution: The FastAPI endpoint remains directly testable via cURL or Postman independent of n8n.

3. **Status Routing & Alerting Branching**:
   - Switch Node condition: `overall_status` in `['FAIL', 'NON_COMPLIANT']`.
   - On match, n8n invokes the enforcement notice dispatch pipeline, generating a formal notice and sending an alert email/SMS to the designated officer.
