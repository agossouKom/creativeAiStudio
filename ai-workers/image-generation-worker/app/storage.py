import base64
import binascii
import hashlib
import ipaddress
import re
import socket
from dataclasses import dataclass
from typing import Any, Callable, Iterable
from urllib.parse import urlsplit, urlunsplit

import requests


class StorageError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class StoredObject:
    bucket: str
    object_key: str
    size_bytes: int
    sha256: str
    content_type: str

    def payload(self) -> dict[str, Any]:
        return {
            "bucket": self.bucket,
            "objectKey": self.object_key,
            "sizeBytes": self.size_bytes,
            "sha256": self.sha256,
            "contentType": self.content_type,
        }


_MAGIC_TYPES: tuple[tuple[bytes, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"GIF87a", "image/gif", "gif"),
    (b"GIF89a", "image/gif", "gif"),
    (b"BM", "image/bmp", "bmp"),
)
_BLOCKED_HOSTS = frozenset({"localhost", "metadata.google.internal", "169.254.169.254"})
_BLOCKED_SUFFIXES = (".local", ".internal", ".localhost")


def _sniff_image(data: bytes) -> tuple[str, str] | None:
    for prefix, content_type, extension in _MAGIC_TYPES:
        if data.startswith(prefix):
            return content_type, extension
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


class MinioImageStorage:
    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        max_output_bytes: int,
        timeout_seconds: float,
        *,
        session: requests.Session | None = None,
        s3_client: Any | None = None,
        resolver: Callable[[str], Iterable[str]] | None = None,
    ):
        if not endpoint_url or not access_key or not secret_key or not bucket:
            raise ValueError("image output storage configuration is incomplete")
        if max_output_bytes < 1:
            raise ValueError("max_output_bytes must be positive")
        self.endpoint_url = endpoint_url.rstrip("/")
        self.bucket = bucket
        self.max_output_bytes = max_output_bytes
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.resolver = resolver or self._resolve_with_socket
        self.s3 = s3_client or self._create_s3_client(
            endpoint_url, access_key, secret_key
        )

    @staticmethod
    def _create_s3_client(endpoint_url: str, access_key: str, secret_key: str) -> Any:
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for image output storage") from exc
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
        )

    @staticmethod
    def _resolve_with_socket(host: str) -> list[str]:
        try:
            infos = socket.getaddrinfo(host, None)
        except OSError:
            return []
        return [str(info[4][0]) for info in infos]

    def ensure_bucket(self) -> None:
        try:
            self.s3.head_bucket(Bucket=self.bucket)
            return
        except Exception:
            pass
        try:
            self.s3.create_bucket(Bucket=self.bucket)
        except Exception as exc:
            raise StorageError(
                "STORAGE_UNAVAILABLE", "image output storage is unavailable"
            ) from exc

    def store_base64(
        self,
        value: str,
        *,
        job_id: str,
        execution_version: int,
        index: int,
    ) -> StoredObject:
        return self._store_bytes(
            self._decode_base64(value),
            job_id=job_id,
            execution_version=execution_version,
            index=index,
        )

    def store_url(
        self,
        url: str,
        *,
        job_id: str,
        execution_version: int,
        index: int,
    ) -> StoredObject:
        target = self._public_url(url)
        response = self.session.get(
            target,
            stream=True,
            timeout=self.timeout_seconds,
            allow_redirects=False,
        )
        try:
            self._validate_response(response)
            declared_length = self._declared_length(response)
            if declared_length is not None and declared_length > self.max_output_bytes:
                raise StorageError(
                    "OUTPUT_TOO_LARGE", "provider output exceeds the size limit"
                )
            data = self._read_response(response)
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()
        return self._store_bytes(
            data, job_id=job_id, execution_version=execution_version, index=index
        )

    def _store_bytes(
        self,
        data: bytes,
        *,
        job_id: str,
        execution_version: int,
        index: int,
    ) -> StoredObject:
        if not data:
            raise StorageError("OUTPUT_EMPTY", "provider output is empty")
        if len(data) > self.max_output_bytes:
            raise StorageError("OUTPUT_TOO_LARGE", "provider output exceeds the size limit")
        sniffed = _sniff_image(data)
        if sniffed is None:
            raise StorageError(
                "OUTPUT_CONTENT_INVALID", "provider output is not a supported image"
            )
        content_type, extension = sniffed
        digest = hashlib.sha256(data).hexdigest()
        object_key = self._object_key(job_id, execution_version, index, extension)
        self.s3.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=data,
            ContentType=content_type,
            ContentLength=len(data),
            Metadata={"sha256": digest},
        )
        return StoredObject(
            bucket=self.bucket,
            object_key=object_key,
            size_bytes=len(data),
            sha256=digest,
            content_type=content_type,
        )

    def _decode_base64(self, value: str) -> bytes:
        if not isinstance(value, str) or not value.strip():
            raise StorageError("OUTPUT_CONTENT_INVALID", "provider image data is empty")
        raw = value.strip()
        if raw.startswith("data:"):
            header, separator, payload = raw.partition(",")
            if not separator or "base64" not in header.lower():
                raise StorageError(
                    "OUTPUT_CONTENT_INVALID", "provider image data URL is not base64"
                )
            if not header.lower().startswith("data:image/"):
                raise StorageError(
                    "OUTPUT_CONTENT_INVALID", "provider image data URL is not an image"
                )
            raw = payload
        raw = "".join(raw.split())
        if len(raw) > ((self.max_output_bytes // 3) + 1) * 4:
            raise StorageError("OUTPUT_TOO_LARGE", "provider output exceeds the size limit")
        try:
            return base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise StorageError(
                "OUTPUT_CONTENT_INVALID", "provider image is not valid base64"
            ) from exc

    def _public_url(self, url: str) -> str:
        if not isinstance(url, str) or not url.strip():
            raise StorageError("OUTPUT_URL_INVALID", "provider returned an invalid output URL")
        parsed = urlsplit(url.strip())
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.fragment
        ):
            raise StorageError("OUTPUT_URL_INVALID", "provider output URL is invalid")
        host = parsed.hostname.lower()
        if host in _BLOCKED_HOSTS or host.endswith(_BLOCKED_SUFFIXES):
            raise StorageError(
                "OUTPUT_URL_REJECTED", "provider output URL host is not allowed"
            )
        for address in self.resolver(host):
            try:
                parsed_address = ipaddress.ip_address(address)
            except ValueError as exc:
                raise StorageError(
                    "OUTPUT_URL_REJECTED", "provider output URL host could not be verified"
                ) from exc
            if not parsed_address.is_global:
                raise StorageError(
                    "OUTPUT_URL_REJECTED",
                    "provider output URL resolves to a non-public address",
                )
        return urlunsplit(
            (parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, "")
        )

    @staticmethod
    def _validate_response(response: Any) -> None:
        status = getattr(response, "status_code", 0)
        if 300 <= status < 400:
            raise StorageError(
                "OUTPUT_DOWNLOAD_REDIRECT", "provider output redirected unexpectedly"
            )
        if status in {401, 403}:
            raise StorageError(
                "OUTPUT_DOWNLOAD_FORBIDDEN", "provider output download was rejected"
            )
        if status == 429:
            raise StorageError(
                "OUTPUT_DOWNLOAD_RATE_LIMITED", "provider output download was rate limited"
            )
        if status < 200 or status >= 300:
            raise StorageError(
                "OUTPUT_DOWNLOAD_FAILED", "provider output could not be downloaded"
            )

    def _declared_length(self, response: Any) -> int | None:
        headers = getattr(response, "headers", {}) or {}
        raw_length = headers.get("Content-Length", headers.get("content-length"))
        if raw_length is None:
            return None
        try:
            declared_length = int(raw_length)
        except (TypeError, ValueError) as exc:
            raise StorageError(
                "OUTPUT_RESPONSE_INVALID", "provider output length is invalid"
            ) from exc
        if declared_length < 0:
            raise StorageError(
                "OUTPUT_RESPONSE_INVALID", "provider output length is invalid"
            )
        return declared_length

    def _read_response(self, response: Any) -> bytes:
        buffer = bytearray()
        try:
            iterator = response.iter_content(chunk_size=64 * 1024)
            for chunk in iterator:
                if not chunk:
                    continue
                if not isinstance(chunk, bytes):
                    raise StorageError(
                        "OUTPUT_RESPONSE_INVALID", "provider output is invalid"
                    )
                buffer.extend(chunk)
                if len(buffer) > self.max_output_bytes:
                    raise StorageError(
                        "OUTPUT_TOO_LARGE", "provider output exceeds the size limit"
                    )
        except StorageError:
            raise
        except Exception as exc:
            raise StorageError(
                "OUTPUT_DOWNLOAD_FAILED", "provider output could not be downloaded"
            ) from exc
        if not buffer:
            raise StorageError("OUTPUT_EMPTY", "provider output is empty")
        return bytes(buffer)

    @staticmethod
    def _object_key(
        job_id: str, execution_version: int, index: int, extension: str
    ) -> str:
        normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", job_id).strip(".-")
        if not normalized:
            normalized = hashlib.sha256(job_id.encode("utf-8")).hexdigest()[:24]
        elif normalized != job_id:
            suffix = hashlib.sha256(job_id.encode("utf-8")).hexdigest()[:12]
            normalized = f"{normalized[:80]}-{suffix}"
        return f"results/{normalized}/{execution_version}/image-{index}.{extension}"
