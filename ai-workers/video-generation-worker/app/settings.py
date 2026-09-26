import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit


def _text(name: str, default: str) -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _optional_text(name: str) -> str | None:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else None


def _boolean(name: str, default: bool) -> bool:
    value = _optional_text(name)
    if value is None:
        return default
    normalized = value.lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean")


def _integer(name: str, default: int, minimum: int, maximum: int) -> int:
    value = _optional_text(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if not minimum <= parsed <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def _decimal(name: str, default: float, minimum: float, maximum: float) -> float:
    value = _optional_text(name)
    if value is None:
        return default
    try:
        parsed = float(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if not minimum <= parsed <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return parsed


def _http_url(name: str, value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlsplit(value)
    try:
        parsed.port
    except ValueError as exc:
        raise ValueError(f"{name} contains an invalid port") from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(f"{name} must be an HTTP(S) URL without credentials, query or fragment")
    return value.rstrip("/")


def _bucket(name: str, default: str) -> str:
    value = _text(name, default)
    if re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", value) is None:
        raise ValueError(f"{name} is not a valid bucket name")
    return value


@dataclass(frozen=True)
class Settings:
    kafka_bootstrap_servers: str
    input_topic: str
    result_topic: str
    group_id: str
    provider: str
    storyboard_llm_provider: str
    ollama_url: str
    ollama_model: str
    storyboard_llm_base_url: str | None
    storyboard_llm_api_key: str | None
    storyboard_llm_model: str | None
    storyboard_llm_allow_unauthenticated: bool
    storyboard_llm_timeout_seconds: float
    pexels_api_key: str | None
    pixabay_api_key: str | None
    music_dir: str | None
    tts_provider: str
    tts_binary: str
    edge_tts_binary: str
    ffmpeg_binary: str
    ffprobe_binary: str
    video_generation_max_source_bytes: int
    moneyprinter_api_url: str | None
    moneyprinter_api_key: str | None
    moneyprinter_allow_unauthenticated: bool
    minio_url: str | None
    minio_access_key: str | None
    minio_secret_key: str | None
    video_generation_output_bucket: str
    video_generation_max_output_bytes: int
    request_timeout_seconds: float
    poll_interval_seconds: float
    max_poll_seconds: float
    max_video_count: int
    max_clip_duration_seconds: int

    @classmethod
    def from_env(cls) -> "Settings":
        provider = _text("VIDEO_GENERATION_PROVIDER", "local").lower()
        if provider not in {"local", "moneyprinter"}:
            raise ValueError("VIDEO_GENERATION_PROVIDER must be local or moneyprinter")
        storyboard_llm_provider = _text(
            "VIDEO_GENERATION_LLM_PROVIDER", "ollama"
        ).lower()
        tts_provider = _text("VIDEO_GENERATION_TTS_PROVIDER", "espeak").lower()
        if tts_provider not in {"edge", "espeak"}:
            raise ValueError("VIDEO_GENERATION_TTS_PROVIDER must be edge or espeak")
        if storyboard_llm_provider not in {
            "ollama",
            "groq",
            "deepseek",
            "openai_compatible",
        }:
            raise ValueError(
                "VIDEO_GENERATION_LLM_PROVIDER must be ollama, groq, deepseek "
                "or openai_compatible"
            )
        api_url = (
            _http_url("MONEYPRINTER_API_URL", _optional_text("MONEYPRINTER_API_URL"))
            if provider == "moneyprinter"
            else None
        )
        if provider == "local":
            ollama_url = _http_url(
                "VIDEO_GENERATION_OLLAMA_URL",
                _text("VIDEO_GENERATION_OLLAMA_URL", "http://ollama:11434"),
            )
            if ollama_url is None:
                raise ValueError("VIDEO_GENERATION_OLLAMA_URL is required")
        else:
            ollama_url = _text("VIDEO_GENERATION_OLLAMA_URL", "http://ollama:11434").rstrip("/")
        default_llm_settings = {
            "groq": (
                "https://api.groq.com/openai/v1",
                _optional_text("GROQ_API_KEY"),
                "llama-3.1-8b-instant",
            ),
            "deepseek": (
                "https://api.deepseek.com/v1",
                _optional_text("DEEPSEEK_API_KEY"),
                "deepseek-chat",
            ),
        }
        default_base_url, default_api_key, default_model = default_llm_settings.get(
            storyboard_llm_provider, (None, None, None)
        )
        storyboard_llm_base_url = (
            _http_url(
                "VIDEO_GENERATION_LLM_BASE_URL",
                _optional_text("VIDEO_GENERATION_LLM_BASE_URL") or default_base_url,
            )
            if storyboard_llm_provider != "ollama"
            else None
        )
        storyboard_llm_api_key = (
            _optional_text("VIDEO_GENERATION_LLM_API_KEY") or default_api_key
            if storyboard_llm_provider != "ollama"
            else None
        )
        storyboard_llm_model = (
            _optional_text("VIDEO_GENERATION_LLM_MODEL") or default_model
            if storyboard_llm_provider != "ollama"
            else None
        )
        storyboard_llm_allow_unauthenticated = _boolean(
            "VIDEO_GENERATION_LLM_ALLOW_UNAUTHENTICATED", False
        )
        minio_url = _http_url("MINIO_URL", _optional_text("MINIO_URL"))
        return cls(
            kafka_bootstrap_servers=_text(
                "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
            ),
            input_topic=_text("VIDEO_GENERATION_INPUT_TOPIC", "creativeai.video-generation"),
            result_topic=_text(
                "VIDEO_GENERATION_RESULT_TOPIC", "creativeai.video-generation.results"
            ),
            group_id=_text("VIDEO_GENERATION_GROUP_ID", "video-generation-worker"),
            provider=provider,
            storyboard_llm_provider=storyboard_llm_provider,
            ollama_url=ollama_url,
            ollama_model=_text("VIDEO_GENERATION_OLLAMA_MODEL", "qwen2.5:3b"),
            storyboard_llm_base_url=storyboard_llm_base_url,
            storyboard_llm_api_key=storyboard_llm_api_key,
            storyboard_llm_model=storyboard_llm_model,
            storyboard_llm_allow_unauthenticated=storyboard_llm_allow_unauthenticated,
            storyboard_llm_timeout_seconds=_decimal(
                "VIDEO_GENERATION_LLM_TIMEOUT_SECONDS", 120.0, 1.0, 600.0
            ),
            pexels_api_key=_optional_text("PEXELS_API_KEY"),
            pixabay_api_key=_optional_text("PIXABAY_API_KEY"),
            music_dir=_optional_text("VIDEO_GENERATION_MUSIC_DIR"),
            tts_provider=tts_provider,
            tts_binary=_text("VIDEO_GENERATION_TTS_BINARY", "espeak-ng"),
            edge_tts_binary=_text("VIDEO_GENERATION_EDGE_TTS_BINARY", "edge-tts"),
            ffmpeg_binary=_text("VIDEO_GENERATION_FFMPEG_BINARY", "ffmpeg"),
            ffprobe_binary=_text("VIDEO_GENERATION_FFPROBE_BINARY", "ffprobe"),
            video_generation_max_source_bytes=_integer(
                "VIDEO_GENERATION_MAX_SOURCE_BYTES", 104857600, 1, 524288000
            ),
            moneyprinter_api_url=api_url,
            moneyprinter_api_key=_optional_text("MONEYPRINTER_API_KEY"),
            moneyprinter_allow_unauthenticated=_boolean(
                "MONEYPRINTER_ALLOW_UNAUTHENTICATED", False
            ),
            minio_url=minio_url,
            minio_access_key=_optional_text("MINIO_ACCESS_KEY"),
            minio_secret_key=_optional_text("MINIO_SECRET_KEY"),
            video_generation_output_bucket=_bucket(
                "VIDEO_GENERATION_OUTPUT_BUCKET", "video-generation-results"
            ),
            video_generation_max_output_bytes=_integer(
                "VIDEO_GENERATION_MAX_OUTPUT_BYTES", 524288000, 1, 5368709120
            ),
            request_timeout_seconds=_decimal(
                "VIDEO_GENERATION_REQUEST_TIMEOUT_SECONDS", 30.0, 1.0, 300.0
            ),
            poll_interval_seconds=_decimal(
                "VIDEO_GENERATION_POLL_INTERVAL_SECONDS", 5.0, 0.5, 60.0
            ),
            max_poll_seconds=_decimal(
                "VIDEO_GENERATION_MAX_POLL_SECONDS", 1800.0, 60.0, 86400.0
            ),
            max_video_count=_integer(
                "VIDEO_GENERATION_MAX_VIDEO_COUNT", 3, 1, 10
            ),
            max_clip_duration_seconds=_integer(
                "VIDEO_GENERATION_MAX_CLIP_DURATION_SECONDS", 15, 1, 60
            ),
        )

    @property
    def provider_configured(self) -> bool:
        if self.provider == "moneyprinter":
            return self.moneyprinter_api_url is not None and (
                self.moneyprinter_api_key is not None
                or self.moneyprinter_allow_unauthenticated
            )
        if self.storyboard_llm_provider == "ollama":
            return bool(self.ollama_url and self.ollama_model)
        return bool(
            self.storyboard_llm_base_url
            and self.storyboard_llm_model
            and (
                self.storyboard_llm_api_key
                or self.storyboard_llm_allow_unauthenticated
            )
        )

    @property
    def storage_configured(self) -> bool:
        return (
            self.minio_url is not None
            and self.minio_access_key is not None
            and self.minio_secret_key is not None
        )
