import os
import json
import logging
import requests
import boto3
from kafka import KafkaConsumer, KafkaProducer
from app.main import extract_text_from_image_bytes, extract_text_from_pdf_bytes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
MINIO_URL        = os.getenv("MINIO_URL", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "creativeai")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "creativeai123")

TOPIC_OCR     = "creativeai.ocr"
TOPIC_RESULTS = "creativeai.docfusion.results"

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_URL,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    region_name="us-east-1",
)


def kafka_worker():
    consumer = KafkaConsumer(
        TOPIC_OCR,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="ocr-worker-group",
    )
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda m: json.dumps(m).encode("utf-8"),
    )

    logger.info("OCR Worker Kafka démarré — écoute topic '%s'...", TOPIC_OCR)

    for message in consumer:
        event    = message.value
        job_id   = event.get("jobId")
        file_url = event.get("fileUrls", [None])[0]
        filename = event.get("fileName", "")

        logger.info("Job OCR %s — fichier: %s", job_id, filename)

        try:
            resp = requests.get(file_url, timeout=60)
            resp.raise_for_status()
            file_bytes = resp.content

            ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
            if ext == "pdf":
                text = extract_text_from_pdf_bytes(file_bytes)
            else:
                text = extract_text_from_image_bytes(file_bytes)

            producer.send(TOPIC_RESULTS, {
                "jobId": job_id,
                "status": "DONE",
                "operationType": "OCR",
                "text": text,
                "chars": len(text),
            })
            logger.info("Job OCR %s terminé — %d caractères extraits.", job_id, len(text))

        except Exception as e:
            logger.error("Erreur job OCR %s: %s", job_id, e)
            producer.send(TOPIC_RESULTS, {
                "jobId": job_id,
                "status": "FAILED",
                "operationType": "OCR",
                "error": str(e),
            })


if __name__ == "__main__":
    kafka_worker()
