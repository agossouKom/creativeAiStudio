import os
import io
import tempfile
import logging
import asyncio
import requests
import acoustid
import numpy as np
import librosa
from shazamio import Shazam
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    logging.warning("pydub not available — webm/ogg conversion disabled")

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Creative AI Studio - Audio AI Worker", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ACOUSTID_API_KEY = os.getenv("ACOUSTID_API_KEY", "")

_shazam = Shazam()


# ─── Audio Conversion helper (webm/ogg → wav for cross-browser compat) ────────

def convert_to_wav(audio_bytes: bytes, source_format: str = "webm") -> bytes:
    """Convert browser-recorded audio (webm/ogg) to wav for Shazam + librosa."""
    if not PYDUB_AVAILABLE:
        return audio_bytes
    try:
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=source_format)
        buf = io.BytesIO()
        audio.export(buf, format="wav")
        return buf.getvalue()
    except Exception as e:
        logger.warning("Audio conversion failed (%s): %s", source_format, e)
        return audio_bytes


# ─── Shazam Recognition (primary — no API key required) ──────────────────────

async def recognize_with_shazam(audio_bytes: bytes) -> dict | None:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        result = await _shazam.recognize_song(tmp_path)
        track = result.get("track")
        if not track:
            return None

        cover_url = (
            track.get("images", {}).get("coverarthq")
            or track.get("images", {}).get("coverart")
        )
        metadata = {m["title"]: m["text"] for m in track.get("metadata", [])}

        return {
            "source":       "shazam",
            "score":        100,
            "title":        track.get("title", "Inconnu"),
            "artist":       track.get("subtitle", "Inconnu"),
            "album":        metadata.get("Album", ""),
            "release_date": metadata.get("Released", ""),
            "cover_url":    cover_url,
            "shazam_url":   track.get("url", ""),
            "genre":        track.get("genres", {}).get("primary", ""),
        }
    except Exception as e:
        logger.warning("Shazam recognition failed: %s", e)
        return None
    finally:
        os.unlink(tmp_path)


# ─── AcoustID (fallback when Shazam finds nothing) ───────────────────────────

async def generate_fingerprint(audio_bytes: bytes) -> tuple[str, float]:
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        duration, fingerprint = acoustid.fingerprint_file(tmp_path)
        return fingerprint, duration
    finally:
        os.unlink(tmp_path)


async def lookup_acoustid(fingerprint: str, duration: float) -> dict | None:
    if not ACOUSTID_API_KEY:
        return None
    try:
        results = acoustid.lookup(
            ACOUSTID_API_KEY, fingerprint, duration, meta="recordings releases"
        )
        for result in results:
            if result.get("score", 0) > 0.5 and result.get("recordings"):
                rec     = result["recordings"][0]
                release = rec.get("releases", [{}])[0]
                artist  = rec.get("artists", [{}])[0].get("name", "Inconnu")
                title   = rec.get("title", "Inconnu")
                cover_url = await fetch_itunes_cover(artist, title)
                return {
                    "source":        "acoustid",
                    "score":         round(result["score"] * 100, 1),
                    "title":         title,
                    "artist":        artist,
                    "album":         release.get("title", ""),
                    "release_date":  str(release.get("date", {}).get("year", "")),
                    "cover_url":     cover_url,
                    "musicbrainz_id": rec.get("id"),
                    "genre":         "",
                }
    except Exception as e:
        logger.warning("AcoustID lookup failed: %s", e)
    return None


# ─── Cover Art via iTunes Search API (free, no key) ──────────────────────────

async def fetch_itunes_cover(artist: str, title: str) -> str | None:
    try:
        resp = requests.get(
            "https://itunes.apple.com/search",
            params={"term": f"{artist} {title}", "media": "music", "limit": 1},
            timeout=5,
        )
        results = resp.json().get("results", [])
        if results:
            url = results[0].get("artworkUrl100", "")
            return url.replace("100x100bb", "600x600bb")
    except Exception:
        pass
    return None


# ─── Lyrics via lyrics.ovh (free, no key) ───────────────────────────────────

async def fetch_lyrics(artist: str, title: str) -> str | None:
    try:
        resp = requests.get(
            f"https://api.lyrics.ovh/v1/{requests.utils.quote(artist)}/{requests.utils.quote(title)}",
            timeout=6,
        )
        if resp.status_code == 200:
            lyrics = resp.json().get("lyrics", "")
            return lyrics[:3000] if lyrics else None
    except Exception:
        pass
    return None


# ─── Audio Feature Analysis (BPM / key / energy) ─────────────────────────────

async def analyze_audio_features(audio_bytes: bytes) -> dict:
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=True, duration=30)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    # librosa >= 0.10 returns a 1-D array; force scalar extraction
    bpm = round(float(np.atleast_1d(tempo)[0]), 1)
    chroma  = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_idx = int(np.argmax(np.mean(chroma, axis=1)))
    keys    = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"]
    energy  = float(np.mean(librosa.feature.rms(y=y)))
    return {
        "bpm":    bpm,
        "key":    keys[key_idx],
        "energy": round(energy * 100, 2),
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/recognize")
async def recognize_audio(file: UploadFile = File(...)):
    # Formats acceptés nativement
    allowed = {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave",
        "audio/ogg", "audio/mp4", "video/mp4",
        "audio/x-m4a", "audio/flac", "audio/aac",
        # Formats navigateur (Chrome = webm, Firefox = ogg)
        "audio/webm", "video/webm",
        "audio/webm;codecs=opus", "audio/ogg;codecs=opus",
        "application/octet-stream",  # fallback générique
    }
    ct = (file.content_type or "").split(";")[0].strip()
    if ct and ct not in allowed:
        logger.warning("Type MIME non reconnu mais accepté quand même: %s", ct)

    audio_bytes = await file.read()
    logger.info("Analyse %d bytes — %s — content-type: %s", len(audio_bytes), file.filename, file.content_type)

    # Conversion automatique webm/ogg → wav (enregistrements navigateur)
    raw_ct = (file.content_type or "").lower()
    if "webm" in raw_ct:
        logger.info("Conversion webm → wav (Chrome recording)")
        audio_bytes = convert_to_wav(audio_bytes, "webm")
    elif "ogg" in raw_ct and "mpeg" not in raw_ct:
        logger.info("Conversion ogg → wav (Firefox recording)")
        audio_bytes = convert_to_wav(audio_bytes, "ogg")

    try:
        match, features = await asyncio.gather(
            recognize_with_shazam(audio_bytes),
            analyze_audio_features(audio_bytes),
        )

        # AcoustID fallback
        if not match and ACOUSTID_API_KEY:
            fingerprint, duration = await generate_fingerprint(audio_bytes)
            match = await lookup_acoustid(fingerprint, duration)

        lyrics = None
        if match:
            lyrics = await fetch_lyrics(match["artist"], match["title"])
            if not match.get("cover_url"):
                match["cover_url"] = await fetch_itunes_cover(
                    match["artist"], match["title"]
                )

    except Exception as e:
        logger.error("Erreur analyse audio: %s", e)
        raise HTTPException(500, str(e))

    return {
        "status":   "found" if match else "not_found",
        "match":    match,
        "features": features,
        "lyrics":   lyrics,
    }


@app.get("/health")
async def health():
    return {"service": "audio-worker", "status": "online", "version": "3.0.0"}
