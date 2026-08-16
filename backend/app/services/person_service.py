import face_recognition
import numpy as np
from PIL import Image
import io

class FaceRecognitionService:
    @staticmethod
    async def extract_face_encodings(file_content):
        image = face_recognition.load_image_file(io.BytesIO(file_content))
        face_encodings = face_recognition.face_encodings(image)
        return face_encodings

    @staticmethod
    def compare_faces(known_encoding, unknown_encoding):
        results = face_recognition.compare_faces([known_encoding], unknown_encoding)
        return results[0]

class InfoSearchService:
    @staticmethod
    async def search_by_name(name: str):
        # Simulation d'une recherche web (OSINT)
        # Dans une version réelle, on utiliserait Serper.dev ou un scraper
        return {
            "name": name,
            "bio": "Informations trouvées sur LinkedIn et réseaux sociaux.",
            "links": [
                {"platform": "LinkedIn", "url": f"https://linkedin.com/search/{name}"},
                {"platform": "Twitter", "url": f"https://twitter.com/search?q={name}"}
            ]
        }

    @staticmethod
    async def search_by_phone(phone: str):
        # Simulation de recherche par numéro
        return {
            "phone": phone,
            "operator": "Orange/SFR (Simulé)",
            "location": "France",
            "possible_owner": "Identité protégée ou trouvée dans les annuaires publics."
        }
