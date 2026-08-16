import asyncio
import grpc
import logging
import os
import sys

# Ajouter le chemin pour les fichiers générés par protoc
sys.path.append(os.path.join(os.path.dirname(__file__), 'generated'))

import creativeai_pb2
import creativeai_pb2_grpc
from app.main import generate_fingerprint, lookup_acoustid, analyze_audio_features

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AudioAnalysisService(creativeai_pb2_grpc.AudioAnalysisServiceServicer):
    
    async def AnalyzeFeatures(self, request, context):
        logger.info(f"gRPC AnalyzeFeatures reçu pour {request.file_url}")
        # Pour cet exemple, on suppose que l'URL est accessible
        import requests
        resp = requests.get(request.file_url)
        audio_bytes = resp.content
        
        features = await analyze_audio_features(audio_bytes)
        
        return creativeai_pb2.AudioFeatures(
            bpm=features['bpm'],
            key=features['key'],
            energy=features['energy']
        )

    async def StreamRecognize(self, request_iterator, context):
        # Implémentation du streaming bidirectionnel
        async for request in request_iterator:
            logger.info("gRPC StreamRecognize chunk reçu")
            # Logique de reconnaissance temps réel ici...
            yield creativeai_pb2.RecognitionResponse(status="ANALYZING", confidence=0.5)

async def serve():
    server = grpc.aio.server()
    creativeai_pb2_grpc.add_AudioAnalysisServiceServicer_to_server(
        AudioAnalysisService(), server
    )
    listen_addr = "[::]:50051"
    server.add_insecure_port(listen_addr)
    logger.info(f"Serveur gRPC Audio démarré sur {listen_addr}")
    await server.start()
    await server.wait_for_termination()

if __name__ == "__main__":
    # Note: Il faut d'abord générer les fichiers creativeai_pb2.py avec grpcio-tools
    asyncio.run(serve())
