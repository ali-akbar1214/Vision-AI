from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import uvicorn

from vision_engine import VisionEngine

app = FastAPI(
    title="Ollama Vision & OCR FastAPI Microservice",
    description="Microservice providing OCR, Item Classification, and CNIC/Document Form Verification via local Ollama models",
    version="1.0.0"
)

# Enable CORS for Express and React frontend
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
API_KEY = os.getenv("API_KEY", "dev-api-key-change-in-production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

engine = VisionEngine()

# API Key dependency
async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing API key"
        )
    return x_api_key

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "FastAPI Vision & OCR Suite",
        "ollama_status": engine.check_ollama_status()
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/v1/ollama-status")
def get_ollama_status():
    return engine.check_ollama_status()

# -----------------------------------------------------------------
# Mode 1 Endpoint: OCR Document Extractor & Reader
# -----------------------------------------------------------------
@app.post("/api/v1/ocr-read")
async def ocr_read(
    file: UploadFile = File(...),
    query: Optional[str] = Form(None),
    api_key: str = Depends(verify_api_key)
):
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file uploaded.")
        
        result = engine.extract_document_text(
            image_bytes=image_bytes,
            filename=file.filename or "",
            user_query=query or ""
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------------------------------------------
# Mode 2 Endpoint: Item Classifier (Match / No Match)
# -----------------------------------------------------------------
@app.post("/api/v1/classify")
async def classify_item(
    target_item: str = Form(...),
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key)
):
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file uploaded.")
        
        result = engine.classify_item(
            target_item=target_item,
            image_bytes=image_bytes,
            filename=file.filename or ""
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------------------------------------------
# Mode 3 Endpoint: Document vs Form Cross-Verification
# -----------------------------------------------------------------
@app.post("/api/v1/verify-form")
async def verify_form(
    form_json: str = Form(...),
    front_file: UploadFile = File(...),
    back_file: Optional[UploadFile] = File(None),
    api_key: str = Depends(verify_api_key)
):
    try:
        form_data = json.loads(form_json)
        front_bytes = await front_file.read()
        back_bytes = None
        back_filename = ""
        if back_file:
            _back = await back_file.read()
            if _back and len(_back) > 0:
                back_bytes = _back
                back_filename = back_file.filename or ""

        if not front_bytes or len(front_bytes) == 0:
            raise HTTPException(status_code=400, detail="Front image of document is required.")

        result = engine.verify_document_against_form(
            form_data=form_data,
            front_image=front_bytes,
            front_filename=front_file.filename or "",
            back_image=back_bytes,
            back_filename=back_filename
        )
        return {"success": True, "data": result}

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in form_json string.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
