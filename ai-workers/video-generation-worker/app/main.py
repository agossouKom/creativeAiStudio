import shutil

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from .settings import Settings


load_dotenv()
settings = Settings.from_env()
app = FastAPI(title="Creative AI Studio - Video Generation Worker", version="0.1.0")


def _health_payload() -> dict[str, object]:
    return {
        "service": "video-generation-worker",
        "status": "online",
        "version": "0.1.0",
        "provider": settings.provider,
        "storyboardProvider": settings.storyboard_llm_provider,
        "providerConfigured": settings.provider_configured,
        "storageConfigured": settings.storage_configured,
        "stockSourcesConfigured": [
            source
            for source, key in (
                ("pexels", settings.pexels_api_key),
                ("pixabay", settings.pixabay_api_key),
            )
            if key
        ],
        "ttsProvider": settings.tts_provider,
        "mediaToolsAvailable": all(
            shutil.which(binary)
            for binary in (
                settings.ffmpeg_binary,
                settings.ffprobe_binary,
                settings.edge_tts_binary
                if settings.tts_provider == "edge"
                else settings.tts_binary,
            )
        ),
    }


@app.get("/health")
async def health() -> dict[str, object]:
    return _health_payload()


@app.get("/ready")
async def ready() -> dict[str, object]:
    if not settings.provider_configured:
        raise HTTPException(
            status_code=503,
            detail="Video generation provider is not configured",
        )
    if not settings.storage_configured:
        raise HTTPException(
            status_code=503,
            detail="video output storage is not configured",
        )
    if settings.provider == "local" and not _health_payload()["mediaToolsAvailable"]:
        raise HTTPException(
            status_code=503,
            detail="FFmpeg, ffprobe and the configured TTS executable are required by the local pipeline",
        )
    return {
        **_health_payload(),
        "status": "ready",
    }
