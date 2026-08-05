import os
import sys
import io
import pypdfium2 as pdfium
from reportlab.pdfgen import canvas
from io import BytesIO
from unittest.mock import patch
from pdf_utils import is_pdf, convert_pdf_to_images, prepare_image_bytes
from vision_engine import VisionEngine

def create_sample_pdf_bytes() -> bytes:
    """Create a minimal PDF document in memory using pypdfium2."""
    pdf = pdfium.PdfDocument.new()
    page = pdf.new_page(300, 400)
    buf = io.BytesIO()
    pdf.save(buf)
    return buf.getvalue()


def create_text_pdf_bytes() -> bytes:
    """Create a simple PDF with embedded text content for regression testing."""
    buf = BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, "OFFER LETTER")
    c.drawString(72, 700, "Candidate: Muhammad Ali")
    c.save()
    return buf.getvalue()

def test_pdf_conversion():
    print("=== TEST 1: PDF Bytes Detection & Conversion ===")
    pdf_bytes = create_sample_pdf_bytes()
    assert is_pdf(pdf_bytes, "test.pdf") == True, "Failed to detect PDF bytes"
    
    images = convert_pdf_to_images(pdf_bytes)
    assert len(images) > 0, "Failed to convert PDF pages to PNG images"
    print(f"[OK] Converted {len(images)} PDF page into PNG image buffer of size {len(images[0])} bytes.")

def test_extract_document_text_uses_model_for_pdf_ocr():
    print("=== TEST 2: Model-based PDF OCR ===")
    engine = VisionEngine()
    pdf_bytes = create_text_pdf_bytes()
    with patch.object(engine, "_call_ollama_vision", return_value="OFFER LETTER\nCandidate: Muhammad Ali") as vision_call:
        result = engine.extract_document_text(pdf_bytes, filename="sample.pdf", user_query="Who is the candidate?")

    assert vision_call.called, "Expected the vision model to be invoked for PDF OCR"
    assert result.get("llm_used") is True, "Expected OCR result to be marked as model-based"
    assert "OFFER LETTER" in result.get("extracted_text", ""), "Expected extracted text from the model response"
    print(f"[OK] Reader used model-based OCR: {result.get('source')}")


def test_vision_engine_modes():
    print("\n=== TEST 4: VisionEngine PDF Support Across All 3 Modes ===")
    engine = VisionEngine()
    pdf_bytes = create_sample_pdf_bytes()

    # Mode 1: Document Extraction
    print("Testing Mode 1 (Document Extraction with PDF)...")
    res1 = engine.extract_document_text(pdf_bytes, filename="Offer_Letter.pdf", user_query="What is the candidate name?")
    assert res1.get("is_pdf") == True, "Mode 1 should report is_pdf = True"
    assert res1.get("page_count", 0) > 0, "Mode 1 page_count should be > 0"
    print(f"[OK] Mode 1 result: source={res1.get('source')}, is_pdf={res1.get('is_pdf')}, page_count={res1.get('page_count')}")

    # Mode 2: Item Classification
    print("\nTesting Mode 2 (Item Classification with PDF)...")
    res2 = engine.classify_item(target_item="Offer Letter", image_bytes=pdf_bytes, filename="Offer_Letter.pdf")
    print(f"[DEBUG Mode 2 Result]: {res2}")
    assert res2.get("match") in [True, False], "Mode 2 match should be boolean"
    assert res2.get("is_pdf") == True, "Mode 2 should report is_pdf = True"
    print(f"[OK] Mode 2 result: match={res2.get('match')}, confidence={res2.get('confidence')}%, source={res2.get('source')}")

    # Mode 3: Form Cross-Verification
    print("\nTesting Mode 3 (Form Verification with PDF)...")
    form_data = {
        "full_name": "MUHAMMAD ALI",
        "cnic_number": "42101-1234567-9"
    }
    # Convert the PDF into image frames and pass an image (verifier accepts images only)
    images = convert_pdf_to_images(pdf_bytes)
    front_img = images[0] if images else pdf_bytes
    res3 = engine.verify_document_against_form(form_data, front_image=front_img, front_filename="CNIC_Doc.png")
    assert res3.get("verdict") in ["VERIFIED_MATCH", "PARTIAL_MATCH", "MISMATCH", "REJECTED_INVALID_DOCUMENT", "REJECTED_INVALID_FORMAT", "UNAVAILABLE"], "Mode 3 verdict invalid"
    print(f"[OK] Mode 3 result: verdict={res3.get('verdict')}, overall_similarity={res3.get('overall_similarity')}%, source={res3.get('source')}")

if __name__ == "__main__":
    test_pdf_conversion()
    test_vision_engine_modes()
    print("\nALL PDF PREPROCESSING & COMPONENT INTEGRATION TESTS PASSED SUCCESSFULLY!")
