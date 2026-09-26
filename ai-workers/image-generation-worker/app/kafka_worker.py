from __future__ import annotations

import json
import logging
from typing import Any, Callable, Mapping

from .events import (
    EventValidationError,
    parse_generation_command,
    result_event,
    validation_failure_event,
)
from .provider import GeneratedImages, ImageProviderClient, ImageProviderError
from .settings import Settings
from .storage import MinioImageStorage, StorageError, StoredObject


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


Publish = Callable[[dict[str, Any]], None]


def _decode_message(value: bytes) -> dict[str, Any]:
    decoded = json.loads(value.decode("utf-8"))
    if not isinstance(decoded, dict):
        raise ValueError("Kafka message must be a JSON object")
    return decoded


def _store_images(
    storage: MinioImageStorage,
    generated: GeneratedImages,
    *,
    job_id: str,
    execution_version: int,
) -> list[StoredObject]:
    stored: list[StoredObject] = []
    for image in generated.images:
        if image.base64_data:
            stored.append(
                storage.store_base64(
                    image.base64_data,
                    job_id=job_id,
                    execution_version=execution_version,
                    index=image.index,
                )
            )
        elif image.url:
            stored.append(
                storage.store_url(
                    image.url,
                    job_id=job_id,
                    execution_version=execution_version,
                    index=image.index,
                )
            )
        else:
            raise StorageError("OUTPUT_MISSING", "provider returned an empty image")
    if not stored:
        raise StorageError("OUTPUT_MISSING", "provider returned no image outputs")
    return stored


def process_event(
    event: Mapping[str, Any],
    client: ImageProviderClient,
    storage: MinioImageStorage | None,
    publish: Publish,
) -> None:
    try:
        command = parse_generation_command(event)
    except EventValidationError as exc:
        publish(validation_failure_event(event, exc.code, str(exc)))
        return

    publish(result_event(command, "PROGRESS", "VALIDATING", 0))
    publish(result_event(command, "PROGRESS", "RENDERING", 10))

    try:
        generated = client.generate(command)
    except ImageProviderError as exc:
        publish(
            result_event(
                command,
                "FAILED",
                "FAILED",
                0,
                error={"code": exc.code, "message": str(exc)},
            )
        )
        return
    except Exception:
        logger.exception("Unexpected image generation failure for job %s", command.job_id)
        publish(
            result_event(
                command,
                "FAILED",
                "FAILED",
                0,
                error={
                    "code": "WORKER_ERROR",
                    "message": "image generation failed unexpectedly",
                },
            )
        )
        return

    publish(result_event(command, "PROGRESS", "STORAGE", 90))
    if storage is None:
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                error={
                    "code": "STORAGE_NOT_CONFIGURED",
                    "message": "image output storage is not configured",
                },
            )
        )
        return

    try:
        stored_objects = _store_images(
            storage,
            generated,
            job_id=command.job_id,
            execution_version=command.execution_version,
        )
        result = ImageProviderClient.result_payload(
            generated, [stored.payload() for stored in stored_objects]
        )
    except StorageError as exc:
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                error={"code": exc.code, "message": str(exc)},
            )
        )
        return
    except Exception:
        logger.exception("Unexpected image storage failure for job %s", command.job_id)
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                error={
                    "code": "STORAGE_ERROR",
                    "message": "image output storage failed unexpectedly",
                },
            )
        )
        return

    publish(result_event(command, "COMPLETED", "FINALIZE", 100, result=result))


def _send(producer: KafkaProducer, topic: str, payload: dict[str, Any]) -> None:
    future = producer.send(topic, value=payload)
    future.get(timeout=15)


def run(settings: Settings | None = None, client: ImageProviderClient | None = None) -> None:
    settings = settings or Settings.from_env()
    if (
        not settings.provider_configured
        or settings.image_provider_url is None
        or not settings.storage_configured
        or settings.minio_url is None
        or settings.minio_access_key is None
        or settings.minio_secret_key is None
    ):
        logger.error(
            "Image generation worker is not ready: configure the image provider and MinIO"
        )
        return

    from kafka import KafkaConsumer, KafkaProducer

    client = client or ImageProviderClient(
        settings.image_provider_url,
        settings.image_provider_api_key,
        settings.image_generation_request_timeout_seconds,
        settings.image_generation_max_image_count,
        api_path=settings.image_provider_api_path,
        auth_header=settings.image_provider_auth_header,
        auth_scheme=settings.image_provider_auth_scheme,
        default_model=settings.image_model,
        supports_negative_prompt=settings.image_provider_supports_negative_prompt,
    )
    storage = MinioImageStorage(
        settings.minio_url,
        settings.minio_access_key,
        settings.minio_secret_key,
        settings.image_generation_output_bucket,
        settings.image_generation_max_output_bytes,
        settings.image_generation_request_timeout_seconds,
        settings.image_generation_output_format,
    )
    storage.ensure_bucket()
    consumer = KafkaConsumer(
        settings.input_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.group_id,
        value_deserializer=_decode_message,
        enable_auto_commit=False,
        max_poll_interval_ms=int(settings.image_generation_request_timeout_seconds * 1000)
        + 600000,
    )
    producer = KafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
        acks="all",
        retries=5,
        max_in_flight_requests_per_connection=1,
    )

    def publish(payload: dict[str, Any]) -> None:
        _send(producer, settings.result_topic, payload)

    logger.info("Image generation worker listening on %s", settings.input_topic)
    try:
        for message in consumer:
            try:
                process_event(message.value, client, storage, publish)
                producer.flush()
                consumer.commit()
            except Exception:
                logger.exception("Image generation message was not acknowledged")
                raise
    finally:
        consumer.close()
        producer.flush()
        producer.close()


if __name__ == "__main__":
    run()
