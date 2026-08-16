from fastapi import APIRouter, UploadFile, File, Form
from app.services.person_service import FaceRecognitionService, InfoSearchService
from typing import Optional

router = APIRouter(prefix="/search", tags=["Search"])

@router.post("/person")
async def search_person(
    image: Optional[UploadFile] = File(None),
    query: Optional[str] = Form(None)
):
    results = {}
    
    if image:
        content = await image.read()
        encodings = await FaceRecognitionService.extract_face_encodings(content)
        results["face_analysis"] = {
            "faces_detected": len(encodings),
            "status": "Success" if len(encodings) > 0 else "No face found"
        }
        # Ici on comparerait avec une base de données vectorielle (Pinecone)
        results["person_info"] = await InfoSearchService.search_by_name("Identité Probable (Mock)")

    if query:
        if query.replace(" ", "").isdigit():
            results["phone_info"] = await InfoSearchService.search_by_phone(query)
        else:
            results["web_info"] = await InfoSearchService.search_by_name(query)

    return results

@router.post("/audio")
async def search_audio(file: UploadFile = File(...)):
    # Simulation de reconnaissance audio
    return {
        "title": "Imagine",
        "artist": "John Lennon",
        "album": "Imagine",
        "lyrics": "Imagine there's no heaven...",
        "release_date": "1971",
        "platforms": {"spotify": "#", "youtube": "#"}
    }

@router.post("/video")
async def search_video(file: UploadFile = File(...)):
    # Simulation de reconnaissance vidéo
    return {
        "title": "Inception",
        "director": "Christopher Nolan",
        "year": "2010",
        "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
        "summary": "Un voleur qui s'approprie des secrets d'entreprise à travers l'utilisation de la technologie de partage de rêves..."
    }
