import hashlib
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence
from urllib.parse import urljoin, urlsplit, urlunsplit

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


class MinioVideoStorage:
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
    ):
        if not endpoint_url or not access_key or not secret_key or not bucket:
            raise ValueError("video output storage configuration is incomplete")
        if max_output_bytes < 1:
            raise ValueError("max_output_bytes must be positive")
        self.endpoint_url = endpoint_url.rstrip("/")
        self.bucket = bucket
        self.max_output_bytes = max_output_bytes
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.s3 = s3_client or self._create_s3_client(
            endpoint_url, access_key, secret_key
        )

    @staticmethod
    def _create_s3_client(endpoint_url: str, access_key: str, secret_key: str) -> Any:
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required for video output storage") from exc
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
        )

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
                "STORAGE_UNAVAILABLE", "video output storage is unavailable"
            ) from exc

    def store_outputs(
        self,
        source_urls: Sequence[str],
        *,
        job_id: str,
        execution_version: int,
        provider_base_url: str,
    ) -> list[StoredObject]:
        if not source_urls:
            raise StorageError("OUTPUT_MISSING", "provider returned no video outputs")
        return [
            self.store_output(
                source_url,
                job_id=job_id,
                execution_version=execution_version,
                index=index,
                provider_base_url=provider_base_url,
            )
            for index, source_url in enumerate(source_urls, start=1)
        ]

    def store_files(
        self,
        source_paths: Sequence[str | Path],
        *,
        job_id: str,
        execution_version: int,
    ) -> list[StoredObject]:
        if not source_paths:
            raise StorageError("OUTPUT_MISSING", "video pipeline returned no output files")
        return [
            self.store_file(
                path,
                job_id=job_id,
                execution_version=execution_version,
                index=index,
            )
            for index, path in enumerate(source_paths, start=1)
        ]

    def store_file(
        self,
        source_path: str | Path,
        *,
        job_id: str,
        execution_version: int,
        index: int,
    ) -> StoredObject:
        path = Path(source_path)
        try:
            size = path.stat().st_size
        except OSError as exc:
            raise StorageError("OUTPUT_MISSING", "video output file is unavailable") from exc
        if size < 12:
            raise StorageError("OUTPUT_EMPTY", "video output file is empty or invalid")
        if size > self.max_output_bytes:
            raise StorageError("OUTPUT_TOO_LARGE", "video output exceeds the size limit")

        digest = hashlib.sha256()
        try:
            with path.open("rb") as body:
                if body.read(8)[4:8] != b"ftyp":
                    raise StorageError("OUTPUT_CONTENT_INVALID", "video output is not an MP4 file")
                body.seek(0)
                for chunk in iter(lambda: body.read(1024 * 1024), b""):
                    digest.update(chunk)
                body.seek(0)
                object_key = self._object_key(job_id, execution_version, index)
                self.s3.put_object(
                    Bucket=self.bucket,
                    Key=object_key,
                    Body=body,
                    ContentType="video/mp4",
                    Metadata={"sha256": digest.hexdigest()},
                )
        except StorageError:
            raise
        except OSError as exc:
            raise StorageError("OUTPUT_READ_FAILED", "video output file could not be read") from exc
        except Exception as exc:
            raise StorageError("STORAGE_UNAVAILABLE", "video output could not be stored") from exc

        return StoredObject(
            bucket=self.bucket,
            object_key=object_key,
            size_bytes=size,
            sha256=digest.hexdigest(),
            content_type="video/mp4",
        )

    def store_output(
        self,
        source_url: str,
        *,
        job_id: str,
        execution_version: int,
        index: int,
        provider_base_url: str,
    ) -> StoredObject:
        url = self._provider_url(source_url, provider_base_url)
        response = self.session.get(
            url,
            stream=True,
            timeout=self.timeout_seconds,
            allow_redirects=False,
        )
        try:
            self._validate_response(response)
            content_type = self._content_type(response)
            size, digest, body = self._read_response(response)
            try:
                object_key = self._object_key(job_id, execution_version, index)
                self.s3.put_object(
                    Bucket=self.bucket,
                    Key=object_key,
                    Body=body,
                    ContentType=content_type,
                    Metadata={"sha256": digest},
                )
            finally:
                body.close()
            return StoredObject(
                bucket=self.bucket,
                object_key=object_key,
                size_bytes=size,
                sha256=digest,
                content_type=content_type,
            )
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()

    def _provider_url(self, source_url: str, provider_base_url: str) -> str:
        if not isinstance(source_url, str) or not source_url.strip():
            raise StorageError("OUTPUT_URL_INVALID", "provider returned an invalid output URL")
        value = source_url.strip().replace("\\", "/")
        parsed = urlsplit(value)
        if parsed.netloc and not parsed.scheme:
            raise StorageError("OUTPUT_URL_INVALID", "provider output URL is invalid")
        if parsed.scheme:
            target = parsed
        else:
            target = urlsplit(urljoin(f"{provider_base_url.rstrip('/')}/", value.lstrip("/")))
        base = urlsplit(provider_base_url)
        if (
            target.scheme not in {"http", "https"}
            or not target.hostname
            or not base.hostname
            or target.username
            or target.password
            or self._authority(target) != self._authority(base)
            or not target.path
            or target.path == "/"
        ):
            raise StorageError(
                "OUTPUT_URL_REJECTED",
                "provider output URL is not on the configured provider host",
            )
        return urlunsplit(
            (target.scheme, target.netloc, target.path, target.query, "")
        )

    @staticmethod
    def _authority(parsed: Any) -> tuple[str, int] | None:
        try:
            port = parsed.port
        except ValueError:
            return None
        if port is None:
            port = 443 if parsed.scheme == "https" else 80
        return parsed.hostname.lower(), port

    @staticmethod
    def _validate_response(response: Any) -> None:
        status = getattr(response, "status_code", 0)
        if 300 <= status < 400:
            raise StorageError("OUTPUT_DOWNLOAD_REDIRECT", "provider output redirected unexpectedly")
        if status in {401, 403}:
            raise StorageError("OUTPUT_DOWNLOAD_FORBIDDEN", "provider output download was rejected")
        if status == 429:
            raise StorageError("OUTPUT_DOWNLOAD_RATE_LIMITED", "provider output download was rate limited")
        if status < 200 or status >= 300:
            raise StorageError("OUTPUT_DOWNLOAD_FAILED", "provider output could not be downloaded")

    @staticmethod
    def _content_type(response: Any) -> str:
        headers = getattr(response, "headers", {}) or {}
        value = str(headers.get("Content-Type", headers.get("content-type", "")))
        content_type = value.split(";", 1)[0].strip().lower()
        if not content_type:
            content_type = "application/octet-stream"
        if content_type.startswith("video/") or content_type in {
            "application/octet-stream",
            "binary/octet-stream",
        }:
            return "video/mp4" if content_type == "application/octet-stream" else content_type
        raise StorageError("OUTPUT_CONTENT_INVALID", "provider output is not a video")

    def _read_response(self, response: Any) -> tuple[int, str, Any]:
        headers = getattr(response, "headers", {}) or {}
        raw_length = headers.get("Content-Length", headers.get("content-length"))
        if raw_length is not None:
            try:
                declared_length = int(raw_length)
            except (TypeError, ValueError) as exc:
                raise StorageError("OUTPUT_RESPONSE_INVALID", "provider output length is invalid") from exc
            if declared_length < 0:
                raise StorageError("OUTPUT_RESPONSE_INVALID", "provider output length is invalid")
            if declared_length > self.max_output_bytes:
                raise StorageError("OUTPUT_TOO_LARGE", "provider output exceeds the size limit")

        body = tempfile.SpooledTemporaryFile(
            max_size=min(8 * 1024 * 1024, self.max_output_bytes),
            mode="w+b",
        )
        digest = hashlib.sha256()
        size = 0
        try:
            iterator = response.iter_content(chunk_size=1024 * 1024)
            for chunk in iterator:
                if not chunk:
                    continue
                if not isinstance(chunk, bytes):
                    raise StorageError("OUTPUT_RESPONSE_INVALID", "provider output is invalid")
                size += len(chunk)
                if size > self.max_output_bytes:
                    raise StorageError("OUTPUT_TOO_LARGE", "provider output exceeds the size limit")
                digest.update(chunk)
                body.write(chunk)
            if size == 0:
                raise StorageError("OUTPUT_EMPTY", "provider output is empty")
            body.seek(0)
            return size, digest.hexdigest(), body
        except Exception:
            body.close()
            raise

    @staticmethod
    def _object_key(job_id: str, execution_version: int, index: int) -> str:
        normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", job_id).strip(".-")
        if not normalized:
            normalized = hashlib.sha256(job_id.encode("utf-8")).hexdigest()[:24]
        elif normalized != job_id:
            suffix = hashlib.sha256(job_id.encode("utf-8")).hexdigest()[:12]
            normalized = f"{normalized[:80]}-{suffix}"
        return f"results/{normalized}/{execution_version}/video-{index}.mp4"
