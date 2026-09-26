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
from .local_pipeline import LocalPipelineTask, LocalVideoPipelineProvider, PipelineError
from .moneyprinter import MoneyPrinterClient, MoneyPrinterError
from .settings import Settings
from .storage import MinioVideoStorage, StorageError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


Publish = Callable[[dict[str, Any]], None]


def _decode_message(value: bytes) -> dict[str, Any]:
    decoded = json.loads(value.decode("utf-8"))
    if not isinstance(decoded, dict):
        raise ValueError("Kafka message must be a JSON object")
    return decoded


def process_event(
    event: Mapping[str, Any],
    client: Any,
    storage: MinioVideoStorage | None,
    publish: Publish,
) -> None:
    try:
        command = parse_generation_command(event)
    except EventValidationError as exc:
        publish(validation_failure_event(event, exc.code, str(exc)))
        return

    publish(result_event(command, "PROGRESS", "VALIDATING", 0))

    def on_progress(progress: int, stage: str, provider_task_id: str) -> None:
        publish(
            result_event(
                command,
                "PROGRESS",
                stage,
                min(94, progress),
                provider_task_id=provider_task_id,
            )
        )

    try:
        task = client.wait(command, on_progress)
    except (MoneyPrinterError, PipelineError) as exc:
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
        logger.exception("Unexpected video generation failure for job %s", command.job_id)
        publish(
            result_event(
                command,
                "FAILED",
                "FAILED",
                0,
                error={
                    "code": "WORKER_ERROR",
                    "message": "video generation failed unexpectedly",
                },
            )
        )
        return

    publish(
        result_event(
            command,
            "PROGRESS",
            "STORAGE",
            95,
            provider_task_id=task.task_id,
        )
    )
    if storage is None:
        cleanup = getattr(task, "cleanup", None)
        if callable(cleanup):
            cleanup()
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                provider_task_id=task.task_id,
                error={
                    "code": "STORAGE_NOT_CONFIGURED",
                    "message": "video output storage is not configured",
                },
            )
        )
        return

    try:
        if isinstance(task, LocalPipelineTask):
            stored_objects = storage.store_files(
                task.outputs,
                job_id=command.job_id,
                execution_version=command.execution_version,
            )
            result = LocalPipelineTask.result_payload(
                task, [stored.payload() for stored in stored_objects]
            )
        else:
            stored_objects = storage.store_outputs(
                task.outputs,
                job_id=command.job_id,
                execution_version=command.execution_version,
                provider_base_url=client.base_url,
            )
            result = MoneyPrinterClient.result_payload(
                task, [stored.payload() for stored in stored_objects]
            )
    except StorageError as exc:
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                provider_task_id=task.task_id,
                error={"code": exc.code, "message": str(exc)},
            )
        )
        return
    except Exception:
        logger.exception("Unexpected video storage failure for job %s", command.job_id)
        publish(
            result_event(
                command,
                "FAILED",
                "STORAGE",
                0,
                provider_task_id=task.task_id,
                error={
                    "code": "STORAGE_ERROR",
                    "message": "video output storage failed unexpectedly",
                },
            )
        )
        return
    finally:
        cleanup = getattr(task, "cleanup", None)
        if callable(cleanup):
            cleanup()

    publish(
        result_event(
            command,
            "COMPLETED",
            "FINALIZE",
            100,
            provider_task_id=task.task_id,
            result=result,
        )
    )


def _send(producer: KafkaProducer, topic: str, payload: dict[str, Any]) -> None:
    future = producer.send(topic, value=payload)
    future.get(timeout=15)


def run(settings: Settings | None = None, client: Any | None = None) -> None:
    settings = settings or Settings.from_env()
    if (
        not settings.provider_configured
        or not settings.storage_configured
        or settings.minio_url is None
        or settings.minio_access_key is None
        or settings.minio_secret_key is None
    ):
        logger.error("Video generation worker is not ready: configure its provider and MinIO")
        return

    from kafka import KafkaConsumer, KafkaProducer

    if client is None and settings.provider == "local":
        client = LocalVideoPipelineProvider(settings)
    elif client is None and settings.provider == "moneyprinter":
        if settings.moneyprinter_api_url is None:
            logger.error("MoneyPrinterTurbo provider selected but MONEYPRINTER_API_URL is missing")
            return
        client = MoneyPrinterClient(
            settings.moneyprinter_api_url,
            settings.moneyprinter_api_key,
            settings.request_timeout_seconds,
            settings.max_video_count,
            settings.max_clip_duration_seconds,
            poll_interval_seconds=settings.poll_interval_seconds,
            max_poll_seconds=settings.max_poll_seconds,
        )
    storage = MinioVideoStorage(
        settings.minio_url,
        settings.minio_access_key,
        settings.minio_secret_key,
        settings.video_generation_output_bucket,
        settings.video_generation_max_output_bytes,
        settings.request_timeout_seconds,
    )
    storage.ensure_bucket()
    max_processing_seconds = settings.max_poll_seconds * (
        settings.max_video_count if settings.provider == "local" else 1
    )
    consumer = KafkaConsumer(
        settings.input_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.group_id,
        value_deserializer=_decode_message,
        enable_auto_commit=False,
        max_poll_interval_ms=int(max_processing_seconds * 1000) + 60000,
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

    logger.info("Video generation worker listening on %s", settings.input_topic)
    try:
        for message in consumer:
            try:
                process_event(message.value, client, storage, publish)
                producer.flush()
                consumer.commit()
            except Exception:
                logger.exception("Video generation message was not acknowledged")
                raise
    finally:
        consumer.close()
        producer.flush()
        producer.close()


if __name__ == "__main__":
    run()
