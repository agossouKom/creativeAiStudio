import os
import json
import logging
import asyncio
import requests
from kafka import KafkaConsumer, KafkaProducer
from app.main import analyze_face, search_person_by_name, lookup_phone, get_visual_matches, upload_image_temp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
TOPIC_FACE    = "creativeai.face"
TOPIC_RESULTS = "creativeai.results"

def kafka_worker():
    consumer = KafkaConsumer(
        TOPIC_FACE,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        group_id='face-worker-group'
    )
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda m: json.dumps(m).encode('utf-8')
    )

    logger.info("Worker Kafka Visage (Face) démarré...")

    for message in consumer:
        event   = message.value
        job_id  = event.get("jobId")
        file_url     = event.get("fileUrl")
        text_query   = event.get("textQuery")
        phone_query  = event.get("phoneQuery")

        logger.info(f"Traitement du job face {job_id} via Kafka...")

        try:
            payload = {
                "jobId":  job_id,
                "status": "DONE",
                "type":   "person"
            }

            # 1. Traitement Image
            if file_url:
                resp = requests.get(file_url, timeout=15)
                resp.raise_for_status()
                image_bytes = resp.content

                public_image_url = upload_image_temp(image_bytes)
                face_result      = analyze_face(image_bytes)
                visual_matches   = get_visual_matches(image_bytes, public_image_url)

                payload["public_image_url"] = public_image_url
                payload["face_analysis"]    = face_result
                payload["visual_matches"]   = visual_matches
                payload["identity_search"]  = {
                    "status":          "pending",
                    "message":         "Intégration Milvus en Phase 4 — embeddings extraits et prêts.",
                    "sources_scanned": len(visual_matches),
                }

                if face_result.get("faces_detected", 0) > 0:
                    first_face = face_result["faces"][0]
                    payload["title"]       = f"Visage détecté ({first_face['gender']})"
                    payload["description"] = f"Âge estimé: {first_face['age']} ans. Score de détection: {first_face['det_score']}"
                else:
                    payload["title"]       = "Aucun visage détecté"
                    payload["description"] = "L'analyse d'image n'a trouvé aucun visage."

            # 2. Recherche par nom / texte
            if text_query:
                web_res = search_person_by_name(text_query)
                payload["web_search"]  = web_res
                payload["title"]       = text_query
                payload["description"] = f"Résultats de recherche OSINT pour {text_query}"

            # 3. Recherche par téléphone
            if phone_query:
                phone_res = lookup_phone(phone_query)
                payload["phone_lookup"] = phone_res
                payload["title"]        = f"Téléphone: {phone_query}"
                payload["description"]  = "Analyse inverse du numéro de téléphone"

            producer.send(TOPIC_RESULTS, payload)
            logger.info(f"Job face {job_id} terminé — {len(payload.get('visual_matches', []))} correspondances visuelles publiées.")

        except Exception as e:
            logger.error(f"Erreur job face {job_id}: {str(e)}")
            producer.send(TOPIC_RESULTS, {
                "jobId": job_id, "status": "FAILED",
                "error": str(e), "type": "person"
            })

if __name__ == "__main__":
    kafka_worker()
