import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit


_HEADER_NAME = re.compile(r"^[A-Za-z0-9-]{1,64}$")
_MODEL_NAME = re.compile(r"^[A-Za-z0-9._:/-]{1,128}$")
_API_PATH = re.compile(r"^/[A-Za-z0-9._~/-]{0,255}$")


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


def _api_path(name: str, value: str) -> str:
    if _API_PATH.fullmatch(value) is None or ".." in value:
        raise ValueError(f"{name} must be an absolute path without query or fragment")
    return value


def _header_name(name: str, default: str) -> str:
    value = _text(name, default)
    if _HEADER_NAME.fullmatch(value) is None:
        raise ValueError(f"{name} is not a valid HTTP header name")
    return value


def _model_name(name: str) -> str:
    value = _optional_text(name) or ""
    if value and _MODEL_NAME.fullmatch(value) is None:
        raise ValueError(f"{name} is not a valid model identifier")
    return value


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
    image_provider_url: str | None
    image_provider_api_key: str | None
    image_provider_allow_unauthenticated: bool
    image_provider_auth_header: str
    image_provider_auth_scheme: str
    image_provider_api_path: str
    image_provider_supports_negative_prompt: bool
    image_model: str
    minio_url: str | None
    minio_access_key: str | None
    minio_secret_key: str | None
    image_generation_output_bucket: str
    image_generation_max_output_bytes: int
    image_generation_max_image_count: int
    image_generation_request_timeout_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        provider_url = _http_url(
            "IMAGE_PROVIDER_URL", _optional_text("IMAGE_PROVIDER_URL")
        )
        minio_url = _http_url("MINIO_URL", _optional_text("MINIO_URL"))
        auth_scheme = _text("IMAGE_PROVIDER_AUTH_SCHEME", "Bearer").strip()
        if auth_scheme and not re.fullmatch(r"[A-Za-z0-9 ._-]{1,32}", auth_scheme):
            raise ValueError("IMAGE_PROVIDER_AUTH_SCHEME is not a valid value")
        return cls(
            kafka_bootstrap_servers=_text(
                "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"
            ),
            input_topic=_text("IMAGE_GENERATION_INPUT_TOPIC", "creativeai.image-generation"),
            result_topic=_text(
                "IMAGE_GENERATION_RESULT_TOPIC", "creativeai.image-generation.results"
            ),
            group_id=_text("IMAGE_GENERATION_GROUP_ID", "image-generation-worker"),
            image_provider_url=provider_url,
            image_provider_api_key=_optional_text("IMAGE_PROVIDER_API_KEY"),
            image_provider_allow_unauthenticated=_boolean(
                "IMAGE_PROVIDER_ALLOW_UNAUTHENTICATED", False
            ),
            image_provider_auth_header=_header_name(
                "IMAGE_PROVIDER_AUTH_HEADER", "Authorization"
            ),
            image_provider_auth_scheme=auth_scheme,
            image_provider_api_path=_api_path(
                "IMAGE_PROVIDER_API_PATH",
                _text("IMAGE_PROVIDER_API_PATH", "/v1/images/generations"),
            ),
            image_provider_supports_negative_prompt=_boolean(
                "IMAGE_PROVIDER_SUPPORTS_NEGATIVE_PROMPT", False
            ),
            image_model=_model_name("IMAGE_MODEL"),
            minio_url=minio_url,
            minio_access_key=_optional_text("MINIO_ACCESS_KEY"),
            minio_secret_key=_optional_text("MINIO_SECRET_KEY"),
            image_generation_output_bucket=_bucket(
                "IMAGE_GENERATION_OUTPUT_BUCKET", "image-generation-results"
            ),
            image_generation_max_output_bytes=_integer(
                "IMAGE_GENERATION_MAX_OUTPUT_BYTES", 33554432, 1, 536870912
            ),
            image_generation_max_image_count=_integer(
                "IMAGE_GENERATION_MAX_IMAGE_COUNT", 4, 1, 10
            ),
            image_generation_request_timeout_seconds=_decimal(
                "IMAGE_GENERATION_REQUEST_TIMEOUT_SECONDS", 120.0, 1.0, 600.0
            ),
        )

    @property
    def provider_configured(self) -> bool:
        return self.image_provider_url is not None and (
            self.image_provider_api_key is not None
            or self.image_provider_allow_unauthenticated
        )

    @property
    def storage_configured(self) -> bool:
        return (
            self.minio_url is not None
            and self.minio_access_key is not None
            and self.minio_secret_key is not None
        )
