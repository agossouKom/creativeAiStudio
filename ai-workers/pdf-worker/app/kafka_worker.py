import os
import io
import json
import logging
import requests
import boto3
from kafka import KafkaConsumer, KafkaProducer
from app.main import merge_pdfs, split_pdf, compress_pdf, add_watermark, docx_to_pdf, pdf_to_docx, file_to_pdf

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
MINIO_URL        = os.getenv("MINIO_URL", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "creativeai")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "creativeai123")
RESULT_BUCKET    = "docfusion-results"

TOPIC_PDF     = "creativeai.pdf"
TOPIC_RESULTS = "creativeai.docfusion.results"

s3 = boto3.client(
    "s3",
    endpoint_url=MINIO_URL,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    region_name="us-east-1",
)

def ensure_bucket():
    try:
        s3.head_bucket(Bucket=RESULT_BUCKET)
    except Exception:
        s3.create_bucket(Bucket=RESULT_BUCKET)
        logger.info("Bucket '%s' créé.", RESULT_BUCKET)


def upload_result(job_id: str, filename: str, data: bytes, content_type: str) -> str:
    key = f"results/{job_id}/{filename}"
    s3.put_object(Bucket=RESULT_BUCKET, Key=key, Body=data, ContentType=content_type)
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": RESULT_BUCKET, "Key": key},
        ExpiresIn=7200,
    )
    return url


def download_file(url: str) -> bytes:
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def kafka_worker():
    ensure_bucket()

    consumer = KafkaConsumer(
        TOPIC_PDF,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="pdf-worker-group",
    )
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda m: json.dumps(m).encode("utf-8"),
    )

    logger.info("PDF Worker Kafka démarré — écoute topic '%s'...", TOPIC_PDF)

    for message in consumer:
        event     = message.value
        job_id    = event.get("jobId")
        op        = event.get("operationType", "").upper()
        file_urls = event.get("fileUrls", [])
        params    = event.get("params", {})

        logger.info("Job %s — opération: %s", job_id, op)

        try:
            if op == "MERGE":
                file_names = event.get("fileNames", [""] * len(file_urls))
                files_bytes = [download_file(u) for u in file_urls]
                result_bytes = merge_pdfs(files_bytes, file_names)
                result_url = upload_result(job_id, "merged.pdf", result_bytes, "application/pdf")
                _publish_success(producer, job_id, op, result_url, "merged.pdf")

            elif op == "SPLIT":
                pdf_bytes = download_file(file_urls[0])
                start = int(params.get("start", 1))
                end   = int(params.get("end", 1))
                result_bytes = split_pdf(pdf_bytes, start, end)
                fname = f"split_{start}_{end}.pdf"
                result_url = upload_result(job_id, fname, result_bytes, "application/pdf")
                _publish_success(producer, job_id, op, result_url, fname)

            elif op == "COMPRESS":
                pdf_bytes = download_file(file_urls[0])
                result_bytes = compress_pdf(pdf_bytes)
                result_url = upload_result(job_id, "compressed.pdf", result_bytes, "application/pdf")
                _publish_success(producer, job_id, op, result_url, "compressed.pdf")

            elif op == "WATERMARK":
                pdf_bytes = download_file(file_urls[0])
                text = params.get("text", "CONFIDENTIEL")
                result_bytes = add_watermark(pdf_bytes, text)
                result_url = upload_result(job_id, "watermarked.pdf", result_bytes, "application/pdf")
                _publish_success(producer, job_id, op, result_url, "watermarked.pdf")

            elif op == "TO_PDF":
                doc_bytes = download_file(file_urls[0])
                result_bytes = docx_to_pdf(doc_bytes)
                result_url = upload_result(job_id, "converted.pdf", result_bytes, "application/pdf")
                _publish_success(producer, job_id, op, result_url, "converted.pdf")

            elif op == "TO_DOCX":
                pdf_bytes = download_file(file_urls[0])
                result_bytes = pdf_to_docx(pdf_bytes)
                ct = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                result_url = upload_result(job_id, "converted.docx", result_bytes, ct)
                _publish_success(producer, job_id, op, result_url, "converted.docx")

            else:
                raise ValueError(f"Opération inconnue: {op}")

        except Exception as e:
            logger.error("Erreur job %s: %s", job_id, e)
            producer.send(TOPIC_RESULTS, {
                "jobId": job_id,
                "status": "FAILED",
                "operationType": op,
                "error": str(e),
            })


def _publish_success(producer, job_id: str, op: str, result_url: str, filename: str):
    producer.send(TOPIC_RESULTS, {
        "jobId": job_id,
        "status": "DONE",
        "operationType": op,
        "resultUrl": result_url,
        "fileName": filename,
    })
    logger.info("Job %s (%s) terminé → %s", job_id, op, filename)


if __name__ == "__main__":
    kafka_worker()
