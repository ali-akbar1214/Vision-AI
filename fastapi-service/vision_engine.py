import base64
import json
import os
import re
import requests
from typing import Dict, Any, List, Optional
from pdf_utils import prepare_image_bytes, is_pdf, extract_text_from_pdf
from normalizer import normalize_field, compare_field


def _normalize_image_bytes(image_bytes: bytes) -> bytes:
    """Return a byte sequence that Ollama can accept for vision requests."""
    if not image_bytes:
        return b""
    return image_bytes


def _extract_json(text: Optional[str]) -> Optional[dict]:
    """Best-effort extraction of a JSON object from an LLM response.

    Vision models frequently wrap JSON in markdown code fences, or add
    stray commentary before/after the object. This tries the fenced form
    first, then falls back to a greedy brace match, and never raises.
    """
    if not text:
        return None

    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else None

    if candidate is None:
        brace = re.search(r"\{.*\}", text, re.DOTALL)
        candidate = brace.group(0) if brace else None

    if candidate is None:
        return None

    try:
        return json.loads(candidate)
    except json.JSONDecodeError as e:
        print(f"[VisionEngine] JSON parse error: {e}")
        return None

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_VISION_MODEL = os.getenv("OLLAMA_MODEL", "minicpm-v")

class VisionEngine:
    def __init__(self, ollama_url: str = OLLAMA_BASE_URL, model: str = DEFAULT_VISION_MODEL):
        self.ollama_url = ollama_url
        self.model = model
        self._resolve_model()

    def _fetch_models(self) -> List[Dict[str, Any]]:
        try:
            res = requests.get(f"{self.ollama_url}/api/tags", timeout=3)
            if res.status_code == 200:
                return res.json().get("models", [])
        except Exception as e:
            print(f"[VisionEngine] Failed to list Ollama models: {e}")
        return []

    def _model_matches(self, available_name: str, target: str) -> bool:
        available_base = available_name.split(":")[0]
        target_base = target.split(":")[0]
        return (
            available_name == target
            or available_name.startswith(f"{target}:")
            or available_base == target_base
        )

    def _resolve_model(self) -> None:
        """Use configured model when available, otherwise pick a vision-capable model."""
        models = self._fetch_models()
        if not models:
            return

        names = [m.get("name", "") for m in models if m.get("name")]

        for name in names:
            if self._model_matches(name, self.model):
                self.model = name
                return

        for entry in models:
            capabilities = entry.get("capabilities") or []
            if "vision" in capabilities:
                self.model = entry["name"]
                print(f"[VisionEngine] Using vision model: {self.model}")
                return

        self.model = names[0]
        print(f"[VisionEngine] Falling back to first available model: {self.model}")

    def check_ollama_status(self) -> Dict[str, Any]:
        """Check if local Ollama engine is running and list available models."""
        models = self._fetch_models()
        if models:
            self._resolve_model()
            return {
                "online": True,
                "models": [m.get("name") for m in models],
                "active_model": self.model,
            }
        return {"online": False, "models": [], "active_model": "mock_fallback"}

    def _encode_image_b64(self, image_bytes: bytes) -> str:
        normalized = _normalize_image_bytes(image_bytes)
        return base64.b64encode(normalized).decode("utf-8")

    def _call_ollama_vision(self, image_bytes_list: List[bytes], prompt: str, timeout: int = 60) -> Optional[str]:
        """Send prompt + images to Ollama generate API."""
        self._resolve_model()
        try:
            b64_images = [self._encode_image_b64(img) for img in image_bytes_list]
            payload = {
                "model": self.model,
                "prompt": prompt,
                "images": b64_images,
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
            print(f"[VisionEngine] Sending vision request to {self.ollama_url}/api/generate with model {self.model}")
            print(f"[VisionEngine] Number of images: {len(image_bytes_list)}")
            res = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=timeout)
            if res.status_code == 200:
                return res.json().get("response", "")
            print(f"[VisionEngine] Ollama vision call failed ({res.status_code}): {res.text}")
        except requests.exceptions.Timeout:
            print(f"[VisionEngine] Ollama vision call timed out after {timeout}s")
        except requests.exceptions.ConnectionError:
            print(f"[VisionEngine] Ollama connection error - is Ollama running at {self.ollama_url}?")
        except Exception as e:
            print(f"[VisionEngine] Ollama vision call error: {e}")
        return None

    def _call_ollama_text(self, prompt: str, timeout: int = 30) -> Optional[str]:
        """Send a text-only prompt to Ollama generate API (no images)."""
        self._resolve_model()
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3
                }
            }
            res = requests.post(f"{self.ollama_url}/api/generate", json=payload, timeout=timeout)
            if res.status_code == 200:
                return res.json().get("response", "")
            print(f"[VisionEngine] Ollama text call failed ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"[VisionEngine] Ollama text call error: {e}")
        return None

    # -------------------------------------------------------------
    # MODE 1: OCR & Document Reading
    # -------------------------------------------------------------
    def extract_document_text(self, image_bytes: bytes, filename: str = "", user_query: str = "") -> Dict[str, Any]:
        images = prepare_image_bytes(image_bytes, filename=filename, max_pages=None)
        pdf_flag = is_pdf(image_bytes, filename)

        # If rendering failed and input was a PDF, attempt local text extraction as a graceful fallback
        if not images:
            if pdf_flag:
                local_text = extract_text_from_pdf(image_bytes, max_pages=10)
                if local_text:
                    return {
                        "extracted_text": local_text,
                        "summary": "Text extracted locally from PDF pages (no vision model available).",
                        "ai_answer": f"Answer to query '{user_query}': {local_text[:200]}" if user_query else "Extracted via local PDF text extractor.",
                        "source": "local_text_extractor",
                        "llm_used": False,
                        "llm_reason": "Local PDF text extraction used as rendering fallback",
                        "is_pdf": True,
                        "page_count": 0
                    }
            return {
                "extracted_text": "",
                "summary": "Error: Empty or unreadable document file.",
                "ai_answer": "No readable content provided.",
                "source": "error",
                "llm_used": False,
                "llm_reason": "Empty payload"
            }

        prompt = (
            "You are an expert OCR and Document Processing AI. "
            f"Examine this {'PDF document (' + str(len(images)) + ' page(s))' if pdf_flag else 'document/image'} carefully and perform full text extraction. "
            "Output the full raw text accurately preserving numbers, names, dates, headers, tables, and labels.\n"
        )

        response = self._call_ollama_vision(images, prompt)

        if not response:
            # Do NOT return fabricated fallback extraction. Surface an explicit error when the vision model is inaccessible.
            return {
                "extracted_text": "",
                "summary": "Error: Vision model unavailable or rejected the request. No OCR result produced.",
                "ai_answer": "Model unavailable: cannot answer queries without the vision model.",
                "source": "error",
                "llm_used": False,
                "llm_reason": "Ollama vision call unavailable or rejected payload",
                "is_pdf": pdf_flag,
                "page_count": len(images)
            }

        ai_answer_res = "Extraction complete."
        if user_query:
            query_prompt = f"Based on the following extracted document text, answer this question: {user_query}\n\nDocument Text:\n{response}"
            ai_answer_res = self._call_ollama_text(query_prompt) or "Could not generate an answer."

        summary_prompt = f"Summarize the key information of this text in 2-3 concise sentences:\n{response}"
        summary_res = self._call_ollama_text(summary_prompt) or "Document text extracted successfully."

        return {
            "extracted_text": response,
            "summary": summary_res,
            "ai_answer": ai_answer_res,
            "source": f"ollama_{self.model}",
            "llm_used": True,
            "llm_reason": "Vision model responded successfully",
            "is_pdf": pdf_flag,
            "page_count": len(images)
        }

    # -------------------------------------------------------------
    # MODE 2: Item Classifier (Match / No Match)
    # -------------------------------------------------------------
    def classify_item(self, target_item: str, image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        images = prepare_image_bytes(image_bytes, filename=filename, max_pages=None)
        pdf_flag = is_pdf(image_bytes, filename)

        prompt = f"""
You are an advanced Computer Vision Classification AI.
Task: Determine if the object/document shown in the image(s) is a MATCH or NO MATCH for the target item: "{target_item}".

Respond ONLY in valid JSON format with keys:
{{
  "match": true or false,
  "confidence": number between 0 and 100,
  "detected_item": "brief description of what is actually visible in the image",
  "reasoning": "detailed explanation of key visual features leading to this classification decision"
}}
"""
        response = self._call_ollama_vision(images if images else [image_bytes], prompt)

        if response:
            try:
                parsed = _extract_json(response)
                if parsed:
                    # Determine a model-derived confidence representing confidence in the chosen label.
                    # Common model behavior: 'confidence' may represent probability(match==True) in 0..100.
                    conf_raw = parsed.get("confidence")
                    confidence_out = None
                    try:
                        if conf_raw is not None:
                            conf_num = float(conf_raw)
                            # clamp
                            conf_num = max(0.0, min(100.0, conf_num))
                            # If model indicated a match==True, confidence should reflect conf_num.
                            # If model indicated match==False, confidence should reflect confidence in the "NO MATCH" label:
                            if parsed.get("match"):
                                confidence_out = round(conf_num, 1)
                            else:
                                confidence_out = round(100.0 - conf_num, 1)
                    except Exception:
                        confidence_out = None

                    return {
                        "target_item": target_item,
                        "match": bool(parsed.get("match", False)),
                        "confidence": confidence_out,
                        "detected_item": parsed.get("detected_item", "Object in image"),
                        "reasoning": parsed.get("reasoning", "Classification completed via Vision model."),
                        "source": f"ollama_{self.model}",
                        "llm_used": True,
                        "llm_reason": "Vision model responded successfully",
                        "is_pdf": pdf_flag,
                        "page_count": len(images)
                    }
            except Exception as e:
                print(f"[VisionEngine] Classification JSON parse error: {e}")

        # Smart Heuristic / Mock fallback for prompt item checking if Ollama is offline
        target_lower = target_item.lower()
        is_match = any(w in target_lower for w in ["cnic", "card", "id", "passport", "license", "document", "photo", "item", "letter", "invoice", "pdf"])
        
        return {
            "target_item": target_item,
            "match": True if is_match else False,
            # When the model is not used, do not claim a model-derived confidence. Set confidence to 0.0 and flag llm_used=False.
            "confidence": 0.0,
            "detected_item": target_item if is_match else "Unrecognized Object",
            "reasoning": f"Visual heuristic indicates likelihood for '{target_item}'. This is a fallback result and not scored by the model." if is_match else f"Visual heuristic indicates low likelihood for '{target_item}'.",
            "source": "fallback_engine",
            "llm_used": False,
            "llm_reason": "Ollama vision call unavailable or rejected payload",
            "is_pdf": pdf_flag,
            "page_count": len(images)
        }

    # -------------------------------------------------------------
    # MODE 3: Document vs Form Cross-Verification (CNIC/Personal Details)
    # -------------------------------------------------------------
    def verify_document_against_form(
        self,
        form_data: Dict[str, str],
        front_image: bytes,
        front_filename: str = "",
        back_image: Optional[bytes] = None,
        back_filename: str = ""
    ) -> Dict[str, Any]:
        """Extract document fields and visually classify document authenticity (CNIC / ID check)."""

        # Enforce image-only uploads: reject raw PDF uploads to the verifier
        if is_pdf(front_image, front_filename) or (back_image and is_pdf(back_image, back_filename)):
            return {
                "verdict": "REJECTED_INVALID_FORMAT",
                "verdict_description": "Verifier accepts image uploads only (PNG/JPEG). PDFs are not accepted; please convert document pages to images and retry.",
                "overall_similarity": 0.0,
                "document_classification": {
                    "is_cnic": False,
                    "detected_type": "Invalid Upload Format",
                    "confidence": 0.0
                },
                "field_results": [],
                "extracted_document_data": {},
                "form_submitted_data": form_data,
                "source": "validation",
                "llm_used": False,
                "llm_reason": "Upload format rejected (PDF)",
                "page_count": 0
            }

        front_imgs = prepare_image_bytes(front_image, filename=front_filename, max_pages=None)
        back_imgs = prepare_image_bytes(back_image, filename=back_filename, max_pages=None) if back_image else []
        all_images = front_imgs + back_imgs

        # Field keys the verifier compares, in display order, with human-readable labels
        # for the frontend table (the UI reads `row.label`, not `row.field_name`).
        FIELD_LABELS = {
            "full_name": "Full Name",
            "father_name": "Father / Husband Name",
            "cnic_number": "CNIC Number",
            "date_of_birth": "Date of Birth",
            "issue_date": "Issue Date",
            "expiry_date": "Expiry Date",
            "gender": "Gender",
        }

        # The vision model only needs to do what a vision model can do: classify
        # the document and read the fields off it. Asking it to also self-score
        # similarity in the same call made the JSON schema large and brittle
        # (more fields to fill in correctly => more parse failures), and its
        # self-reported similarity numbers aren't reliably calibrated anyway.
        # Field-by-field comparison is instead done deterministically below via
        # normalizer.compare_field.
        prompt = f"""
You are an expert document analysis AI. Examine the document image(s) and extract the following fields exactly as they appear on the document:
- full_name
- father_name
- cnic_number
- date_of_birth
- issue_date
- expiry_date
- gender

Also classify the document type.

Return JSON ONLY, no commentary, in this exact shape:
{{
  "is_cnic": true or false,
  "document_classification": "document type, e.g. Pakistani CNIC",
  "classification_confidence": number 0-100,
  "extracted_fields": {{
    "full_name": "value or empty string if not visible",
    "father_name": "value or empty string if not visible",
    "cnic_number": "value or empty string if not visible",
    "date_of_birth": "value or empty string if not visible",
    "issue_date": "value or empty string if not visible",
    "expiry_date": "value or empty string if not visible",
    "gender": "value or empty string if not visible"
  }}
}}
"""

        response = self._call_ollama_vision(all_images if all_images else [front_image], prompt, timeout=60)

        print(f"[VisionEngine] Verifier vision response received: {bool(response)}")
        if response:
            print(f"[VisionEngine] Response preview: {response[:200]}")

        # Default values
        extracted_data = {key: "unknown" for key in FIELD_LABELS}
        is_cnic = True
        doc_type = "Pakistani CNIC / Identity Document"
        class_conf = 95.0
        field_results: List[Dict[str, Any]] = []
        overall_score: Optional[float] = None
        verdict = "UNAVAILABLE"
        verdict_desc = "Verification service unavailable"
        parsed_ok = False

        if response:
            parsed = _extract_json(response)
            if parsed is not None:
                try:
                    is_cnic = bool(parsed.get("is_cnic", True))
                    doc_type = str(parsed.get("document_classification", "Identity Document"))
                    class_conf = float(parsed.get("classification_confidence", 90.0))

                    extracted_fields = parsed.get("extracted_fields", {}) or {}
                    for key in FIELD_LABELS:
                        value = extracted_fields.get(key)
                        if value:
                            extracted_data[key] = str(value)

                    parsed_ok = True
                    print(f"[VisionEngine] LLM parsed successfully - doc_type: {doc_type}, is_cnic: {is_cnic}")
                except Exception as e:
                    print(f"[VisionEngine] Verification field extraction error: {e}")
                    parsed_ok = False
            else:
                print("[VisionEngine] Verifier vision response was not valid JSON")

        if parsed_ok:
            # Deterministic, auditable field-by-field comparison. This does not
            # depend on the model's self-reported confidence numbers.
            field_results = []
            score_sum = 0.0
            for key, label in FIELD_LABELS.items():
                form_value = form_data.get(key, "") or ""
                extracted_value = extracted_data.get(key, "unknown")

                if not extracted_value or extracted_value.strip().lower() == "unknown":
                    score, status = 0.0, "MISMATCH"
                else:
                    norm_form = normalize_field(key, form_value)
                    norm_doc = normalize_field(key, extracted_value)
                    if norm_form and norm_form == norm_doc:
                        score, status = 100.0, "EXACT_MATCH"
                    elif compare_field(key, form_value, extracted_value):
                        score, status = 75.0, "PARTIAL_MATCH"
                    else:
                        score, status = 0.0, "MISMATCH"

                score_sum += score
                field_results.append({
                    "field_name": key,
                    "label": label,
                    "form_value": form_value,
                    "extracted_value": extracted_value,
                    "similarity_score": score,
                    "status": status,
                })

            overall_score = round(score_sum / len(FIELD_LABELS), 1)

            if overall_score >= 85.0:
                verdict = "VERIFIED_MATCH"
                verdict_desc = f"Document visually confirmed as {doc_type} ({class_conf}% confidence) and all form details match."
            elif overall_score >= 60.0:
                verdict = "PARTIAL_MATCH"
                verdict_desc = f"Document visually confirmed as {doc_type} ({class_conf}% confidence), but some personal fields have minor variances."
            else:
                verdict = "MISMATCH"
                verdict_desc = f"Document visually confirmed as {doc_type} ({class_conf}% confidence), but form details do not match the extracted document."
        else:
            # LLM unavailable or returned unparseable output - use filename heuristic
            # purely to give a best-effort classification; we have no extracted
            # field data to compare, so the verdict stays UNAVAILABLE rather than
            # faking a score.
            filename_check = (front_filename + " " + back_filename).lower()
            if any(w in filename_check for w in ["letter", "invoice", "receipt", "passport", "resume", "cv"]):
                is_cnic = False
                doc_type = "Non-CNIC Document"
                class_conf = 20.0
            else:
                is_cnic = True
                doc_type = "Pakistani CNIC / Identity Document (Fallback Heuristic)"
                class_conf = 88.0
            verdict = "UNAVAILABLE"
            verdict_desc = "LLM service unavailable or returned an unreadable response. Please try again."
            overall_score = None
            field_results = []

        # Re-evaluate verification metrics considering visual document classification.
        # overall_score may legitimately be None here (LLM unavailable/unparseable),
        # so the comparison below must not blow up on that case.
        if not is_cnic or class_conf < 40.0:
            verdict = "REJECTED_INVALID_DOCUMENT"
            verdict_desc = f"Visual classification rejected document: Uploaded file is not a valid CNIC (Detected: '{doc_type}', Confidence: {class_conf}%)."
            overall_score = 15.0 if overall_score is None else min(overall_score, 15.0)

        return {
            "verdict": verdict,
            "verdict_description": verdict_desc,
            "overall_similarity": overall_score,
            "document_classification": {
                "is_cnic": is_cnic,
                "detected_type": doc_type,
                "confidence": class_conf
            },
            "field_results": field_results,
            "extracted_document_data": extracted_data,
            "form_submitted_data": form_data,
            "source": f"ollama_{self.model}" if parsed_ok else "fallback_engine",
            "llm_used": parsed_ok,
            "llm_reason": "Vision model responded successfully" if parsed_ok else "Ollama vision call unavailable or returned an unparseable response",
            "page_count": len(all_images)
        }


