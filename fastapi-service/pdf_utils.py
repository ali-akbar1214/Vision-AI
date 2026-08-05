import io
import os
import re
from typing import List, Optional


def extract_text_from_pdf(pdf_bytes: bytes, max_pages: Optional[int] = None) -> str:
    """Extract text from a PDF using pypdfium2 when possible. Returns an empty string if unavailable."""
    if not pdf_bytes:
        return ""

    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(pdf_bytes)
        try:
            pages = []
            n_pages = min(len(pdf), max_pages) if max_pages is not None else len(pdf)
            for i in range(n_pages):
                page = pdf[i]
                try:
                    textpage = page.get_textpage()
                    text = textpage.get_text_range() if hasattr(textpage, "get_text_range") else ""
                    if hasattr(textpage, "close"):
                        textpage.close()
                finally:
                    # ensure page resources are released
                    page.close()
                if text:
                    pages.append(text.strip())

            if pages:
                return "\n\n".join(pages)
        finally:
            # ensure PDF handle is closed
            if hasattr(pdf, "close"):
                pdf.close()
    except Exception as e:
        print(f"[PDFUtils] Local PDF text extraction warning: {e}")

    return ""


def is_pdf(file_bytes: bytes, filename: str = "") -> bool:
    """Check if the provided bytes or filename represent a PDF file."""
    if not file_bytes:
        return False
    if file_bytes.startswith(b"%PDF"):
        return True
    if filename and filename.lower().endswith(".pdf"):
        return True
    return False

def convert_pdf_to_images(pdf_bytes: bytes, max_pages: Optional[int] = None) -> List[bytes]:
    """
    Convert raw PDF bytes to a list of PNG image byte buffers.
    Uses pypdfium2 as primary converter (no system binaries required).
    Falls back to pdf2image if available.
    """
    images_bytes: List[bytes] = []

    # Strategy 1: pypdfium2 (embedded pdfium renderer)
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_bytes)
        try:
            n_pages = min(len(pdf), max_pages) if max_pages is not None else len(pdf)
            for i in range(n_pages):
                page = pdf[i]
                try:
                    # scale=2 gives ~144 DPI for crisp vision LLM / OCR page rendering
                    bitmap = page.render(scale=2)
                    try:
                        pil_img = bitmap.to_pil()
                        buf = io.BytesIO()
                        pil_img.save(buf, format="PNG")
                        images_bytes.append(buf.getvalue())
                    finally:
                        # release bitmap resources
                        if hasattr(bitmap, "close"):
                            bitmap.close()
                finally:
                    # ensure page resources are released
                    page.close()

            if images_bytes:
                print(f"[PDFUtils] Converted {len(images_bytes)} PDF page(s) to PNG images using pypdfium2.")
                return images_bytes
        finally:
            if hasattr(pdf, "close"):
                pdf.close()
    except Exception as e:
        print(f"[PDFUtils] pypdfium2 conversion warning: {e}")

    # Strategy 2: pdf2image fallback
    try:
        from pdf2image import convert_from_bytes
        # If max_pages is None, convert_all pages; otherwise limit to max_pages
        if max_pages is None:
            pil_images = convert_from_bytes(pdf_bytes)
        else:
            pil_images = convert_from_bytes(pdf_bytes, first_page=1, last_page=max_pages)
        for img in pil_images:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            images_bytes.append(buf.getvalue())
        if images_bytes:
            print(f"[PDFUtils] Converted {len(images_bytes)} PDF page(s) using pdf2image.")
            return images_bytes
    except Exception as e:
        print(f"[PDFUtils] pdf2image conversion warning: {e}")

    return []

def prepare_image_bytes(file_bytes: bytes, filename: str = "", max_pages: Optional[int] = None) -> List[bytes]:
    """
    Given raw file bytes, return a list of valid image bytes.
    If input is PDF, renders PDF pages into PNG image frames.
    If input is a single image, returns a single-item list.

    NOTE: If PDF rendering fails, do NOT return raw PDF bytes as an "image" fallback
    because callers expect image frame bytes. Instead return an empty list so callers
    can decide to try text extraction or surface a clear error.
    """
    if not file_bytes:
        return []

    if is_pdf(file_bytes, filename):
        rendered_pages = convert_pdf_to_images(file_bytes, max_pages=max_pages)
        if rendered_pages:
            return rendered_pages
        # Conversion failed; do not return raw PDF bytes as if they were images
        print("[PDFUtils] Warning: Failed to convert PDF pages; no image frames available.")
        return []

    return [file_bytes]
