from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api_routes import router as search_router

app = FastAPI(title="Creative AI Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)

@app.get("/")
async def root():
    return {"message": "Welcome to Creative AI Studio API", "status": "online"}
