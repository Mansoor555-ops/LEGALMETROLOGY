# Data Governance & Privacy Policy — Legal Metrology Compliance Assistant

This document outlines data retention policies, image payload handling, and provider-side model training terms for the Legal Metrology Compliance Assistant.

---

## 🔒 1. Data Transmitted to Gemini API

- **Payload Contents**: Downscaled label images (capped at ~1600px long edge, JPEG quality ~85) and structured prompts requesting Rule 6 field extractions.
- **Excluded Content**: No PII, facial data, or personal biometric information is extracted or transmitted.

---

## 🕒 2. Data Retention Period

- **Local / MongoDB Storage**: Raw inspection records, image uploads, and officer corrections are retained for **90 days** in the `inspections`, `violations`, and `corrections` collections for regulatory audit trails.
- **Session Cache**: SHA256 image byte hashes are cached in memory for the duration of an active inspection session and cleared upon completion.

---

## 🛡️ 3. Google Gemini Provider Training Policy

> [!IMPORTANT]
> **No Provider-Side Model Training:**
> When calling Google Gemini API via enterprise API keys (`genai.Client(api_key=...)`), data transmitted via paid/paid-tier API requests is **NOT used to train or improve Google models**. Data remains confidential to the API project organization under Google Cloud's Service Specific Terms and Data Governance Agreement.

---

## 🔄 4. Officer Feedback Loop Clarification

- Officer field overrides submitted via `/api/inspections/{id}/override` are saved in the `corrections` collection.
- These corrections are re-injected as **few-shot prompt context** and **RAG document index entries**.
- **Explicit Clarification**: This feedback loop is an in-context learning mechanism and does **NOT constitute literal fine-tuning** of Google Gemini foundation weights.
