# Vision OCR Suite

A locally-hosted document intelligence system for text extraction, visual item classification, and identity-document verification. The system runs entirely on local infrastructure — a React client, an Express API gateway, a FastAPI inference microservice, and a locally hosted vision-language model served through Ollama — with no document data leaving the host machine.

---

## 1. System Architecture

The application is a three-tier service chain. The client never talks to the inference layer directly; every request is proxied and authenticated through the Express gateway.

```
┌────────────────────┐
│   React Client      │   Vite dev server — http://localhost:3000
│   (Doc Reader,       │   Sends multipart/form-data requests to /api/*
│   Item Classifier,   │   Vite dev proxy forwards /api → :5000
│   Form Verifier)     │
└──────────┬──────────┘
           │ HTTP (multipart/form-data)
           ▼
┌────────────────────┐
│  Express Gateway     │   http://localhost:5000
│  server/src/index.js │   - CORS
│                       │   - x-api-key auth (all /api/* routes)
│                       │   - Rate limiting (100 req / 15 min general,
│                       │     20 req / 15 min on upload routes)
│                       │   - multer (in-memory file buffering)
└──────────┬──────────┘
           │ HTTP (multipart/form-data, x-api-key forwarded)
           ▼
┌────────────────────┐
│  FastAPI Microservice│   http://localhost:8000
│  fastapi-service/     │   - x-api-key auth (per-route dependency)
│  main.py               │   - PDF → image normalization (pdf_utils.py)
│                         │   - Deterministic field comparison (normalizer.py)
│                         │   - Prompt construction + response parsing
└──────────┬──────────┘
           │ HTTP (base64-encoded image payload)
           ▼
┌────────────────────┐
│  Ollama Runtime       │   http://localhost:11434
│  vision_engine.py      │   Model: minicpm-v (configurable via
│                         │   OLLAMA_MODEL; auto-falls back to any
│                         │   locally installed vision-capable model)
└─────────────────────┘
```

Each layer degrades independently rather than failing the whole request:

- If the **FastAPI service is unreachable**, the Express gateway returns a clearly labeled fallback/unavailable response instead of erroring out, so the UI stays usable.
- If **Ollama is unreachable** but FastAPI is up, `vision_engine.py` returns an explicit `"source": "fallback_engine"` / `"llm_used": false` result rather than fabricating extracted data.
- If a **PDF fails to rasterize**, the OCR pipeline falls back to local text extraction (`pypdfium2`) before giving up entirely.

This fallback behavior is intentional: every response includes a `source` and `llm_used` field so the client can distinguish a genuine model result from a degraded/offline one.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, lucide-react |
| API Gateway | Node.js, Express 4, multer, axios, express-rate-limit |
| Inference Service | Python, FastAPI, Uvicorn |
| Vision Model Runtime | Ollama (local), `minicpm-v` |
| PDF Handling | pypdfium2 (primary), pdf2image/Poppler (fallback) |
| Auth | Shared API key (`x-api-key` header), validated at both the gateway and the microservice |

> Note: `MONGODB_URI` is present in `server/.env.example` as a placeholder for future persistence (e.g. verification audit logs), but no database layer is currently wired into the request path — all processing today is stateless, request/response only.

---

## 3. Core Modes

### Mode 1 — Document Reader (OCR + Q&A)

Extracts full text from an uploaded image or PDF, generates a summary, and can answer a free-text question about the document.

```
Client                Express                 FastAPI                 Ollama
  │  POST /api/reader/extract               │                          │
  │  (file, query?)                          │                          │
  ├──────────────────────►                   │                          │
  │                        │ POST /api/v1/ocr-read                      │
  │                        ├──────────────────►                        │
  │                        │                  │ if PDF: rasterize pages │
  │                        │                  │ (pypdfium2 → pdf2image) │
  │                        │                  ├─────────────────────────►
  │                        │                  │  generate: full-text OCR prompt
  │                        │                  ◄─────────────────────────┤
  │                        │                  │ if query given:         │
  │                        │                  │  generate: answer prompt│
  │                        │                  ├─────────────────────────►
  │                        │                  ◄─────────────────────────┤
  │                        │                  │  generate: summary prompt
  │                        │                  ├─────────────────────────►
  │                        │                  ◄─────────────────────────┤
  │                        ◄──────────────────┤ {extracted_text, summary,
  │                        │                  │  ai_answer, source,      │
  │                        │                  │  llm_used, page_count}   │
  ◄────────────────────────┤                  │                          │
  │  {success, data}       │                  │                          │
```

If PDF rasterization fails, `pdf_utils.extract_text_from_pdf` runs a text-layer extraction pass instead of returning nothing. If the vision model call itself fails, the response reports `source: "error"` with `llm_used: false` rather than inventing text.

---

### Mode 2 — Item Classifier (Match / No Match)

Compares an uploaded image against a target label and returns a match verdict with confidence and reasoning.

```
Client                 Express                  FastAPI                  Ollama
  │ POST /api/classify                        │                          │
  │ (file, target_item)                       │                          │
  ├──────────────────────►                    │                          │
  │                        │ POST /api/v1/classify                       │
  │                        ├──────────────────►                         │
  │                        │                   │ generate: classification │
  │                        │                   │ prompt (JSON schema)     │
  │                        │                   ├──────────────────────────►
  │                        │                   ◄──────────────────────────┤
  │                        │                   │ parse JSON (fenced or    │
  │                        │                   │ brace-matched fallback)  │
  │                        ◄───────────────────┤ {match, confidence,      │
  │                        │                   │  detected_item, reasoning}│
  ◄────────────────────────┤                   │                          │
  │  {success, data}       │                   │                          │
```

If the model response can't be parsed into JSON, or Ollama is unreachable, a keyword-based heuristic fallback is used and the response is explicitly flagged `source: "fallback_engine"`, `llm_used: false` — the confidence score in that case is reported as `0.0` rather than a fabricated number.

---

### Mode 3 — Form Verifier (Document vs. Submitted Data)

Cross-checks a set of submitted form fields (name, father's/husband's name, CNIC number, dates, gender) against what the vision model reads off an uploaded identity document image.

```
Client                  Express                    FastAPI                     Ollama
  │ POST /api/verify                          │                              │
  │ (front_image, back_image?, form_data)     │                              │
  ├──────────────────────►                    │                              │
  │  Express rejects PDFs before forwarding    │                              │
  │  (image-only: PNG/JPEG)                    │                              │
  │                        │ POST /api/v1/verify-form                        │
  │                        ├──────────────────►                             │
  │                        │                   │ reject if PDF (defense-in-depth)
  │                        │                   │ generate: field-extraction  │
  │                        │                   │ + classification prompt     │
  │                        │                   ├──────────────────────────────►
  │                        │                   ◄──────────────────────────────┤
  │                        │                   │ per field:                  │
  │                        │                   │  normalize (dates/CNIC/gender)
  │                        │                   │  compare submitted ↔ extracted
  │                        │                   │  → EXACT_MATCH / PARTIAL_MATCH
  │                        │                   │    / MISMATCH + numeric score
  │                        │                   │ aggregate → overall_similarity
  │                        ◄───────────────────┤ {verdict, field_results,     │
  │                        │                   │  document_classification,    │
  │                        │                   │  extracted_document_data}    │
  ◄────────────────────────┤                   │                              │
  │  {success, data}       │                   │                              │
```

**Why field comparison is deterministic, not model-scored:** the vision model is only asked to classify the document and transcribe the fields off it. Field-by-field similarity is then computed in `normalizer.py` (date-format normalization, CNIC digit-stripping, gender canonicalization) rather than asking the model to self-report a similarity score — this keeps the score auditable and avoids the model's own confidence numbers, which aren't reliably calibrated.

**Verdict thresholds** (computed from the mean field score):

| Overall Score | Verdict |
|---|---|
| ≥ 85 | `VERIFIED_MATCH` |
| 60 – 84.9 | `PARTIAL_MATCH` |
| < 60 | `MISMATCH` |
| Document not classified as a valid ID, or classification confidence < 40% | `REJECTED_INVALID_DOCUMENT` (overrides the above) |
| PDF submitted instead of an image | `REJECTED_INVALID_FORMAT` |
| Model unreachable / response unparseable | `UNAVAILABLE` |

---

## 4. API Reference

### Express Gateway — `http://localhost:5000`

All routes under `/api` require an `x-api-key` header matching `API_KEY`.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Gateway liveness check (no auth) |
| GET | `/api/status` | Reports FastAPI + Ollama online status and active model |
| POST | `/api/reader/extract` | Mode 1 — OCR + optional Q&A. Body: `file`, `query?` |
| POST | `/api/classify` | Mode 2 — Item match classification. Body: `file`, `target_item` |
| POST | `/api/verify` | Mode 3 — Form verification. Body: `front_image`, `back_image?`, `form_data` (JSON string) |

### FastAPI Microservice — `http://localhost:8000`

All routes below `/api/v1` require an `x-api-key` header matching `API_KEY`.

| Method | Route | Description |
|---|---|---|
| GET | `/` | Service info + live Ollama status |
| GET | `/health` | Liveness check (no auth) |
| GET | `/api/v1/ollama-status` | Lists locally available Ollama models and the active model |
| POST | `/api/v1/ocr-read` | Full-text extraction + summary + optional Q&A |
| POST | `/api/v1/classify` | Image-vs-label match classification |
| POST | `/api/v1/verify-form` | Document vs. submitted-form field verification |

---

## 5. Project Structure

```
final internship project/
├── client/                       React + Vite frontend (port 3000)
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── DocReaderMode.jsx
│           ├── ItemClassifierMode.jsx
│           ├── FormVerifierMode.jsx
│           └── Sidebar.jsx
│
├── server/                       Express API gateway (port 5000)
│   ├── .env.example
│   └── src/
│       ├── index.js              App entry, CORS/auth/rate-limit middleware
│       └── routes/api.js         /api/reader, /api/classify, /api/verify, /api/status
│
└── fastapi-service/               Inference microservice (port 8000)
    ├── main.py                    FastAPI app, route definitions, auth dependency
    ├── vision_engine.py           Ollama integration, prompt construction, JSON parsing
    ├── normalizer.py              Field normalization + comparison logic
    ├── pdf_utils.py                PDF detection, rasterization, text fallback
    ├── test_pdf_processing.py
    ├── requirements.txt
    └── requirements-dev.txt
```

---

## 6. Environment Variables

**`server/.env`**

```env
PORT=5000
FASTAPI_URL=http://localhost:8000
API_KEY=<shared-secret-matching-fastapi-service>
MONGODB_URI=mongodb://127.0.0.1:27017/vision_ocr_db   # reserved, not yet used
```

**`fastapi-service/.env`**

```env
FRONTEND_ORIGIN=http://localhost:3000
API_KEY=<shared-secret-matching-server>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=minicpm-v
```

`API_KEY` must match between the two services — the Express gateway forwards it on every proxied request, and FastAPI independently validates it on every `/api/v1/*` route.

---

## 7. Running the Project

Three processes run concurrently. VS Code tasks are provided (`.vscode/tasks.json`) for the two service processes.

**1. Ollama (vision model runtime)**

```bash
ollama serve
ollama pull minicpm-v
```

**2. FastAPI inference service**

```bash
cd fastapi-service
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python main.py                 # http://localhost:8000
```

**3. Express API gateway**

```bash
cd server
npm install
npm run dev                    # http://localhost:5000 (nodemon)
```

**4. React client**

```bash
cd client
npm install
npm run dev                    # http://localhost:3000
```

The Vite dev server proxies all `/api` requests to the Express gateway (configured in `client/vite.config.js`), so the client only ever needs to know about `http://localhost:3000`.

---

## 8. Security Notes

- **Authentication:** a shared `x-api-key` secret gates every processing route at both the gateway and the microservice — not just at the edge.
- **CORS:** the FastAPI service restricts `allow_origins` to a single configured `FRONTEND_ORIGIN` rather than accepting all origins.
- **Rate limiting:** the gateway applies a general limit (100 requests / 15 min per IP) and a stricter upload-specific limit (20 requests / 15 min per IP) to the processing endpoints.
- **Format enforcement:** the Form Verifier rejects PDF uploads at both the gateway and the microservice (defense-in-depth) since that mode is designed around single-page identity-document images.
- **No fabricated results:** every failure path — offline model, unparseable response, failed PDF render — returns an explicitly labeled fallback/error rather than a plausible-looking but fake result, so downstream consumers of the API can distinguish real inference from degraded service.

---

## 9. Known Gaps / Next Steps

- `MONGODB_URI` is defined but no persistence layer is implemented yet — verification results and OCR history are not currently stored.
- Confidence scores from the classifier (`vision_engine.classify_item`) rely on the model self-reporting a probability; this is not independently calibrated.
- No automated test suite beyond `fastapi-service/test_pdf_processing.py`.
- Single shared API key rather than per-user/service credentials.

---

## 10. License

This project is intended for educational, research, and development purposes.
