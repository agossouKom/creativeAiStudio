from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import uuid4


ASPECT_RATIOS = frozenset({"16:9", "9:16", "1:1"})
VIDEO_SOURCES = frozenset({"pexels", "pixabay", "coverr"})
STAGES = frozenset(
    {
        "QUEUED",
        "VALIDATING",
        "SCRIPT",
        "VISUALS",
        "VOICEOVER",
        "SUBTITLES",
        "MUSIC",
        "COMPOSITION",
        "QUALITY_CHECK",
        "STORAGE",
        "FINALIZE",
        "PROCESSING",
        "FAILED",
    }
)
_OPTION_KEYS = frozenset(
    {
        "aspectRatio",
        "language",
        "voice",
        "subtitles",
        "videoCount",
        "clipDurationSeconds",
        "source",
    }
)


class EventValidationError(ValueError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class GenerationOptions:
    aspect_ratio: str
    language: str | None
    voice: str | None
    subtitles: bool
    video_count: int
    clip_duration_seconds: int
    source: str


@dataclass(frozen=True)
class GenerationCommand:
    schema_version: int
    event_id: str
    job_id: str
    execution_version: int
    user_id: str
    prompt: str
    options: GenerationOptions
    storyboards: tuple[Mapping[str, Any], ...] = ()


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


def _bounded_integer(value: Any, field: str, minimum: int, maximum: int, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, int):
        raise EventValidationError("INVALID_EVENT", f"{field} must be an integer")
    if not minimum <= value <= maximum:
        raise EventValidationError("INVALID_EVENT", f"{field} is outside the allowed range")
    return value


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
    prompt = _required_string(event.get("prompt"), "prompt", 8000)

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
            "UNSUPPORTED_ASSETS", "asset generation is not available in the first worker version"
        )

    aspect_ratio = raw_options.get("aspectRatio", "9:16")
    if aspect_ratio not in ASPECT_RATIOS:
        raise EventValidationError("INVALID_OPTIONS", "aspectRatio is not supported")

    source = raw_options.get("source", "pexels")
    if source not in VIDEO_SOURCES:
        raise EventValidationError("INVALID_OPTIONS", "source is not supported")

    subtitles = raw_options.get("subtitles", True)
    if not isinstance(subtitles, bool):
        raise EventValidationError("INVALID_OPTIONS", "subtitles must be a boolean")

    options = GenerationOptions(
        aspect_ratio=aspect_ratio,
        language=_optional_string(raw_options.get("language"), "language", 32),
        voice=_optional_string(raw_options.get("voice"), "voice", 128),
        subtitles=subtitles,
        video_count=_bounded_integer(
            raw_options.get("videoCount"), "videoCount", 1, 10, 1
        ),
        clip_duration_seconds=_bounded_integer(
            raw_options.get("clipDurationSeconds"),
            "clipDurationSeconds",
            1,
            60,
            5,
        ),
        source=source,
    )
    raw_storyboards = event.get("storyboards")
    storyboards: tuple[Mapping[str, Any], ...] = ()
    if raw_storyboards is not None:
        if (
            not isinstance(raw_storyboards, list)
            or len(raw_storyboards) != options.video_count
            or any(not isinstance(storyboard, Mapping) for storyboard in raw_storyboards)
        ):
            raise EventValidationError(
                "INVALID_STORYBOARD", "storyboards must match videoCount and be objects"
            )
        storyboards = tuple(raw_storyboards)
    return GenerationCommand(
        schema_version=schema_version,
        event_id=event_id,
        job_id=job_id,
        execution_version=execution_version,
        user_id=user_id,
        prompt=prompt,
        options=options,
        storyboards=storyboards,
    )


def provider_params(command: GenerationCommand) -> dict[str, Any]:
    return {
        "video_subject": command.prompt,
        "video_script": "",
        "video_aspect": command.options.aspect_ratio,
        "video_language": command.options.language or "",
        "voice_name": command.options.voice or "",
        "video_source": command.options.source,
        "video_count": command.options.video_count,
        "video_clip_duration": command.options.clip_duration_seconds,
        "subtitle_enabled": command.options.subtitles,
        "n_threads": 1,
    }


def _stage(value: Any) -> str:
    normalized = str(value or "PROCESSING").upper().replace(" ", "_")
    aliases = {
        "AUDIO": "VOICEOVER",
        "SUBTITLE": "SUBTITLES",
        "MATERIALS": "VISUALS",
        "TERMS": "VISUALS",
        "VIDEO": "COMPOSITION",
        "COMBINE": "COMPOSITION",
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
    provider_task_id: str | None = None,
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
    if provider_task_id:
        payload["providerTaskId"] = provider_task_id
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
