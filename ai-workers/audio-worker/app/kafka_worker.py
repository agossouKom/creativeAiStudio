import os
import json
import logging
import asyncio
import requests
from kafka import KafkaConsumer, KafkaProducer
from app.main import (
    recognize_with_shazam,
    generate_fingerprint,
    lookup_acoustid,
    fetch_lyrics,
    fetch_itunes_cover,
    analyze_audio_features,
    ACOUSTID_API_KEY,
    convert_to_wav,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_AUDIO   = "creativeai.audio"
TOPIC_RESULTS = "creativeai.results"


async def process_job(event: dict) -> dict:
    job_id   = event.get("jobId")
    file_url = event.get("fileUrl")

    logger.info("Traitement du job audio %s", job_id)

    resp = requests.get(file_url, timeout=30)
    resp.raise_for_status()
    audio_bytes = resp.content

    if "webm" in file_url.lower():
        logger.info("Conversion webm → wav")
        audio_bytes = convert_to_wav(audio_bytes, "webm")
    elif "ogg" in file_url.lower() and "mpeg" not in file_url.lower():
        logger.info("Conversion ogg → wav")
        audio_bytes = convert_to_wav(audio_bytes, "ogg")

    match, features = await asyncio.gather(
        recognize_with_shazam(audio_bytes),
        analyze_audio_features(audio_bytes),
    )

    if not match and ACOUSTID_API_KEY:
        fingerprint, duration = await generate_fingerprint(audio_bytes)
        match = await lookup_acoustid(fingerprint, duration)

    lyrics = None
    if match:
        lyrics = await fetch_lyrics(match["artist"], match["title"])
        if not match.get("cover_url"):
            match["cover_url"] = await fetch_itunes_cover(
                match["artist"], match["title"]
            )

    result = {
        "jobId":    job_id,
        "status":   "DONE",
        "type":     "audio",
        "match":    match,
        "features": features,
        "lyrics":   lyrics,
    }

    if match:
        result["title"]  = match["title"]
        result["artist"] = match["artist"]
        result["year"]   = str(match.get("release_date", ""))[:4]
        result["genre"]  = match.get("genre", "")
    else:
        result["title"]  = "Non reconnu"
        result["artist"] = ""

    return result


async def kafka_worker():
    consumer = KafkaConsumer(
        TOPIC_AUDIO,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="audio-worker-group",
    )
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda m: json.dumps(m).encode("utf-8"),
    )

    logger.info("Worker Kafka Audio démarré — en attente de messages...")

    for message in consumer:
        event  = message.value
        job_id = event.get("jobId", "?")
        try:
            result = await process_job(event)
            producer.send(TOPIC_RESULTS, result)
            logger.info("Job %s terminé → Kafka", job_id)
        except Exception as e:
            logger.error("Erreur job %s: %s", job_id, e)
            producer.send(
                TOPIC_RESULTS,
                {"jobId": job_id, "status": "FAILED", "error": str(e), "type": "audio"},
            )


if __name__ == "__main__":
    asyncio.run(kafka_worker())
