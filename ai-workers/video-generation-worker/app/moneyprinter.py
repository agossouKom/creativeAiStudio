from dataclasses import dataclass
import time
from typing import Any, Callable, Mapping, Sequence
from urllib.parse import quote

import requests

from .events import GenerationCommand, provider_params


class MoneyPrinterError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class ProviderTask:
    task_id: str
    state: int | None
    progress: int
    videos: tuple[str, ...]
    combined_videos: tuple[str, ...]
    error: str | None
    failed_stage: str | None

    @property
    def outputs(self) -> tuple[str, ...]:
        return self.combined_videos or self.videos

    @classmethod
    def from_response(cls, payload: Mapping[str, Any]) -> "ProviderTask":
        data = payload.get("data")
        if not isinstance(data, Mapping):
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider response has no data")
        task_id = data.get("task_id")
        if not isinstance(task_id, str) or not task_id:
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider task id is missing")
        state_value = data.get("state")
        try:
            state = int(state_value) if state_value is not None else None
        except (TypeError, ValueError):
            state = None
        try:
            progress = max(0, min(100, int(data.get("progress", 0))))
        except (TypeError, ValueError):
            progress = 0
        error = data.get("error")
        failed_stage = data.get("failed_stage")
        return cls(
            task_id=task_id,
            state=state,
            progress=progress,
            videos=tuple(_string_values(data.get("videos"))),
            combined_videos=tuple(_string_values(data.get("combined_videos"))),
            error=str(error)[:1000] if error else None,
            failed_stage=str(failed_stage)[:100] if failed_stage else None,
        )


def _string_values(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


class MoneyPrinterClient:
    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float,
        max_video_count: int,
        max_clip_duration_seconds: int,
        *,
        poll_interval_seconds: float = 5.0,
        max_poll_seconds: float = 1800.0,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.max_video_count = max_video_count
        self.max_clip_duration_seconds = max_clip_duration_seconds
        self.poll_interval_seconds = poll_interval_seconds
        self.max_poll_seconds = max_poll_seconds
        self.session = session or requests.Session()
        self.sleep = sleep
        self.monotonic = monotonic

    def _headers(self, job_id: str | None = None) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        if job_id:
            headers["x-task-id"] = job_id
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        job_id: str | None = None,
        payload: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        try:
            response = self.session.request(
                method,
                f"{self.base_url}{path}",
                headers=self._headers(job_id),
                json=payload,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            raise MoneyPrinterError("PROVIDER_UNAVAILABLE", "MoneyPrinterTurbo is unavailable") from exc

        if response.status_code in {401, 403}:
            raise MoneyPrinterError("PROVIDER_AUTH_ERROR", "MoneyPrinterTurbo rejected the API key")
        if response.status_code == 429:
            raise MoneyPrinterError("PROVIDER_RATE_LIMITED", "MoneyPrinterTurbo rate limit reached")
        if response.status_code >= 500:
            raise MoneyPrinterError("PROVIDER_UNAVAILABLE", "MoneyPrinterTurbo returned a server error")
        if response.status_code >= 400:
            raise MoneyPrinterError(
                "PROVIDER_REQUEST_REJECTED",
                f"MoneyPrinterTurbo rejected the request with HTTP {response.status_code}",
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider response is not JSON") from exc
        if not isinstance(body, Mapping):
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider response is not an object")
        return body

    def create(self, command: GenerationCommand) -> str:
        if command.options.video_count > self.max_video_count:
            raise MoneyPrinterError("INVALID_OPTIONS", "videoCount exceeds the worker limit")
        if command.options.clip_duration_seconds > self.max_clip_duration_seconds:
            raise MoneyPrinterError("INVALID_OPTIONS", "clipDurationSeconds exceeds the worker limit")
        body = self._request(
            "POST",
            "/api/v1/videos",
            job_id=command.job_id,
            payload=provider_params(command),
        )
        data = body.get("data")
        if not isinstance(data, Mapping):
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider create response has no data")
        task_id = data.get("task_id")
        if not isinstance(task_id, str) or not task_id:
            raise MoneyPrinterError("INVALID_PROVIDER_RESPONSE", "provider create response has no task id")
        return task_id

    def get_task(self, task_id: str) -> ProviderTask:
        body = self._request("GET", f"/api/v1/tasks/{quote(task_id, safe='')}")
        return ProviderTask.from_response(body)

    def wait(
        self,
        command: GenerationCommand,
        on_progress: Callable[[int, str, str], None],
    ) -> ProviderTask:
        task_id = self.create(command)
        deadline = self.monotonic() + self.max_poll_seconds
        on_progress(0, "QUEUED", task_id)
        while True:
            task = self.get_task(task_id)
            if task.state == -1:
                message = task.error or "MoneyPrinterTurbo reported a failed task"
                raise MoneyPrinterError("PROVIDER_FAILED", message)
            if task.state == 1:
                if not task.outputs:
                    raise MoneyPrinterError("PROVIDER_OUTPUT_MISSING", "provider completed without a video")
                on_progress(100, "FINALIZE", task_id)
                return task
            if self.monotonic() >= deadline:
                raise MoneyPrinterError("PROVIDER_TIMEOUT", "MoneyPrinterTurbo task timed out")
            on_progress(task.progress, _stage_for_task(task), task_id)
            self.sleep(self.poll_interval_seconds)

    @staticmethod
    def result_payload(
        task: ProviderTask, stored_outputs: Sequence[Mapping[str, Any]]
    ) -> dict[str, Any]:
        if not stored_outputs:
            raise ValueError("stored_outputs must not be empty")
        return {
            "provider": "moneyprinterturbo",
            "providerTaskId": task.task_id,
            "outputs": [dict(output) for output in stored_outputs],
            "outputCount": len(stored_outputs),
            "storageRequired": False,
        }


def _stage_for_task(task: ProviderTask) -> str:
    value = (task.failed_stage or "").lower().replace(" ", "_")
    aliases = {
        "audio": "VOICEOVER",
        "subtitle": "SUBTITLES",
        "material": "VISUALS",
        "materials": "VISUALS",
        "terms": "VISUALS",
        "video": "COMPOSITION",
        "combine": "COMPOSITION",
    }
    return aliases.get(value, "PROCESSING")
