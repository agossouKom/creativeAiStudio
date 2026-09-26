from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from .settings import Settings


load_dotenv()
settings = Settings.from_env()
app = FastAPI(title="Creative AI Studio - Image Generation Worker", version="0.1.0")


def _health_payload() -> dict[str, object]:
    return {
        "service": "image-generation-worker",
        "status": "online",
        "version": "0.1.0",
        "providerConfigured": settings.provider_configured,
        "storageConfigured": settings.storage_configured,
    }


@app.get("/health")
async def health() -> dict[str, object]:
    return _health_payload()


@app.get("/ready")
async def ready() -> dict[str, object]:
    if not settings.provider_configured:
        raise HTTPException(
            status_code=503,
            detail="image provider is not configured",
        )
    if not settings.storage_configured:
        raise HTTPException(
            status_code=503,
            detail="image output storage is not configured",
        )
    return {
        **_health_payload(),
        "status": "ready",
    }
