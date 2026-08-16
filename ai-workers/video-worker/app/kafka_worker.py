import os
import json
import logging
import asyncio
import requests
from kafka import KafkaConsumer, KafkaProducer
from app.main import (
    analyze_video_metadata,
    extract_frames,
    extract_audio_bytes,
    recognize_video_audio,
    search_tmdb,
    get_tmdb_details,
    TMDB_API_KEY,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_VIDEO   = "creativeai.video"
TOPIC_RESULTS = "creativeai.results"


async def process_job(event: dict) -> dict:
    job_id   = event.get("jobId")
    file_url = event.get("fileUrl")
    logger.info("Traitement job vidéo %s", job_id)

    # 1. Téléchargement
    resp = requests.get(file_url, timeout=60)
    resp.raise_for_status()
    video_bytes = resp.content

    # 2. Métadonnées + frames
    metadata = analyze_video_metadata(video_bytes)
    frames   = extract_frames(video_bytes, max_frames=6)
    logger.info("Frames: %d | %s", len(frames), metadata.get("resolution"))

    # 3. Extraction audio + Shazam
    audio_bytes = extract_audio_bytes(video_bytes)
    audio_match = None
    tmdb_match  = None

    if audio_bytes:
        audio_match = await recognize_video_audio(audio_bytes)

    # 4. TMDb via indice Shazam
    if audio_match and audio_match.get("movie_hint") and TMDB_API_KEY:
        tmdb_result = search_tmdb(audio_match["movie_hint"])
        if tmdb_result:
            tmdb_match = get_tmdb_details(tmdb_result)

    # 5. Résultat Kafka
    result = {
        "jobId":           job_id,
        "status":          "DONE",
        "type":            "video",
        "metadata":        metadata,
        "frames_analyzed": len(frames),
        "audio_match":     audio_match,
        "tmdb_match":      tmdb_match,
    }

    if tmdb_match:
        result["title"]       = tmdb_match.get("title", "")
        result["description"] = tmdb_match.get("overview", "")
        result["year"]        = (tmdb_match.get("release_date") or "")[:4]
        result["genre"]       = tmdb_match["genres"][0] if tmdb_match.get("genres") else ""
    elif audio_match:
        result["title"] = audio_match.get("song_title", "")
        result["year"]  = audio_match.get("released", "")
    else:
        result["title"] = "Vidéo analysée"

    return result


async def kafka_worker():
    consumer = KafkaConsumer(
        TOPIC_VIDEO,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="video-worker-group",
    )
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda m: json.dumps(m).encode("utf-8"),
    )

    logger.info("Worker Kafka Vidéo démarré — en attente de messages...")

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
                {"jobId": job_id, "status": "FAILED", "error": str(e), "type": "video"},
            )


if __name__ == "__main__":
    asyncio.run(kafka_worker())
