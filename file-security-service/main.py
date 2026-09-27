"""
File Security Service — Microservice de vérification et d'assainissement de fichiers.
Protège l'ensemble de la plateforme CreativeAI contre :
  - Les faux types MIME (spoofing d'extension) via Magic Bytes
  - Les scripts embarqués (PHP, JS, Shell, HTML injection)
  - Les bombes de décompression / images géantes
  - Les malwares connus via l'API VirusTotal (SHA-256 hash lookup)
  - Les payloads stéganographiques via re-encodage PIL

Note d'implémentation : les limites MAX_*_SIZE sont appliquées PENDANT LA LECTURE
(lecture par blocs avec plafond), pas seulement après coup. Lire un fichier entier
en mémoire avant de vérifier sa taille permet de tuer le worker avec un seul upload.
"""

import os
import hashlib
import io
import re
from typing import Optional, List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import httpx
from PIL import Image

app = FastAPI(
    title="CreativeAI File Security Service",
    description="Microservice de sécurité et d'assainissement de fichiers pour CreativeAI Studio",
    version="1.1.0"
)

# ── Configuration ────────────────────────────────────────────────────────────

VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE_MB", "15")) * 1024 * 1024
MAX_VIDEO_SIZE = int(os.getenv("MAX_VIDEO_SIZE_MB", "500")) * 1024 * 1024
MAX_DOC_SIZE   = int(os.getenv("MAX_DOC_SIZE_MB", "50")) * 1024 * 1024
# Plafond absolu : la plus grande catégorie autorisée. Au-delà, refus immédiat.
MAX_UPLOAD_BYTES = max(MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_DOC_SIZE)
# Fenêtre analysée pour la recherche de patterns : une regex sur du binaire est
# coûteuse, et un script malveillant est en pratique dans l'en-tête ou le pied.
PATTERN_SCAN_WINDOW = int(os.getenv("PATTERN_SCAN_WINDOW_MB", "8")) * 1024 * 1024
READ_CHUNK = 1024 * 1024
MAX_IMAGE_PIXELS = int(os.getenv("MAX_IMAGE_PIXELS", "100000000"))

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
VIDEO_EXTENSIONS = {"mp4", "mov", "m4v", "webm", "mkv", "avi"}

# Extensions dont le contenu est du texte ou du code : une recherche de patterns
# y a un sens. Un fichier .php est un script, pas une image.
TEXT_LIKE_EXTENSIONS = {
    "php", "phtml", "js", "mjs", "html", "htm", "xhtml", "svg", "xml", "json",
    "txt", "csv", "md", "sh", "bash", "py", "rb", "pl", "jsp", "asp", "aspx",
    "yml", "yaml", "ini", "cfg", "log", "sql", "bat", "ps1", "vbs",
}

# Le reste est binaire ou compressé : y appliquer les regex ci-dessous produit
# des faux positifs garantis. Sur 20 Mo de données pseudo-aléatoires, la séquence
# de 2 octets `<?=` finit TOUJOURS par apparaître, et un MP4 légitime se ferait
# rejeter. La défense sur ces formats, c'est magic bytes + taille + VirusTotal.

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
    pattern_scan: str = "skipped"
    virustotal_positives: Optional[int] = None
    virustotal_scanned: bool = False
    reasons: List[str] = []

# ── Fonctions de vérification ────────────────────────────────────────────────

def get_extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def size_limit_for(ext: str) -> int:
    """Plafond applicable à une extension donnée."""
    if ext in IMAGE_EXTENSIONS:
        return MAX_IMAGE_SIZE
    if ext in VIDEO_EXTENSIONS:
        return MAX_VIDEO_SIZE
    return MAX_DOC_SIZE


async def read_capped(file: UploadFile, limit: int, label: str) -> bytes:
    """
    Lit le fichier par blocs en s'arrêtant dès que `limit` est dépassé.

    On ne charge jamais plus de `limit` + 1 bloc en mémoire : c'est la seule façon
    d'empêcher un upload énorme de tuer le worker avant même le contrôle de taille.
    """
    buf = bytearray()
    while True:
        chunk = await file.read(READ_CHUNK)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Fichier trop volumineux : maximum {limit // (1024 * 1024)} Mo ({label})",
            )
    return bytes(buf)


async def read_upload(file: UploadFile) -> bytes:
    """Lecture plafonnée, puis contrôle du plafond propre à la catégorie."""
    contents = await read_capped(file, MAX_UPLOAD_BYTES, "toutes catégories")
    ext = get_extension(file.filename or "")
    limit = size_limit_for(ext)
    if len(contents) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier .{ext} trop volumineux : "
                   f"{len(contents) // (1024 * 1024)} Mo (maximum {limit // (1024 * 1024)} Mo)",
        )
    return contents


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
    """Recherche des patterns malveillants (scripts, injection) sur une fenêtre bornée."""
    window = data
    if len(data) > 2 * PATTERN_SCAN_WINDOW:
        window = data[:PATTERN_SCAN_WINDOW] + b"\n" + data[-PATTERN_SCAN_WINDOW:]
    found = []
    for pattern in MALICIOUS_PATTERNS:
        if re.search(pattern, window, re.IGNORECASE):
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
        if img.width * img.height > MAX_IMAGE_PIXELS:
            raise ValueError("Dimensions d'image excessives (protection DoS)")
        output = io.BytesIO()
        fmt = "PNG" if ext == "png" else "JPEG"
        if fmt == "JPEG" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(output, format=fmt, quality=92, optimize=True)
        return output.getvalue()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image corrompue ou invalide: {str(e)}")

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "file-security-service",
        "version": app.version,
        "virustotal_configured": bool(VIRUSTOTAL_API_KEY),
        "limits_mb": {
            "image": MAX_IMAGE_SIZE // (1024 * 1024),
            "video": MAX_VIDEO_SIZE // (1024 * 1024),
            "document": MAX_DOC_SIZE // (1024 * 1024),
            "absolute": MAX_UPLOAD_BYTES // (1024 * 1024),
        },
        "pattern_scan_window_mb": PATTERN_SCAN_WINDOW // (1024 * 1024),
    }

@app.post("/scan", response_model=ScanResult)
async def scan_file(file: UploadFile = File(...)):
    """
    Analyse complète de sécurité d'un fichier sans modification :
    - Contrôle de taille pendant la lecture (413 si dépassée)
    - Vérification Magic Bytes
    - Détection de code malveillant / scripts
    - Hash SHA-256 + VirusTotal lookup
    """
    ext = get_extension(file.filename or "")
    # 1. Taille — contrôlée pendant la lecture, avant toute mise en mémoire complète.
    contents = await read_upload(file)
    sha256 = hashlib.sha256(contents).hexdigest()
    reasons = []

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

    # 3. Code malveillant — uniquement là où c'est significatif.
    #    Sur un binaire (image, vidéo, archive, PDF compressé), ces regex ne
    #    donnent que des faux positifs : on s'appuie sur magic bytes + VirusTotal.
    ext_lower = ext.lower()
    if ext_lower in TEXT_LIKE_EXTENSIONS:
        malicious_found, patterns = check_malicious_patterns(contents)
        pattern_scan = "text"
        if malicious_found:
            reasons.append(f"Contenu malveillant détecté : {', '.join(patterns)}")
    else:
        malicious_found, patterns = False, []
        pattern_scan = "skipped:binary"

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
        pattern_scan=pattern_scan,
        virustotal_positives=vt_positives,
        virustotal_scanned=vt_scanned,
        reasons=reasons
    )

@app.post("/sanitize")
async def sanitize_file(file: UploadFile = File(...)):
    """
    Analyse le fichier ET re-encode l'image pour supprimer tout EXIF/payload caché.
    Retourne les octets assainis ou une erreur 4xx.
    """
    ext = get_extension(file.filename or "")
    contents = await read_upload(file)

    # Valider d'abord
    magic_ok, detected = check_magic_bytes(contents, ext)
    if not magic_ok:
        raise HTTPException(status_code=400, detail=f"Contenu invalide pour extension .{ext}")

    if ext in IMAGE_EXTENSIONS:
        sanitized = sanitize_image(contents, ext)
        mime = f"image/{'jpeg' if ext in ['jpg','jpeg'] else ext}"
        return Response(content=sanitized, media_type=mime)

    if ext in TEXT_LIKE_EXTENSIONS:
        malicious_found, patterns = check_malicious_patterns(contents)
        if malicious_found:
            raise HTTPException(status_code=400, detail="Contenu malveillant détecté dans le fichier")

    return Response(content=contents, media_type="application/octet-stream")
