from dataclasses import dataclass
from typing import Any, Mapping, Sequence

import requests

from .events import GenerationCommand, provider_params


class ImageProviderError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class ProviderImage:
    index: int
    base64_data: str | None
    url: str | None
    revised_prompt: str | None


@dataclass(frozen=True)
class GeneratedImages:
    model: str
    images: tuple[ProviderImage, ...]


class ImageProviderClient:
    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float,
        max_image_count: int,
        *,
        api_path: str = "/v1/images/generations",
        auth_header: str = "Authorization",
        auth_scheme: str = "Bearer",
        default_model: str = "",
        supports_negative_prompt: bool = False,
        session: requests.Session | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.max_image_count = max_image_count
        self.api_path = api_path
        self.auth_header = auth_header
        self.auth_scheme = auth_scheme
        self.default_model = default_model
        self.supports_negative_prompt = supports_negative_prompt
        self.session = session or requests.Session()

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.api_key:
            value = f"{self.auth_scheme} {self.api_key}".strip() if self.auth_scheme else self.api_key
            headers[self.auth_header] = value
        return headers

    def _request(self, path: str, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        try:
            response = self.session.post(
                f"{self.base_url}{path}",
                headers=self._headers(),
                json=payload,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            raise ImageProviderError(
                "PROVIDER_UNAVAILABLE", "image provider is unavailable"
            ) from exc

        status = getattr(response, "status_code", 0)
        if status in {401, 403}:
            raise ImageProviderError(
                "PROVIDER_AUTH_ERROR", "image provider rejected the API key"
            )
        if status == 429:
            raise ImageProviderError(
                "PROVIDER_RATE_LIMITED", "image provider rate limit reached"
            )
        if status >= 500:
            raise ImageProviderError(
                "PROVIDER_UNAVAILABLE", "image provider returned a server error"
            )
        if status >= 400:
            raise ImageProviderError(
                "PROVIDER_REQUEST_REJECTED",
                f"image provider rejected the request with HTTP {status}",
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise ImageProviderError(
                "INVALID_PROVIDER_RESPONSE", "image provider response is not JSON"
            ) from exc
        if not isinstance(body, Mapping):
            raise ImageProviderError(
                "INVALID_PROVIDER_RESPONSE", "image provider response is not an object"
            )
        return body

    def generate(self, command: GenerationCommand) -> GeneratedImages:
        if command.options.count > self.max_image_count:
            raise ImageProviderError("INVALID_OPTIONS", "count exceeds the worker limit")
        payload = provider_params(
            command,
            self.default_model,
            include_negative_prompt=self.supports_negative_prompt,
        )
        body = self._request(self.api_path, payload)
        error = body.get("error")
        if error and not body.get("data") and not body.get("image"):
            message = error.get("message") if isinstance(error, Mapping) else str(error)
            raise ImageProviderError("PROVIDER_FAILED", str(message)[:500])
        return GeneratedImages(
            model=str(payload.get("model") or self.default_model),
            images=_parse_images(body),
        )

    @staticmethod
    def result_payload(
        generated: GeneratedImages, stored_outputs: Sequence[Mapping[str, Any]]
    ) -> dict[str, Any]:
        if not stored_outputs:
            raise ValueError("stored_outputs must not be empty")
        return {
            "provider": "openai-compatible",
            "model": generated.model,
            "outputs": [dict(output) for output in stored_outputs],
            "outputCount": len(stored_outputs),
            "storageRequired": False,
        }


def _parse_images(payload: Mapping[str, Any]) -> tuple[ProviderImage, ...]:
    items = payload.get("data")
    if items is None:
        single = payload.get("image") or payload.get("image_base64")
        if isinstance(single, str) and single:
            return (ProviderImage(1, base64_data=single, url=None, revised_prompt=None),)
        raise ImageProviderError(
            "INVALID_PROVIDER_RESPONSE", "image provider response has no image data"
        )
    if not isinstance(items, list) or not items:
        raise ImageProviderError(
            "INVALID_PROVIDER_RESPONSE", "image provider returned no image"
        )
    images: list[ProviderImage] = []
    for index, item in enumerate(items, start=1):
        if not isinstance(item, Mapping):
            raise ImageProviderError(
                "INVALID_PROVIDER_RESPONSE", "image provider returned an invalid image entry"
            )
        base64_data = item.get("b64_json")
        url = item.get("url")
        revised_prompt = item.get("revised_prompt")
        if not isinstance(base64_data, str) or not base64_data:
            base64_data = None
        if not isinstance(url, str) or not url:
            url = None
        if base64_data is None and url is None:
            raise ImageProviderError(
                "INVALID_PROVIDER_RESPONSE",
                "image provider entry has neither base64 data nor a URL",
            )
        images.append(
            ProviderImage(
                index=index,
                base64_data=base64_data,
                url=url,
                revised_prompt=str(revised_prompt)[:1000] if revised_prompt else None,
            )
        )
    return tuple(images)
