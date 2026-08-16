import os
import io
import fitz  # PyMuPDF
import logging
import subprocess
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pdf2docx import Converter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Creative AI Studio - PDF Worker", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


IMAGE_SIGS = {
    b"\x89PNG":    "png",
    b"\xff\xd8\xff": "jpeg",
    b"GIF8":       "gif",
    b"RIFF":       "webp",  # RIFF....WEBP
    b"BM":         "bmp",
}

def _detect_type(data: bytes) -> str:
    """Retourne 'pdf', 'image', 'docx', 'doc', 'txt' selon les magic bytes."""
    h = data[:8]
    if h[:4] == b"%PDF":
        return "pdf"
    for sig, fmt in IMAGE_SIGS.items():
        if h[:len(sig)] == sig:
            return "image"
    # DOCX / DOC : ZIP (PK) ou OLE (D0CF)
    if h[:2] == b"PK":
        return "docx"
    if h[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return "doc"
    return "txt"


def file_to_pdf(data: bytes, filename: str = "") -> bytes:
    """Convertit n'importe quel fichier en PDF (image, DOCX, DOC, TXT, ou déjà PDF)."""
    kind = _detect_type(data)

    if kind == "pdf":
        return data

    if kind == "image":
        from PIL import Image
        img = Image.open(io.BytesIO(data)).convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PDF")
        return buf.getvalue()

    if kind in ("docx", "doc"):
        ext = ".docx" if kind == "docx" else ".doc"
        try:
            subprocess.run(["libreoffice", "--version"], capture_output=True, timeout=5, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            raise RuntimeError(f"LibreOffice non disponible — conversion {ext.upper()} impossible")
        with tempfile.TemporaryDirectory() as tmpdir:
            src = os.path.join(tmpdir, f"input{ext}")
            with open(src, "wb") as f:
                f.write(data)
            subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, src],
                check=True, capture_output=True, timeout=60,
            )
            out_path = os.path.join(tmpdir, f"input.pdf")
            with open(out_path, "rb") as f:
                return f.read()

    # TXT / fallback : page blanche avec le texte
    try:
        text = data.decode("utf-8", errors="replace")
    except Exception:
        text = repr(data[:500])
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(
        fitz.Rect(50, 50, page.rect.width - 50, page.rect.height - 50),
        text, fontsize=11,
    )
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def merge_pdfs(files_bytes: list[bytes], filenames: list[str] | None = None) -> bytes:
    """Fusionne des fichiers de n'importe quel type en un seul PDF."""
    names = filenames or [""] * len(files_bytes)
    result = fitz.open()
    for data, name in zip(files_bytes, names):
        pdf_data = file_to_pdf(data, name)
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        result.insert_pdf(doc)
        doc.close()
    out = io.BytesIO()
    result.save(out)
    result.close()
    return out.getvalue()


def split_pdf(pdf_bytes: bytes, start: int, end: int) -> bytes:
    """Extrait les pages [start, end] (1-based, inclusif)."""
    src = fitz.open(stream=pdf_bytes, filetype="pdf")
    result = fitz.open()
    result.insert_pdf(src, from_page=start - 1, to_page=end - 1)
    src.close()
    out = io.BytesIO()
    result.save(out)
    result.close()
    return out.getvalue()


def compress_pdf(pdf_bytes: bytes) -> bytes:
    src = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in src:
        # Redimensionne les images embarquées pour réduire la taille
        for img in page.get_images(full=True):
            xref = img[0]
            pix = fitz.Pixmap(src, xref)
            if pix.width > 1200:
                factor = 1200 / pix.width
                pix = fitz.Pixmap(pix, int(pix.width * factor), int(pix.height * factor))
            src.update_stream(xref, pix.tobytes("jpeg", jpg_quality=75))
    out = io.BytesIO()
    src.save(out, deflate=True, garbage=4)
    src.close()
    return out.getvalue()


def add_watermark(pdf_bytes: bytes, text: str) -> bytes:
    src = fitz.open(stream=pdf_bytes, filetype="pdf")
    for page in src:
        rect = page.rect
        page.insert_text(
            fitz.Point(rect.width / 4, rect.height / 2),
            text,
            fontsize=60,
            color=(0.8, 0.8, 0.8),
            rotate=45,
        )
    out = io.BytesIO()
    src.save(out)
    src.close()
    return out.getvalue()


def docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Conversion DOCX → PDF via LibreOffice headless."""
    try:
        subprocess.run(["libreoffice", "--version"], capture_output=True, timeout=5, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise RuntimeError("LibreOffice non disponible — conversion DOCX impossible")
    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, "input.docx")
        with open(src_path, "wb") as f:
            f.write(docx_bytes)
        subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, src_path],
            check=True, capture_output=True, timeout=60
        )
        out_path = os.path.join(tmpdir, "input.pdf")
        with open(out_path, "rb") as f:
            return f.read()


def pdf_to_docx(pdf_bytes: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path  = os.path.join(tmpdir, "input.pdf")
        docx_path = os.path.join(tmpdir, "output.docx")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        cv = Converter(pdf_path)
        cv.convert(docx_path)
        cv.close()
        with open(docx_path, "rb") as f:
            return f.read()


# ─── Endpoints HTTP (tests directs / usage sans Kafka) ───────────────────────

@app.post("/merge")
async def merge(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(400, "Au moins 2 fichiers requis")
    data  = [await f.read() for f in files]
    names = [f.filename or "" for f in files]
    result = merge_pdfs(data, names)
    return StreamingResponse(io.BytesIO(result), media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=merged.pdf"})


@app.post("/split")
async def split(file: UploadFile = File(...), start: int = 1, end: int = 1):
    data = await file.read()
    result = split_pdf(data, start, end)
    return StreamingResponse(io.BytesIO(result), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=split_{start}_{end}.pdf"})


@app.post("/compress")
async def compress(file: UploadFile = File(...)):
    data = await file.read()
    result = compress_pdf(data)
    return StreamingResponse(io.BytesIO(result), media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=compressed.pdf"})


@app.post("/to-pdf")
async def to_pdf(file: UploadFile = File(...)):
    data = await file.read()
    result = docx_to_pdf(data)
    return StreamingResponse(io.BytesIO(result), media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=converted.pdf"})


@app.post("/to-docx")
async def to_docx(file: UploadFile = File(...)):
    data = await file.read()
    result = pdf_to_docx(data)
    return StreamingResponse(
        io.BytesIO(result),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=converted.docx"}
    )


@app.get("/health")
async def health():
    return {"service": "pdf-worker", "status": "online", "version": "1.0.0"}
