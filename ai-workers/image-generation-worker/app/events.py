import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import uuid4


STAGES = frozenset(
    {
        "QUEUED",
        "VALIDATING",
        "RENDERING",
        "STORAGE",
        "FINALIZE",
        "PROCESSING",
        "FAILED",
    }
)
RESPONSE_FORMATS = frozenset({"b64_json", "url"})
_SIZE = re.compile(r"^(?P<width>[0-9]{2,4})x(?P<height>[0-9]{2,4})$")
_TOKEN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_OPTION_KEYS = frozenset(
    {
        "size",
        "count",
        "model",
        "style",
        "quality",
        "seed",
        "responseFormat",
    }
)


class EventValidationError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class GenerationOptions:
    size: str
    count: int
    model: str | None
    style: str | None
    quality: str | None
    seed: int | None
    response_format: str


@dataclass(frozen=True)
class GenerationCommand:
    schema_version: int
    event_id: str
    job_id: str
    execution_version: int
    user_id: str
    prompt: str
    negative_prompt: str | None
    options: GenerationOptions


def _required_string(value: Any, field: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise EventValidationError("INVALID_EVENT", f"{field} must be a string")
    normalized = value.strip()
    if not normalized or len(normalized) > maximum:
        raise EventValidationError("INVALID_EVENT", f"{field} is invalid")
    if any(ord(character) < 32 for character in normalized):
        raise EventValidationError("INVALID_EVENT", f"{field} contains control characters")
    return normalized


def _optional_string(value: Any, field: str, maximum: int) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise EventValidationError("INVALID_EVENT", f"{field} must be a string")
    normalized = value.strip()
    if len(normalized) > maximum:
        raise EventValidationError("INVALID_EVENT", f"{field} is invalid")
    return normalized or None


def _token(value: Any, field: str) -> str | None:
    normalized = _optional_string(value, field, 64)
    if normalized is None:
        return None
    if _TOKEN.fullmatch(normalized) is None:
        raise EventValidationError("INVALID_OPTIONS", f"{field} is not supported")
    return normalized


def _bounded_integer(value: Any, field: str, minimum: int, maximum: int, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise EventValidationError("INVALID_EVENT", f"{field} must be an integer")
    if not minimum <= value <= maximum:
        raise EventValidationError("INVALID_EVENT", f"{field} is outside the allowed range")
    return value


def _size(value: Any) -> str:
    normalized = _required_string(value, "size", 16)
    match = _SIZE.fullmatch(normalized)
    if match is None:
        raise EventValidationError("INVALID_OPTIONS", "size must look like 1024x1024")
    for group in ("width", "height"):
        dimension = int(match.group(group))
        if not 64 <= dimension <= 4096:
            raise EventValidationError(
                "INVALID_OPTIONS", "size dimensions must be between 64 and 4096"
            )
    return normalized


def parse_generation_command(event: Mapping[str, Any]) -> GenerationCommand:
    if not isinstance(event, Mapping):
        raise EventValidationError("INVALID_EVENT", "event must be an object")
    schema_version = event.get("schemaVersion")
    if (
        isinstance(schema_version, bool)
        or not isinstance(schema_version, int)
        or schema_version != 1
    ):
        raise EventValidationError("UNSUPPORTED_SCHEMA", "schemaVersion must be 1")

    event_id = _required_string(event.get("eventId"), "eventId", 128)
    job_id = _required_string(event.get("jobId"), "jobId", 128)
    user_id = _required_string(event.get("userId"), "userId", 256)
    execution_version = _bounded_integer(
        event.get("executionVersion"), "executionVersion", 1, 100000, 1
    )
    prompt = _required_string(event.get("prompt"), "prompt", 4000)
    negative_prompt = _optional_string(
        event.get("negativePrompt"), "negativePrompt", 2000
    )

    raw_options = event.get("options", {})
    if raw_options is None:
        raw_options = {}
    if not isinstance(raw_options, Mapping):
        raise EventValidationError("INVALID_EVENT", "options must be an object")
    unknown_options = set(raw_options) - _OPTION_KEYS
    if unknown_options:
        raise EventValidationError(
            "UNSUPPORTED_OPTIONS", "one or more generation options are not supported"
        )

    assets = event.get("assets", [])
    if not isinstance(assets, list):
        raise EventValidationError("INVALID_EVENT", "assets must be an array")
    if assets:
        raise EventValidationError(
            "UNSUPPORTED_ASSETS", "image conditioning assets are not supported yet"
        )

    response_format = raw_options.get("responseFormat", "b64_json")
    if response_format not in RESPONSE_FORMATS:
        raise EventValidationError("INVALID_OPTIONS", "responseFormat is not supported")

    seed = None
    if raw_options.get("seed") is not None:
        seed = _bounded_integer(raw_options.get("seed"), "seed", 0, 2147483647, 0)

    options = GenerationOptions(
        size=_size(raw_options.get("size", "1024x1024")),
        count=_bounded_integer(raw_options.get("count"), "count", 1, 10, 1),
        model=_token(raw_options.get("model"), "model"),
        style=_token(raw_options.get("style"), "style"),
        quality=_token(raw_options.get("quality"), "quality"),
        seed=seed,
        response_format=response_format,
    )
    return GenerationCommand(
        schema_version=schema_version,
        event_id=event_id,
        job_id=job_id,
        execution_version=execution_version,
        user_id=user_id,
        prompt=prompt,
        negative_prompt=negative_prompt,
        options=options,
    )


def provider_params(
    command: GenerationCommand,
    default_model: str,
    *,
    include_negative_prompt: bool = False,
) -> dict[str, Any]:
    model = command.options.model or default_model
    payload: dict[str, Any] = {
        "prompt": command.prompt,
        "n": command.options.count,
        "size": command.options.size,
        "response_format": command.options.response_format,
    }
    if model:
        payload["model"] = model
    if command.options.style:
        payload["style"] = command.options.style
    if command.options.quality:
        payload["quality"] = command.options.quality
    if command.options.seed is not None:
        payload["seed"] = command.options.seed
    if include_negative_prompt and command.negative_prompt:
        payload["negative_prompt"] = command.negative_prompt
    return payload


def _stage(value: Any) -> str:
    normalized = str(value or "PROCESSING").upper().replace(" ", "_")
    aliases = {
        "IMAGE": "RENDERING",
        "GENERATE": "RENDERING",
        "INFERENCE": "RENDERING",
        "UPLOAD": "STORAGE",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in STAGES else "PROCESSING"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def result_event(
    command: GenerationCommand,
    event_type: str,
    stage: str,
    progress: int,
    *,
    event_id: str | None = None,
    result: Mapping[str, Any] | None = None,
    error: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    if event_type not in {"PROGRESS", "COMPLETED", "FAILED"}:
        raise ValueError("unsupported result event type")
    status = {
        "PROGRESS": "PROCESSING",
        "COMPLETED": "DONE",
        "FAILED": "FAILED",
    }[event_type]
    payload: dict[str, Any] = {
        "schemaVersion": 1,
        "eventId": event_id or str(uuid4()),
        "jobId": command.job_id,
        "executionVersion": command.execution_version,
        "userId": command.user_id,
        "type": event_type,
        "status": status,
        "stage": _stage(stage),
        "progress": max(0, min(100, int(progress))),
        "occurredAt": _now(),
    }
    if result is not None:
        payload["result"] = dict(result)
    if error is not None:
        payload["error"] = dict(error)
    return payload


def validation_failure_event(
    event: Any, code: str, message: str
) -> dict[str, Any]:
    source = event if isinstance(event, Mapping) else {}
    job_id = source.get("jobId")
    user_id = source.get("userId")
    event_id = source.get("eventId")
    return {
        "schemaVersion": 1,
        "eventId": event_id if isinstance(event_id, str) and event_id else str(uuid4()),
        "jobId": job_id if isinstance(job_id, str) and job_id else "unknown",
        "executionVersion": 1,
        "userId": user_id if isinstance(user_id, str) and user_id else "unknown",
        "type": "FAILED",
        "status": "FAILED",
        "stage": "VALIDATING",
        "progress": 0,
        "occurredAt": _now(),
        "error": {"code": code, "message": message[:500]},
    }
