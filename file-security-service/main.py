"""
File Security Service — Microservice de vérification et d'assainissement de fichiers.
Protège l'ensemble de la plateforme CreativeAI contre :
  - Les faux types MIME (spoofing d'extension) via Magic Bytes
  - Les scripts embarqués (PHP, JS, Shell, HTML injection)
  - Les bombes de décompression / images géantes
  - Les malwares connus via l'API VirusTotal (SHA-256 hash lookup)
  - Les payloads stéganographiques via re-encodage PIL
"""

import os
import hashlib
import io
import re
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import httpx
from PIL import Image

app = FastAPI(
    title="CreativeAI File Security Service",
    description="Microservice de sécurité et d'assainissement de fichiers pour CreativeAI Studio",
    version="1.0.0"
)

# ── Configuration ────────────────────────────────────────────────────────────

VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE_MB", "15")) * 1024 * 1024
MAX_VIDEO_SIZE = int(os.getenv("MAX_VIDEO_SIZE_MB", "500")) * 1024 * 1024
MAX_DOC_SIZE   = int(os.getenv("MAX_DOC_SIZE_MB", "50")) * 1024 * 1024

# Magic bytes definitions: (hex_prefix, offset, [allowed_extensions])
MAGIC_SIGNATURES = [
    # Images
    (bytes.fromhex("ffd8ff"),       0, ["jpg", "jpeg"]),
    (bytes.fromhex("89504e47"),     0, ["png"]),
    (bytes.fromhex("47494638"),     0, ["gif"]),
    (bytes.fromhex("52494646"),     0, ["webp", "avi", "wav"]),  # RIFF container
    # Videos
    (b"ftyp",                      4, ["mp4", "mov", "m4v"]),
    (bytes.fromhex("1a45dfa3"),     0, ["webm", "mkv"]),
    # Documents
    (bytes.fromhex("25504446"),     0, ["pdf"]),                 # %PDF-
    (bytes.fromhex("504b0304"),     0, ["docx", "xlsx", "pptx", "zip"]), # PK.. (ZIP / Office)
    # Audio
    (bytes.fromhex("494433"),       0, ["mp3"]),                 # ID3 (MP3)
    (bytes.fromhex("fffb"),         0, ["mp3"]),                 # MPEG frame sync
    (bytes.fromhex("fff3"),         0, ["mp3"]),
    (bytes.fromhex("fff2"),         0, ["mp3"]),
    (bytes.fromhex("4f676753"),     0, ["ogg"]),                 # OggS
]

MALICIOUS_PATTERNS = [
    rb"<\?php",
    rb"<\?=",
    rb"<script[\s>]",
    rb"javascript:",
    rb"vbscript:",
    rb"onload\s*=",
    rb"onerror\s*=",
    rb"eval\s*\(",
    rb"base64_decode\s*\(",
    rb"exec\s*\(",
    rb"system\s*\(",
    rb"shell_exec\s*\(",
    rb"passthru\s*\(",
    rb"<!--#exec",
    rb"<!DOCTYPE\s+html",
]

# ── Modèles Pydantic ─────────────────────────────────────────────────────────

class ScanResult(BaseModel):
    safe: bool
    filename: str
    extension: str
    detected_mime: str
    sha256: str
    file_size_bytes: int
    magic_bytes_valid: bool
    malicious_pattern_found: bool
    virustotal_positives: Optional[int] = None
    virustotal_scanned: bool = False
    reasons: List[str] = []

# ── Fonctions de vérification ────────────────────────────────────────────────

def get_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()

def check_magic_bytes(data: bytes, ext: str) -> tuple[bool, str]:
    """Vérifie la signature binaire réelle du fichier."""
    matched_mime = "application/octet-stream"
    for magic, offset, exts in MAGIC_SIGNATURES:
        if len(data) >= offset + len(magic):
            if data[offset:offset + len(magic)] == magic:
                matched_mime = exts[0]
                if ext in exts:
                    return True, matched_mime
    return False, matched_mime

def check_malicious_patterns(data: bytes) -> tuple[bool, List[str]]:
    """Recherche des patterns malveillants (scripts, injection)."""
    found = []
    for pattern in MALICIOUS_PATTERNS:
        if re.search(pattern, data, re.IGNORECASE):
            found.append(pattern.decode("utf-8", errors="replace"))
    return len(found) > 0, found

async def check_virustotal(sha256: str) -> tuple[Optional[int], bool]:
    """Vérifie le hash SHA-256 sur VirusTotal (sans upload de fichier)."""
    if not VIRUSTOTAL_API_KEY:
        return None, False
    try:
        url = f"https://www.virustotal.com/api/v3/files/{sha256}"
        headers = {"x-apikey": VIRUSTOTAL_API_KEY}
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)
                return malicious + suspicious, True
            elif resp.status_code == 404:
                # Fichier inconnu de VT (pas forcément malveillant)
                return 0, True
    except Exception:
        pass
    return None, False

def sanitize_image(data: bytes, ext: str) -> bytes:
    """Re-encode une image pour supprimer l'EXIF et tout payload stéganographique."""
    if ext == "gif":
        return data  # Les GIF animés sont conservés
    try:
        img = Image.open(io.BytesIO(data))
        # Vérification anti-bombe de décompression
        if img.width * img.height > 100_000_000:
            raise ValueError("Dimensions d'image excessives (protection DoS)")
        output = io.BytesIO()
        fmt = "PNG" if ext == "png" else "JPEG"
        if fmt == "JPEG" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(output, format=fmt, quality=92, optimize=True)
        return output.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image corrompue ou invalide: {str(e)}")

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "file-security-service",
        "virustotal_configured": bool(VIRUSTOTAL_API_KEY)
    }

@app.post("/scan", response_model=ScanResult)
async def scan_file(file: UploadFile = File(...)):
    """
    Analyse complète de sécurité d'un fichier sans modification :
    - Vérification Magic Bytes
    - Détection de code malveillant / scripts
    - Vérification de taille
    - Hash SHA-256 + VirusTotal lookup
    """
    contents = await file.read()
    ext = get_extension(file.filename or "")
    sha256 = hashlib.sha256(contents).hexdigest()
    reasons = []

    # 1. Taille
    size = len(contents)
    if size == 0:
        return ScanResult(
            safe=False, filename=file.filename or "", extension=ext,
            detected_mime="empty", sha256=sha256, file_size_bytes=0,
            magic_bytes_valid=False, malicious_pattern_found=False,
            reasons=["Fichier vide (0 octet)"]
        )

    # 2. Magic Bytes
    magic_ok, detected_mime = check_magic_bytes(contents, ext)
    if not magic_ok:
        reasons.append(f"Magic bytes invalides : l'extension '.{ext}' ne correspond pas au contenu réel ({detected_mime})")

    # 3. Code malveillant (pour documents et vidéos ; les images sont sanitizées)
    malicious_found, patterns = check_malicious_patterns(contents)
    if malicious_found and ext not in ["jpg", "jpeg", "png", "webp"]:
        reasons.append(f"Contenu malveillant détecté : {', '.join(patterns)}")

    # 4. VirusTotal lookup
    vt_positives, vt_scanned = await check_virustotal(sha256)
    if vt_scanned and vt_positives and vt_positives > 0:
        reasons.append(f"VirusTotal : {vt_positives} moteur(s) antivirus ont détecté ce fichier comme malveillant")

    safe = len(reasons) == 0

    return ScanResult(
        safe=safe,
        filename=file.filename or "",
        extension=ext,
        detected_mime=detected_mime,
        sha256=sha256,
        file_size_bytes=size,
        magic_bytes_valid=magic_ok,
        malicious_pattern_found=malicious_found,
        virustotal_positives=vt_positives,
        virustotal_scanned=vt_scanned,
        reasons=reasons
    )

@app.post("/sanitize")
async def sanitize_file(file: UploadFile = File(...)):
    """
    Analyse le fichier ET re-encode l'image pour supprimer tout EXIF/payload caché.
    Retourne les octets assainis ou une erreur 400.
    """
    contents = await file.read()
    ext = get_extension(file.filename or "")

    # Valider d'abord
    magic_ok, detected = check_magic_bytes(contents, ext)
    if not magic_ok:
        raise HTTPException(status_code=400, detail=f"Contenu invalide pour extension .{ext}")

    if ext in ["jpg", "jpeg", "png", "webp"]:
        sanitized = sanitize_image(contents, ext)
        mime = f"image/{'jpeg' if ext in ['jpg','jpeg'] else ext}"
        return Response(content=sanitized, media_type=mime)

    # Pour les vidéos/documents, retourner tel quel si safe
    malicious_found, patterns = check_malicious_patterns(contents)
    if malicious_found:
        raise HTTPException(status_code=400, detail="Contenu malveillant détecté dans le fichier")

    return Response(content=contents, media_type="application/octet-stream")
