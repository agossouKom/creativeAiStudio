# Creative AI Studio - Multi-Media Recognition SaaS

Ce projet est une plateforme SaaS permettant de rechercher des informations sur des sons, vidéos ou personnes à partir de différents types d'entrées (image, audio, vidéo).

## 🚀 Structure
- `/frontend` : Application Angular 17+ (Dashboard & Recherche)
- `/backend` : API FastAPI (Python) pour le traitement IA

## 🛠️ Installation

### Backend
1. Aller dans le dossier `backend`
2. Créer un environnement virtuel : `python -m venv venv`
3. Activer l'environnement : `source venv/bin/activate`
4. Installer les dépendances : `pip install -r requirements.txt`
5. Lancer l'API : `uvicorn app.main:app --reload`

### Frontend
1. Aller dans le dossier `frontend`
2. Installer les dépendances : `npm install`
3. Lancer l'application : `npm start`

## ✨ Fonctionnalités cibles
- 🎵 Recherche de son (Titre, Artiste, Paroles)
- 🎬 Recherche de film (Titre, Auteur, Détails)
- 👤 Recherche de personne (Photo, Infos web)
