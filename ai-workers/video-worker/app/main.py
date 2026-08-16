import os
import re
import cv2
import numpy as np
import requests
import tempfile
import logging
import asyncio
import subprocess
from shazamio import Shazam
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Creative AI Studio - Video AI Worker", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
TMDB_BASE    = "https://api.themoviedb.org/3"
TMDB_IMG_MD  = "https://image.tmdb.org/t/p/w500"
TMDB_IMG_LG  = "https://image.tmdb.org/t/p/w1280"

_shazam = Shazam()


# ─── Video metadata (OpenCV) ─────────────────────────────────────────────────

def analyze_video_metadata(video_bytes: bytes) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name
    try:
        cap = cv2.VideoCapture(tmp_path)
        fps         = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration    = frame_count / fps if fps > 0 else 0
        cap.release()
        return {
            "width":      width,
            "height":     height,
            "fps":        round(fps, 1),
            "duration":   round(duration, 1),
            "resolution": f"{width}×{height}",
            "frames":     frame_count,
        }
    finally:
        os.unlink(tmp_path)


def extract_frames(video_bytes: bytes, max_frames: int = 6) -> list[np.ndarray]:
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name
    cap = cv2.VideoCapture(tmp_path)
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step   = max(1, total // max_frames)
    frames = []
    for i in range(0, total, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
        if len(frames) >= max_frames:
            break
    cap.release()
    os.unlink(tmp_path)
    return frames


# ─── Audio extraction + Shazam ───────────────────────────────────────────────

def extract_audio_bytes(video_bytes: bytes) -> bytes | None:
    """Extrait la piste audio d'une vidéo via ffmpeg (mp3, 30 s max)."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as vtmp:
        vtmp.write(video_bytes)
        vtmp_path = vtmp.name

    audio_path = vtmp_path.replace(".mp4", "_audio.mp3")
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", vtmp_path,
                "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k",
                "-t", "30",          # 30 s suffisent pour Shazam
                audio_path, "-y",
            ],
            capture_output=True, timeout=40, check=True,
        )
        with open(audio_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.warning("Audio extraction failed: %s", e)
        return None
    finally:
        os.unlink(vtmp_path)
        if os.path.exists(audio_path):
            os.unlink(audio_path)


async def recognize_video_audio(audio_bytes: bytes) -> dict | None:
    """Identifie la bande-son via Shazam et en déduit un indice sur le film."""
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        result = await _shazam.recognize_song(tmp_path)
        track  = result.get("track")
        if not track:
            return None

        metadata    = {m["title"]: m["text"] for m in track.get("metadata", [])}
        album       = metadata.get("Album", "")
        released    = metadata.get("Released", "")
        cover_url   = (
            track.get("images", {}).get("coverarthq")
            or track.get("images", {}).get("coverart")
        )

        # Extrait le titre du film depuis l'album (ex: "Inception (Music from…)" → "Inception")
        movie_hint = re.sub(r"\s*[\(\[].*?[\)\]]", "", album).strip() if album else ""

        return {
            "song_title":  track.get("title", ""),
            "song_artist": track.get("subtitle", ""),
            "album":       album,
            "released":    released,
            "cover_url":   cover_url,
            "shazam_url":  track.get("url", ""),
            "movie_hint":  movie_hint,
        }
    except Exception as e:
        logger.warning("Shazam recognition failed: %s", e)
        return None
    finally:
        os.unlink(tmp_path)


# ─── TMDb ────────────────────────────────────────────────────────────────────

def search_tmdb(query: str) -> dict | None:
    if not query or not TMDB_API_KEY:
        return None
    try:
        resp = requests.get(
            f"{TMDB_BASE}/search/multi",
            params={"api_key": TMDB_API_KEY, "query": query, "language": "fr-FR"},
            timeout=5,
        )
        results = resp.json().get("results", [])
        for r in results:
            if r.get("media_type") in ("movie", "tv"):
                return r
        return results[0] if results else None
    except Exception as e:
        logger.warning("TMDb search failed: %s", e)
        return None


def get_tmdb_details(tmdb_result: dict) -> dict:
    media_type = tmdb_result.get("media_type", "movie")
    item_id    = tmdb_result.get("id")
    endpoint   = "tv" if media_type == "tv" else "movie"
    try:
        resp = requests.get(
            f"{TMDB_BASE}/{endpoint}/{item_id}",
            params={"api_key": TMDB_API_KEY, "language": "fr-FR",
                    "append_to_response": "credits,videos"},
            timeout=5,
        )
        data = resp.json()
    except Exception as e:
        logger.warning("TMDb details failed: %s", e)
        return {}

    title = data.get("title") or data.get("name", "")
    cast  = [
        {
            "name":      m["name"],
            "character": m.get("character", ""),
            "photo":     f"{TMDB_IMG_MD}{m['profile_path']}" if m.get("profile_path") else None,
        }
        for m in data.get("credits", {}).get("cast", [])[:6]
    ]
    trailer = next(
        (
            f"https://www.youtube.com/watch?v={v['key']}"
            for v in data.get("videos", {}).get("results", [])
            if v.get("type") == "Trailer" and v.get("site") == "YouTube"
        ),
        None,
    )
    director = next(
        (m["name"] for m in data.get("credits", {}).get("crew", []) if m.get("job") == "Director"),
        None,
    )
    return {
        "media_type":     media_type,
        "id":             item_id,
        "title":          title,
        "original_title": data.get("original_title") or data.get("original_name", ""),
        "overview":       data.get("overview", ""),
        "release_date":   data.get("release_date") or data.get("first_air_date", ""),
        "poster":         f"{TMDB_IMG_MD}{data['poster_path']}" if data.get("poster_path") else None,
        "backdrop":       f"{TMDB_IMG_LG}{data['backdrop_path']}" if data.get("backdrop_path") else None,
        "vote_average":   round(data.get("vote_average", 0), 1),
        "genres":         [g["name"] for g in data.get("genres", [])],
        "cast":           cast,
        "trailer":        trailer,
        "director":       director,
    }


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/recognize")
async def recognize_video(file: UploadFile = File(...)):
    video_bytes = await file.read()
    logger.info("Analyse vidéo: %s (%d bytes)", file.filename, len(video_bytes))

    # 1. Métadonnées techniques
    metadata = analyze_video_metadata(video_bytes)
    frames   = extract_frames(video_bytes, max_frames=6)
    logger.info("Frames: %d | Résolution: %s | FPS: %s", len(frames), metadata["resolution"], metadata["fps"])

    # 2. Extraction audio + Shazam
    audio_bytes   = extract_audio_bytes(video_bytes)
    audio_match   = None
    tmdb_match    = None

    if audio_bytes:
        audio_match = await recognize_video_audio(audio_bytes)
        logger.info("Shazam audio: %s", audio_match)

    # 3. Recherche TMDb via l'indice Shazam
    if audio_match and audio_match.get("movie_hint") and TMDB_API_KEY:
        tmdb_result = search_tmdb(audio_match["movie_hint"])
        if tmdb_result:
            tmdb_match = get_tmdb_details(tmdb_result)
            logger.info("TMDb match: %s", tmdb_match.get("title"))

    return {
        "status":      "found" if (audio_match or tmdb_match) else "not_found",
        "metadata":    metadata,
        "frames_analyzed": len(frames),
        "audio_match": audio_match,
        "tmdb_match":  tmdb_match,
    }


@app.get("/health")
async def health():
    return {"service": "video-worker", "status": "online", "version": "3.0.0"}
