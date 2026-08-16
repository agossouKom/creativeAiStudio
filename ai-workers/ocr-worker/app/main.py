"""
OCR Worker — Creative AI Studio
Moteur primaire : Groq Llama-3.2 Vision (gratuit, ~1 s/image)
Fallback        : Tesseract (si GROQ_API_KEY absent)
"""
import os
import io
import base64
import logging

import fitz          # PyMuPDF
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_OCR_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

# ─── Client Groq (lazy) ─────────────────────────────────────────────────────
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None and GROQ_API_KEY:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


# ─── Normalisation image → JPEG bytes ───────────────────────────────────────
def _to_jpeg_bytes(image_bytes: bytes) -> bytes:
    """Convertit n'importe quel format image en JPEG (pour l'API Groq)."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        # Fallback Pillow (WebP, TIFF, etc.)
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=90)
        return buf.getvalue()
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return buf.tobytes()


# ─── OCR via Groq Vision LLM ─────────────────────────────────────────────────
def _ocr_groq(image_bytes: bytes) -> str:
    client = get_groq_client()
    if client is None:
        raise RuntimeError("GROQ_API_KEY non configuree")

    jpeg = _to_jpeg_bytes(image_bytes)
    b64  = base64.b64encode(jpeg).decode()

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
                },
                {
                    "type": "text",
                    "text": (
                        "Extrait tout le texte visible dans cette image exactement tel qu'il apparait. "
                        "Conserve les sauts de ligne, la mise en forme et la ponctuation. "
                        "Reponds UNIQUEMENT avec le texte extrait, sans commentaire ni explication."
                    )
                }
            ]
        }],
        max_tokens=4096,
        temperature=0,
    )
    return response.choices[0].message.content.strip()


# ─── OCR via Tesseract (fallback) ────────────────────────────────────────────
def _ocr_tesseract(image_bytes: bytes) -> str:
    try:
        import pytesseract
        nparr = np.frombuffer(image_bytes, np.uint8)
        img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        else:
            pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        return pytesseract.image_to_string(pil, lang="fra+eng")
    except Exception as e:
        logger.warning("Tesseract indisponible: %s", e)
        return "[OCR indisponible — configurez GROQ_API_KEY pour activer le LLM Vision]"


# ─── Point d'entrée public ───────────────────────────────────────────────────
def extract_text_from_image_bytes(image_bytes: bytes) -> str:
    if GROQ_API_KEY:
        logger.info("OCR via Groq (%s)", GROQ_MODEL)
        return _ocr_groq(image_bytes)
    else:
        logger.info("OCR via Tesseract (GROQ_API_KEY absent)")
        return _ocr_tesseract(image_bytes)


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extrait le texte d'un PDF. Pages scannees → OCR."""
    doc  = fitz.open(stream=pdf_bytes, filetype="pdf")
    full = []
    for i, page in enumerate(doc):
        native = page.get_text().strip()
        if native:
            full.append(native)
        else:
            logger.info("Page %d scannee — OCR", i + 1)
            pix       = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("jpeg")
            full.append(extract_text_from_image_bytes(img_bytes))
    doc.close()
    return "\n\n".join(full)


# ─── FastAPI ──────────────────────────────────────────────────────────────────
app = FastAPI(title="Creative AI Studio - OCR Worker", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/ocr/image")
async def ocr_image(file: UploadFile = File(...)):
    data = await file.read()
    try:
        text = extract_text_from_image_bytes(data)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"status": "ok", "text": text, "chars": len(text)}


@app.post("/ocr/pdf")
async def ocr_pdf(file: UploadFile = File(...)):
    data = await file.read()
    try:
        text = extract_text_from_pdf_bytes(data)
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"status": "ok", "text": text, "chars": len(text)}


@app.get("/health")
async def health():
    engine = "groq-vision" if GROQ_API_KEY else "tesseract"
    return {"service": "ocr-worker", "status": "online", "version": "2.0.0", "engine": engine}
